-- Margin protection: the client-facing price and note live in a staff-only table.
-- Operators can read their own rows in public.quotes, so client_price_usd must not live there.
create table public.quote_client_terms (
  quote_id uuid primary key references public.quotes(id) on delete cascade,
  client_price_usd numeric not null check (client_price_usd > 0),
  client_note text check (char_length(client_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.quote_client_terms is 'Client-facing price/note for a quote (broker margin = this minus quotes.operator_price_usd). Staff-only. Never readable by operators or customers directly; customers get it only via list_my_quotes after presentation.';

alter table public.quote_client_terms enable row level security;
create policy qct_staff_select on public.quote_client_terms for select to authenticated using ((select public.is_staff()));
revoke all on table public.quote_client_terms from anon, authenticated;
grant select on table public.quote_client_terms to authenticated;

create trigger trg_qct_updated_at before update on public.quote_client_terms for each row execute function public.set_updated_at();

-- quotes is empty (0 rows) so no data to move.
alter table public.quotes drop column client_price_usd, drop column client_note;

create or replace function public.present_quote(p_quote_id uuid, p_client_price_usd numeric, p_client_note text default null)
returns void language plpgsql security definer set search_path to '' as $function$
declare q public.quotes%rowtype; r public.quote_requests%rowtype; a public.aircraft_availability%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'not found'; end if;
  if q.status <> 'BROKER_REVIEW' then raise exception 'quote is not in broker review'; end if;
  select * into r from public.quote_requests where id = q.quote_request_id;
  select * into a from public.aircraft_availability where id = q.availability_id;
  if p_client_price_usd is null or p_client_price_usd < q.operator_price_usd then raise exception 'client price is below operator price'; end if;
  if q.valid_until < now() + interval '10 minutes' then raise exception 'quote is about to expire'; end if;
  if a.status <> 'AVAILABLE' or a.expires_at <= now() then raise exception 'availability is not current'; end if;
  insert into public.quote_client_terms(quote_id, client_price_usd, client_note)
  values (p_quote_id, p_client_price_usd, left(p_client_note, 500))
  on conflict (quote_id) do update set client_price_usd = excluded.client_price_usd, client_note = excluded.client_note;
  update public.quotes set status = 'CLIENT_PRESENTED', presented_at = now() where id = p_quote_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'quote_presented', 'quote', p_quote_id,
          jsonb_build_object('operator_price_usd', q.operator_price_usd, 'client_price_usd', p_client_price_usd));
  perform public._match_advance(r.match_id, 'QUOTE');
end $function$;

create or replace function public.accept_quote(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare q public.quotes%rowtype; r public.quote_requests%rowtype; a public.aircraft_availability%rowtype; v_bi uuid; v_price numeric;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  select * into r from public.quote_requests where id = q.quote_request_id;
  if r.customer_id <> (select auth.uid()) then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  if q.status <> 'CLIENT_PRESENTED' or q.valid_until <= now() then raise exception 'quote is not open for acceptance'; end if;
  select * into a from public.aircraft_availability where id = q.availability_id;
  if a.status <> 'AVAILABLE' or a.expires_at <= now() then raise exception 'availability is no longer current'; end if;
  select client_price_usd into v_price from public.quote_client_terms where quote_id = p_quote_id;
  if v_price is null then raise exception 'quote has no client price'; end if;
  update public.quotes set status = 'CLIENT_ACCEPTED', decided_at = now() where id = p_quote_id;
  insert into public.booking_intents(quote_id, customer_id, availability_id, opportunity_id, match_id, price_snapshot_usd)
  values (p_quote_id, r.customer_id, q.availability_id, r.opportunity_id, r.match_id, v_price) returning id into v_bi;
  perform public._match_advance(r.match_id, 'BOOKING_INTENT');
  perform public._learn(r.customer_id, r.request_id, q.availability_id, 'SELECTED', 'in_app', jsonb_build_object('quote_id', p_quote_id));
  return jsonb_build_object('status', 'BOOKING_INTENT_CREATED', 'booking_intent_id', v_bi,
    'notice_ar', 'تم تسجيل نيتك في الحجز. لا يوجد حجز مؤكد حتى يؤكد فريقنا والمشغّل.');
end $function$;

create or replace function public.list_my_quotes()
returns table(quote_id uuid, quote_request_id uuid, origin_code text, origin_name_ar text, destination_code text, destination_name_ar text, departure_from timestamptz, departure_until timestamptz, passengers integer, client_price_usd numeric, currency text, valid_until timestamptz, status quote_status, price_status text, client_note text, notice_ar text)
language sql stable security definer set search_path to '' as $function$
  select q.id, r.id, a.origin_code, ao.name_ar, a.destination_code, ad.name_ar, a.departure_from, a.departure_until, r.passengers,
    t.client_price_usd, q.currency, q.valid_until, q.status, 'OPERATOR_QUOTE', t.client_note,
    case when q.status = 'CLIENT_ACCEPTED'
         then 'تم تسجيل نيتك في الحجز. لا يوجد حجز مؤكد حتى يؤكد فريقنا والمشغّل.'
         else 'عرض سعر وارد من المشغّل. لا يصبح حجزًا إلا بعد تأكيد فريقنا والمشغّل.' end
  from public.quotes q
  join public.quote_client_terms t on t.quote_id = q.id
  join public.quote_requests r on r.id = q.quote_request_id
  join public.aircraft_availability a on a.id = q.availability_id
  join public.airports ao on ao.iata_code = a.origin_code
  join public.airports ad on ad.iata_code = a.destination_code
  where r.customer_id = (select auth.uid()) and q.status in ('CLIENT_PRESENTED','CLIENT_ACCEPTED')
    and (q.status = 'CLIENT_ACCEPTED' or (q.valid_until > now() and a.status = 'AVAILABLE' and a.expires_at > now()))
  order by q.created_at desc $function$;
