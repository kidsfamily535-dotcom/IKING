-- ===== internal helpers =====
create or replace function public._loop_audit(p_action text, p_entity text, p_id uuid, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), p_action, p_entity, p_id, coalesce(p_details, '{}'::jsonb)) $$;

create or replace function public._loop_set(p_id uuid, p_new public.loop_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.loop_status;
begin
  select loop_status into v_old from public.travel_requests where id = p_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_old = p_new then return; end if;
  perform set_config('app.loop_via_fn', '1', true);
  update public.travel_requests
     set loop_status = p_new, loop_status_reason = left(p_reason, 300),
         status = case when p_new = 'CANCELLED' then 'CANCELLED'::public.request_status else status end
   where id = p_id;
  perform set_config('app.loop_via_fn', '', true);
  if p_new in ('CANCELLED','CLOSED_NO_SUPPLY','CLOSED_NO_OPERATOR_REPLY','CLOSED_NO_CLIENT_REPLY') then
    update public.client_offers set status = 'WITHDRAWN', decided_at = now(), decision_reason = left(p_reason, 300)
     where travel_request_id = p_id and status in ('DRAFT','APPROVED','PRESENTED');
  end if;
  perform public._loop_audit('loop_status', 'travel_request', p_id,
    jsonb_build_object('from', v_old, 'to', p_new, 'reason', left(p_reason, 300)));
end $$;

create or replace function public._client_offer_snapshot(co public.client_offers)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('client_price', co.client_price, 'currency', co.currency, 'cabin_label', co.cabin_label,
    'client_note', co.client_note, 'fees_note', co.fees_note, 'valid_until_epoch', extract(epoch from co.valid_until)) $$;

create or replace function public._loop_label_ar(s public.loop_status)
returns text language sql immutable set search_path = '' as $$
  select case s
    when 'NEW_REQUEST' then 'استلمنا طلبك ونعمل عليه'
    when 'SEARCHING' then 'نبحث لك عن أنسب الخيارات'
    when 'OPERATOR_CONTACTED' then 'نبحث لك عن أنسب الخيارات'
    when 'AWAITING_OFFER' then 'نبحث لك عن أنسب الخيارات'
    when 'OFFER_RECEIVED' then 'نبحث لك عن أنسب الخيارات'
    when 'BROKER_REVIEW' then 'نبحث لك عن أنسب الخيارات'
    when 'PRESENTED' then 'لديك عرض بانتظار قرارك'
    when 'ACCEPTED' then 'سجّلنا قبولك ونراجع التفاصيل'
    when 'AWAITING_BOOKING' then 'نؤكد الحجز مع المشغّل'
    when 'CONFIRMED' then 'مؤكد'
    when 'CLIENT_DECLINED' then 'أغلقنا الطلب بناءً على قرارك'
    when 'CLOSED_NO_SUPPLY' then 'لم نجد خيارًا مناسبًا حاليًا'
    when 'CLOSED_NO_OPERATOR_REPLY' then 'لم نجد خيارًا مناسبًا حاليًا'
    when 'CLOSED_NO_CLIENT_REPLY' then 'انتهت صلاحية العرض'
    when 'OFFER_EXPIRED' then 'انتهت صلاحية العرض'
    when 'CANCELLED' then 'أُلغي الطلب' end $$;

create or replace function public._loop_after_rfq_closed(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select loop_status from public.travel_requests where id = p_request) = 'AWAITING_OFFER'
     and not exists (select 1 from public.operator_rfqs where travel_request_id = p_request and status in ('AWAITING','OFFER')) then
    perform public._loop_set(p_request, 'SEARCHING', 'no operator reply is pending');
  end if;
end $$;

-- ===== broker (staff) functions =====
create or replace function public.loop_begin_search(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.travel_requests%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into r from public.travel_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if r.status <> 'READY' then raise exception 'request is missing required fields: %', r.missing_fields; end if;
  perform public._loop_set(p_request, 'SEARCHING', 'search started');
end $$;

create or replace function public.loop_approve_gate(p_request uuid, p_gate smallint, p_decision text,
  p_note text default null, p_operators text[] default null, p_client_offer uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.travel_requests%rowtype; co public.client_offers%rowtype; ro public.rfq_offers%rowtype;
        v_scope jsonb := '{}'::jsonb; v_snap jsonb; v_target uuid; v_id uuid; v_ops text[];
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_gate not in (1,2,3) then raise exception 'invalid gate'; end if;
  if p_decision not in ('APPROVED','CHANGES_REQUESTED','REJECTED') then raise exception 'invalid decision'; end if;
  if p_decision <> 'APPROVED' and (p_note is null or char_length(trim(p_note)) < 3) then
    raise exception 'a note is required when not approving'; end if;
  select * into r from public.travel_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;

  if p_gate = 1 then
    if r.loop_status not in ('SEARCHING','AWAITING_OFFER') then raise exception 'gate 1 is not applicable in state %', r.loop_status; end if;
    select array_agg(distinct lower(trim(x))) into v_ops from unnest(p_operators) x where trim(x) <> '';
    if v_ops is null or cardinality(v_ops) not between 1 and 5 then raise exception 'gate 1 needs between 1 and 5 operators'; end if;
    v_scope := jsonb_build_object('operators', to_jsonb(v_ops));
  elsif p_gate = 2 then
    if r.loop_status <> 'BROKER_REVIEW' then raise exception 'gate 2 is not applicable in state %', r.loop_status; end if;
    select * into co from public.client_offers where id = p_client_offer and travel_request_id = p_request for update;
    if not found then raise exception 'client offer not found for this request'; end if;
    if co.status <> 'DRAFT' then raise exception 'client offer is not a draft (status %)', co.status; end if;
    select * into ro from public.rfq_offers where id = co.rfq_offer_id;
    v_target := co.id;
    v_snap := public._client_offer_snapshot(co);
    if p_decision = 'APPROVED' then
      if not ro.includes_fees and coalesce(trim(co.fees_note), '') = '' then
        raise exception 'operator price excludes fees: add a fees note before approval'; end if;
      if co.valid_until < now() + interval '10 minutes' then raise exception 'offer is about to expire'; end if;
    end if;
  else
    if r.loop_status <> 'ACCEPTED' then raise exception 'gate 3 is not applicable in state %', r.loop_status; end if;
  end if;

  insert into public.request_approvals(travel_request_id, gate, decision, approver_id, note, scope, target_id, snapshot)
  values (p_request, p_gate, p_decision, (select auth.uid()), left(p_note, 500), v_scope, v_target, v_snap)
  returning id into v_id;

  if p_gate = 2 and p_decision = 'APPROVED' then
    update public.client_offers set status = 'APPROVED', approved_at = now() where id = co.id;
  elsif p_gate = 2 and p_decision = 'REJECTED' then
    update public.client_offers set status = 'WITHDRAWN', decided_at = now(), decision_reason = left(p_note, 300) where id = co.id;
  elsif p_gate = 3 and p_decision = 'APPROVED' then
    perform public._loop_set(p_request, 'AWAITING_BOOKING', 'gate 3 approved');
  end if;
  perform public._loop_audit('loop_gate_' || p_gate, 'travel_request', p_request,
    jsonb_build_object('decision', p_decision, 'approval_id', v_id));
  return v_id;
end $$;

create or replace function public.loop_record_contact(p_request uuid, p_operator_name text, p_contact text, p_channel text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.travel_requests%rowtype; v_name text := trim(p_operator_name); v_id uuid; v_last text;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into r from public.travel_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if r.loop_status not in ('SEARCHING','AWAITING_OFFER') then
    raise exception 'request is not open for operator contact (state %)', r.loop_status; end if;
  if v_name is null or char_length(v_name) < 2 then raise exception 'operator name required'; end if;
  select a.decision into v_last from public.request_approvals a
   where a.travel_request_id = p_request and a.gate = 1
     and exists (select 1 from jsonb_array_elements_text(a.scope -> 'operators') o where lower(trim(o)) = lower(v_name))
   order by a.seq desc limit 1;
  if v_last is distinct from 'APPROVED' then
    raise exception 'operator % has no current gate-1 approval for this request', v_name; end if;
  insert into public.operator_rfqs(travel_request_id, operator_name, operator_contact, contact_channel, contacted_by)
  values (p_request, v_name, left(p_contact, 200), p_channel, (select auth.uid())) returning id into v_id;
  perform public._loop_set(p_request, 'OPERATOR_CONTACTED', 'operator contacted: ' || v_name);
  perform public._loop_set(p_request, 'AWAITING_OFFER', 'awaiting operator reply');
  perform public._loop_audit('loop_operator_contacted', 'operator_rfq', v_id, jsonb_build_object('request', p_request, 'channel', p_channel));
  return v_id;
end $$;

create or replace function public.loop_record_reply(p_rfq uuid, p_available boolean,
  p_aircraft_type text default null, p_price numeric default null, p_currency text default null,
  p_includes_fees boolean default null, p_valid_until timestamptz default null,
  p_flight_minutes integer default null, p_restrictions text default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare f public.operator_rfqs%rowtype; r public.travel_requests%rowtype; v_offer uuid;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into f from public.operator_rfqs where id = p_rfq for update;
  if not found then raise exception 'rfq not found'; end if;
  if f.status not in ('AWAITING','NO_RESPONSE') then raise exception 'rfq already has a reply (status %)', f.status; end if;
  select * into r from public.travel_requests where id = f.travel_request_id for update;
  if r.loop_status in ('CLIENT_DECLINED','CLOSED_NO_SUPPLY','CLOSED_NO_OPERATOR_REPLY','CLOSED_NO_CLIENT_REPLY','CANCELLED','CONFIRMED') then
    raise exception 'request is closed (state %)', r.loop_status; end if;
  if p_available is null then raise exception 'availability answer required'; end if;

  if not p_available then
    update public.operator_rfqs set status = 'DECLINED', responded_at = now(), decline_reason = left(p_reason, 300) where id = p_rfq;
    perform public._loop_after_rfq_closed(f.travel_request_id);
    perform public._loop_audit('loop_operator_declined', 'operator_rfq', p_rfq, '{}'::jsonb);
    return null;
  end if;

  if p_aircraft_type is null or char_length(trim(p_aircraft_type)) < 2 then raise exception 'aircraft type required'; end if;
  if p_price is null or p_price <= 0 then raise exception 'price must be positive'; end if;
  if p_currency is null or p_currency not in ('USD','SAR','AED') then raise exception 'currency must be USD, SAR or AED'; end if;
  if p_includes_fees is null then raise exception 'state whether the price includes fees'; end if;
  if p_valid_until is null or p_valid_until < now() + interval '10 minutes' then raise exception 'offer validity must be at least 10 minutes ahead'; end if;

  insert into public.rfq_offers(rfq_id, travel_request_id, aircraft_type, operator_total_price, currency, includes_fees,
    flight_time_minutes, restrictions, valid_until, entered_by)
  values (p_rfq, f.travel_request_id, trim(p_aircraft_type), p_price, p_currency, p_includes_fees,
    p_flight_minutes, left(p_restrictions, 500), p_valid_until, (select auth.uid()))
  returning id into v_offer;
  update public.operator_rfqs set status = 'OFFER', responded_at = now() where id = p_rfq;
  if r.loop_status in ('AWAITING_OFFER','SEARCHING') then
    perform public._loop_set(r.id, 'OFFER_RECEIVED', 'operator offer received');
  end if;
  perform public._loop_audit('loop_operator_offer', 'operator_rfq', p_rfq, jsonb_build_object('offer', v_offer));
  return v_offer;
end $$;

create or replace function public.loop_mark_no_response(p_rfq uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.operator_rfqs%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into f from public.operator_rfqs where id = p_rfq for update;
  if not found then raise exception 'rfq not found'; end if;
  if f.status <> 'AWAITING' then raise exception 'rfq is not awaiting (status %)', f.status; end if;
  update public.operator_rfqs set status = 'NO_RESPONSE' where id = p_rfq;
  perform public._loop_after_rfq_closed(f.travel_request_id);
  perform public._loop_audit('loop_operator_no_response', 'operator_rfq', p_rfq, '{}'::jsonb);
end $$;

create or replace function public.loop_prepare_client_offer(p_rfq_offer uuid, p_client_price numeric, p_cabin_label text,
  p_client_note text default null, p_fees_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare ro public.rfq_offers%rowtype; r public.travel_requests%rowtype; v_id uuid;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into ro from public.rfq_offers where id = p_rfq_offer;
  if not found then raise exception 'operator offer not found'; end if;
  select * into r from public.travel_requests where id = ro.travel_request_id for update;
  if r.loop_status not in ('OFFER_RECEIVED','BROKER_REVIEW') then raise exception 'request is not ready for offer preparation (state %)', r.loop_status; end if;
  if p_client_price is null or p_client_price < ro.operator_total_price then raise exception 'client price is below operator price'; end if;
  if p_cabin_label is null or char_length(trim(p_cabin_label)) not between 2 and 80 then raise exception 'cabin label required (2-80 chars)'; end if;
  if ro.valid_until < now() + interval '10 minutes' then raise exception 'operator offer is about to expire'; end if;
  insert into public.client_offers(travel_request_id, rfq_offer_id, client_price, currency, cabin_label, client_note, fees_note, valid_until, created_by)
  values (r.id, ro.id, p_client_price, ro.currency, trim(p_cabin_label), left(p_client_note, 500), left(p_fees_note, 300), ro.valid_until, (select auth.uid()))
  returning id into v_id;
  perform public._loop_set(r.id, 'BROKER_REVIEW', 'client offer being prepared');
  perform public._loop_audit('loop_client_offer_prepared', 'client_offer', v_id, jsonb_build_object('request', r.id));
  return v_id;
end $$;

create or replace function public.loop_revise_client_offer(p_client_offer uuid, p_client_price numeric, p_cabin_label text,
  p_client_note text default null, p_fees_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare co public.client_offers%rowtype; ro public.rfq_offers%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into co from public.client_offers where id = p_client_offer for update;
  if not found then raise exception 'client offer not found'; end if;
  if co.status not in ('DRAFT','APPROVED') then raise exception 'client offer can no longer be revised (status %)', co.status; end if;
  select * into ro from public.rfq_offers where id = co.rfq_offer_id;
  if p_client_price is null or p_client_price < ro.operator_total_price then raise exception 'client price is below operator price'; end if;
  if p_cabin_label is null or char_length(trim(p_cabin_label)) not between 2 and 80 then raise exception 'cabin label required (2-80 chars)'; end if;
  update public.client_offers set client_price = p_client_price, cabin_label = trim(p_cabin_label),
    client_note = left(p_client_note, 500), fees_note = left(p_fees_note, 300), status = 'DRAFT', approved_at = null
   where id = co.id;
  perform public._loop_audit('loop_client_offer_revised', 'client_offer', co.id, '{}'::jsonb);
end $$;

create or replace function public.loop_present_client_offer(p_client_offer uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare co public.client_offers%rowtype; r public.travel_requests%rowtype; a public.request_approvals%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into co from public.client_offers where id = p_client_offer for update;
  if not found then raise exception 'client offer not found'; end if;
  select * into r from public.travel_requests where id = co.travel_request_id for update;
  if r.loop_status not in ('BROKER_REVIEW','PRESENTED') then raise exception 'request is not in review (state %)', r.loop_status; end if;
  if co.status <> 'APPROVED' then raise exception 'client offer has no current approval (status %)', co.status; end if;
  select * into a from public.request_approvals where gate = 2 and target_id = co.id order by seq desc limit 1;
  if not found or a.decision <> 'APPROVED' or a.snapshot is distinct from public._client_offer_snapshot(co) then
    raise exception 'the approved version differs from the current version'; end if;
  if co.valid_until < now() + interval '10 minutes' then raise exception 'offer is about to expire'; end if;
  update public.client_offers set status = 'PRESENTED', presented_at = now() where id = co.id;
  perform public._loop_set(r.id, 'PRESENTED', 'offer presented to client');
  perform public._learn(r.customer_id, r.id, null, 'DELIVERED', 'in_app', jsonb_build_object('client_offer', co.id));
  perform public._loop_audit('loop_offer_presented', 'client_offer', co.id, jsonb_build_object('request', r.id));
end $$;

create or replace function public.loop_confirm(p_request uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.travel_requests%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_note is null or char_length(trim(p_note)) < 5 then raise exception 'record the operator confirmation (who confirmed, how)'; end if;
  select * into r from public.travel_requests where id = p_request for update;
  if not found then raise exception 'request not found'; end if;
  if r.loop_status <> 'AWAITING_BOOKING' then raise exception 'request is not awaiting booking (state %)', r.loop_status; end if;
  perform public._loop_set(p_request, 'CONFIRMED', left(p_note, 300));
  perform public._learn(r.customer_id, r.id, null, 'BOOKED', 'in_app', '{}'::jsonb);
end $$;

create or replace function public.loop_set_status(p_request uuid, p_new public.loop_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_new not in ('SEARCHING','CLOSED_NO_SUPPLY','CLOSED_NO_OPERATOR_REPLY','CLOSED_NO_CLIENT_REPLY','CANCELLED') then
    raise exception 'use the dedicated function for this transition'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception 'reason required'; end if;
  perform public._loop_set(p_request, p_new, p_reason);
end $$;

create or replace function public.loop_mark_reminded(p_rfq uuid default null, p_client_offer uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if (p_rfq is null) = (p_client_offer is null) then raise exception 'pass exactly one of rfq or client offer'; end if;
  if p_rfq is not null then
    update public.operator_rfqs set reminded_at = now() where id = p_rfq and status = 'AWAITING' and reminded_at is null;
  else
    update public.client_offers set reminded_at = now() where id = p_client_offer and status = 'PRESENTED' and reminded_at is null;
  end if;
  if not found then raise exception 'nothing to remind (already reminded once, or not waiting)'; end if;
end $$;

create or replace function public.loop_followups()
returns table(kind text, request_id uuid, ref_id uuid, who text, age_minutes integer, threshold_minutes integer, action text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
  select 'OPERATOR_REPLY'::text, f.travel_request_id, f.id, f.operator_name,
         floor(extract(epoch from (now() - f.contacted_at)) / 60)::integer, t.mins,
         (case when f.reminded_at is null
               then (case when extract(epoch from (now() - f.contacted_at)) / 60 >= t.mins then 'REMIND_OPERATOR' else 'WAIT' end)
               else (case when extract(epoch from (now() - f.reminded_at)) / 60 >= t.mins then 'ADD_ALTERNATIVE_OPERATOR' else 'WAIT' end) end)::text
    from public.operator_rfqs f
    join public.travel_requests r on r.id = f.travel_request_id
    cross join lateral (select case when r.travel_date is null or r.travel_date - current_date <= 1 then 30
                                    when r.travel_date - current_date <= 3 then 120 else 360 end as mins) t
   where f.status = 'AWAITING'
  union all
  select 'CLIENT_DECISION'::text, c.travel_request_id, c.id, 'client'::text,
         floor(extract(epoch from (now() - c.presented_at)) / 60)::integer, 1440,
         (case when c.reminded_at is null
               then (case when extract(epoch from (now() - c.presented_at)) / 60 >= 1440 then 'REMIND_CLIENT_ONCE' else 'WAIT' end)
               else (case when extract(epoch from (now() - c.reminded_at)) / 60 >= 1440 then 'CLOSE_REQUEST' else 'WAIT' end) end)::text
    from public.client_offers c where c.status = 'PRESENTED';
end $$;

create or replace function public.loop_expire_stale()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_req uuid; v_n integer := 0; v_cust uuid;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  for v_req in
    with e as (update public.client_offers set status = 'EXPIRED', decided_at = now()
                where status = 'PRESENTED' and valid_until <= now() returning travel_request_id)
    select distinct travel_request_id from e
  loop
    v_n := v_n + 1;
    select customer_id into v_cust from public.travel_requests where id = v_req;
    perform public._learn(v_cust, v_req, null, 'EXPIRED', 'in_app', '{}'::jsonb);
    if (select loop_status from public.travel_requests where id = v_req) = 'PRESENTED'
       and not exists (select 1 from public.client_offers where travel_request_id = v_req and status = 'PRESENTED') then
      perform public._loop_set(v_req, 'OFFER_EXPIRED', 'all presented offers expired');
    end if;
  end loop;
  return v_n;
end $$;

-- ===== customer functions =====
create or replace function public.loop_customer_decide(p_client_offer uuid, p_accept boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare co public.client_offers%rowtype; r public.travel_requests%rowtype;
begin
  select * into co from public.client_offers where id = p_client_offer for update;
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  select * into r from public.travel_requests where id = co.travel_request_id for update;
  if r.customer_id <> (select auth.uid()) then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  if co.status <> 'PRESENTED' or co.valid_until <= now() then raise exception 'offer is not open for a decision'; end if;
  if p_accept then
    update public.client_offers set status = 'ACCEPTED', decided_at = now() where id = co.id;
    update public.client_offers set status = 'WITHDRAWN', decided_at = now(), decision_reason = 'another option was accepted'
     where travel_request_id = r.id and id <> co.id and status in ('DRAFT','APPROVED','PRESENTED');
    perform public._loop_set(r.id, 'ACCEPTED', 'client accepted (booking intent only)');
    perform public._learn(r.customer_id, r.id, null, 'SELECTED', 'in_app', jsonb_build_object('client_offer', co.id));
    perform public._loop_audit('loop_client_accepted', 'client_offer', co.id, jsonb_build_object('request', r.id));
    return jsonb_build_object('status', 'ACCEPTED',
      'notice_ar', 'سجّلنا قبولك. هذه نية حجز وليست حجزًا مؤكدًا حتى نؤكد التفاصيل مع المشغّل.');
  else
    update public.client_offers set status = 'REJECTED', decided_at = now(), decision_reason = left(p_reason, 300) where id = co.id;
    if not exists (select 1 from public.client_offers where travel_request_id = r.id and status = 'PRESENTED') then
      perform public._loop_set(r.id, 'CLIENT_DECLINED', coalesce(left(p_reason, 300), 'client declined'));
    end if;
    perform public._learn(r.customer_id, r.id, null, 'REJECTED', 'in_app', jsonb_build_object('client_offer', co.id, 'reason', left(p_reason, 300)));
    perform public._loop_audit('loop_client_rejected', 'client_offer', co.id, jsonb_build_object('request', r.id));
    return jsonb_build_object('status', 'REJECTED', 'notice_ar', 'سجّلنا قرارك. شكرًا لوقتك.');
  end if;
end $$;

create or replace function public.list_my_loop_requests()
returns table(request_id uuid, origin_code text, origin_name_ar text, destination_code text, destination_name_ar text,
              travel_date date, passengers integer, status_label text, is_final boolean)
language sql stable security definer set search_path = '' as $$
  select r.id, r.origin_code, ao.name_ar, r.destination_code, ad.name_ar, r.travel_date, r.passengers,
         public._loop_label_ar(r.loop_status),
         r.loop_status in ('CONFIRMED','CLIENT_DECLINED','CLOSED_NO_SUPPLY','CLOSED_NO_OPERATOR_REPLY','CLOSED_NO_CLIENT_REPLY','CANCELLED')
    from public.travel_requests r
    left join public.airports ao on ao.iata_code = r.origin_code
    left join public.airports ad on ad.iata_code = r.destination_code
   where r.customer_id = (select auth.uid())
   order by r.created_at desc $$;

create or replace function public.list_my_loop_offers()
returns table(client_offer_id uuid, request_id uuid, origin_name_ar text, destination_name_ar text, travel_date date,
              cabin_label text, price numeric, currency text, fees_included boolean, fees_note text, valid_until timestamptz,
              status text, notice_ar text)
language sql stable security definer set search_path = '' as $$
  select c.id, r.id, ao.name_ar, ad.name_ar, r.travel_date, c.cabin_label, c.client_price, c.currency, o.includes_fees, c.fees_note,
         c.valid_until, c.status,
         case when c.status = 'ACCEPTED'
              then 'سجّلنا قبولك. هذه نية حجز، والتأكيد النهائي بعد مراجعة المشغّل.'
              else 'عرض وارد من المشغّل. التأكيد النهائي للطائرة والحجز بعد موافقتك وتأكيد المشغّل.' end
    from public.client_offers c
    join public.rfq_offers o on o.id = c.rfq_offer_id
    join public.travel_requests r on r.id = c.travel_request_id
    left join public.airports ao on ao.iata_code = r.origin_code
    left join public.airports ad on ad.iata_code = r.destination_code
   where r.customer_id = (select auth.uid())
     and c.status in ('PRESENTED','ACCEPTED')
     and (c.status = 'ACCEPTED' or c.valid_until > now())
   order by c.created_at desc $$;

-- ===== grants =====
do $g$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('_loop_audit','_loop_set','_client_offer_snapshot','_loop_label_ar','_loop_after_rfq_closed',
                'loop_begin_search','loop_approve_gate','loop_record_contact','loop_record_reply','loop_mark_no_response',
                'loop_prepare_client_offer','loop_revise_client_offer','loop_present_client_offer','loop_confirm','loop_set_status',
                'loop_mark_reminded','loop_followups','loop_expire_stale','loop_customer_decide','list_my_loop_requests','list_my_loop_offers')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    if left(f.proname, 1) <> '_' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $g$;
