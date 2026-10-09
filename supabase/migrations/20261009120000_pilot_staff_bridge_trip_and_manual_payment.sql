-- Applied on I KING (yiklciblxwymcxxszkty). Additive pilot bridge: staff-confirmed trip creation (both paths) + manual payment record.
create or replace function public.staff_confirm_trip_from_booking(p_booking uuid, p_note text, p_planned_departure timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.booking_intents%rowtype; a public.aircraft_availability%rowtype; qr public.quote_requests%rowtype; q public.quotes%rowtype;
        v_dest text; v_trip uuid; v_actor uuid := (select auth.uid());
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_note is null or char_length(trim(p_note)) < 5 then raise exception 'record the operator confirmation (who confirmed, how)'; end if;
  select * into b from public.booking_intents where id = p_booking for update;
  if not found then raise exception 'booking not found'; end if;
  if b.status not in ('OPERATOR_CONFIRMED','BOOKED') then raise exception 'booking must be operator-confirmed first (state %)', b.status; end if;
  select id into v_trip from public.trips where booking_intent_id = b.id;
  if v_trip is not null then return jsonb_build_object('trip_id', v_trip, 'already_existed', true); end if;
  select * into a from public.aircraft_availability where id = b.availability_id;
  select * into q from public.quotes where id = b.quote_id;
  select * into qr from public.quote_requests where id = q.quote_request_id;
  v_dest := a.destination_code;
  if v_dest is null and qr.request_id is not null then select destination_code into v_dest from public.travel_requests where id = qr.request_id; end if;
  if v_dest is null then raise exception 'destination is unknown; cannot create a trip without it'; end if;
  insert into public.trips(booking_intent_id, customer_id, availability_id, origin_code, destination_code, planned_departure, is_demo)
  values (b.id, b.customer_id, b.availability_id, a.origin_code, v_dest, p_planned_departure, a.is_demo) returning id into v_trip;
  insert into public.trip_events(trip_id, kind, details, source, created_by)
  values (v_trip, 'TRIP_CONFIRMED', jsonb_build_object('path','AVAILABILITY','note',left(p_note,300),'departure_known', p_planned_departure is not null), 'INTERNAL_DATABASE', v_actor);
  insert into public.notification_events(event_type, entity_type, entity_id, recipient_kind, customer_id, payload)
  values ('TRIP_CONFIRMED','trip', v_trip, 'CUSTOMER', b.customer_id, jsonb_build_object('origin', a.origin_code, 'destination', v_dest));
  return jsonb_build_object('trip_id', v_trip, 'already_existed', false);
end $$;

create or replace function public.staff_confirm_trip_from_request(p_request uuid, p_note text, p_planned_departure timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.travel_requests%rowtype; v_trip uuid; v_actor uuid := (select auth.uid());
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_note is null or char_length(trim(p_note)) < 5 then raise exception 'record the operator confirmation (who confirmed, how)'; end if;
  select * into r from public.travel_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if r.loop_status <> 'CONFIRMED' then raise exception 'request must be CONFIRMED first (state %)', r.loop_status; end if;
  if r.origin_code is null or r.destination_code is null then raise exception 'origin and destination are required'; end if;
  select id into v_trip from public.trips where travel_request_id = r.id;
  if v_trip is not null then return jsonb_build_object('trip_id', v_trip, 'already_existed', true); end if;
  insert into public.trips(travel_request_id, customer_id, origin_code, destination_code, planned_departure)
  values (r.id, r.customer_id, r.origin_code, r.destination_code, p_planned_departure) returning id into v_trip;
  insert into public.trip_events(trip_id, kind, details, source, created_by)
  values (v_trip, 'TRIP_CONFIRMED', jsonb_build_object('path','RFQ','note',left(p_note,300),'travel_date', r.travel_date,'departure_known', p_planned_departure is not null), 'INTERNAL_DATABASE', v_actor);
  insert into public.notification_events(event_type, entity_type, entity_id, recipient_kind, customer_id, payload)
  values ('TRIP_CONFIRMED','trip', v_trip, 'CUSTOMER', r.customer_id, jsonb_build_object('origin', r.origin_code, 'destination', r.destination_code));
  return jsonb_build_object('trip_id', v_trip, 'already_existed', false);
end $$;

create or replace function public.staff_record_manual_payment(p_amount numeric, p_currency text, p_reference text, p_booking uuid default null, p_client_offer uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; b public.booking_intents%rowtype; co public.client_offers%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if (p_booking is null) = (p_client_offer is null) then raise exception 'give exactly one target: a booking or a client offer'; end if;
  if p_reference is null or char_length(trim(p_reference)) < 3 then raise exception 'a payment reference (transfer id / receipt) is required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_booking is not null then
    select * into b from public.booking_intents where id = p_booking for update;
    if not found then raise exception 'booking not found'; end if;
    if b.status in ('CANCELLED','FAILED') then raise exception 'booking is closed (state %)', b.status; end if;
    if exists (select 1 from public.payment_sessions where booking_intent_id = p_booking and status = 'PAID') then raise exception 'this booking already has a PAID session'; end if;
  else
    select * into co from public.client_offers where id = p_client_offer for update;
    if not found then raise exception 'client offer not found'; end if;
    if co.status <> 'ACCEPTED' then raise exception 'client offer must be ACCEPTED (state %)', co.status; end if;
    if exists (select 1 from public.payment_sessions where client_offer_id = p_client_offer and status = 'PAID') then raise exception 'this offer already has a PAID session'; end if;
  end if;
  insert into public.payment_sessions(booking_intent_id, client_offer_id, seller, provider, provider_ref, amount, currency, created_by)
  values (p_booking, p_client_offer, 'OPERATOR', 'MANUAL_TRANSFER', left(trim(p_reference),120), p_amount, p_currency, (select auth.uid())) returning id into v_id;
  update public.payment_sessions set status = 'LINK_SENT' where id = v_id;
  update public.payment_sessions set status = 'PAID', status_source = 'STAFF_MANUAL', paid_at = now() where id = v_id;
  return jsonb_build_object('payment_session_id', v_id, 'status', 'PAID', 'source', 'STAFF_MANUAL');
end $$;

revoke all on function public.staff_confirm_trip_from_booking(uuid,text,timestamptz) from public, anon;
revoke all on function public.staff_confirm_trip_from_request(uuid,text,timestamptz) from public, anon;
revoke all on function public.staff_record_manual_payment(numeric,text,text,uuid,uuid) from public, anon;
grant execute on function public.staff_confirm_trip_from_booking(uuid,text,timestamptz) to authenticated;
grant execute on function public.staff_confirm_trip_from_request(uuid,text,timestamptz) to authenticated;
grant execute on function public.staff_record_manual_payment(numeric,text,text,uuid,uuid) to authenticated;
