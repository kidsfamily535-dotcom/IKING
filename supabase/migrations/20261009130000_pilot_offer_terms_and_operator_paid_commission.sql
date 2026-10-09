-- Applied on I KING (yiklciblxwymcxxszkty). Offer terms (staff writes, customer reads latest after presentation)
-- + broker commission paid BY THE OPERATOR (staff-only; never visible to customers or operators).
create or replace function public.staff_set_offer_terms(p_quote uuid, p_client_offer uuid, p_inclusions text[], p_exclusions text[], p_taxes_included boolean, p_cancellation text, p_payment_terms text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cur text; v_status text; v_ver int; v_id uuid;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if (p_quote is null) = (p_client_offer is null) then raise exception 'give exactly one target: a quote or a client offer'; end if;
  if p_cancellation is null or char_length(trim(p_cancellation)) < 5 then raise exception 'cancellation policy is required (write "unknown" explicitly if the operator has not stated it)'; end if;
  if p_quote is not null then
    select status::text, currency into v_status, v_cur from public.quotes where id = p_quote for update;
    if not found then raise exception 'quote not found'; end if;
    if v_status not in ('BROKER_REVIEW','CLIENT_PRESENTED') then raise exception 'quote is closed (state %)', v_status; end if;
    select coalesce(max(version),0)+1 into v_ver from public.offer_terms where quote_id = p_quote;
  else
    select status, currency into v_status, v_cur from public.client_offers where id = p_client_offer for update;
    if not found then raise exception 'client offer not found'; end if;
    if v_status not in ('DRAFT','APPROVED','PRESENTED') then raise exception 'offer is closed (state %)', v_status; end if;
    select coalesce(max(version),0)+1 into v_ver from public.offer_terms where client_offer_id = p_client_offer;
  end if;
  insert into public.offer_terms(quote_id, client_offer_id, version, currency, inclusions, exclusions, taxes_included, cancellation_policy, payment_terms, created_by)
  values (p_quote, p_client_offer, v_ver, v_cur, coalesce(p_inclusions,'{}'), coalesce(p_exclusions,'{}'), p_taxes_included, left(trim(p_cancellation),1000), left(p_payment_terms,500), (select auth.uid()))
  returning id into v_id;
  return jsonb_build_object('offer_terms_id', v_id, 'version', v_ver, 'taxes_included_known', p_taxes_included is not null);
end $$;

create or replace function public.get_my_offer_terms(p_quote uuid default null, p_client_offer uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare t public.offer_terms%rowtype; v_ok boolean := false;
begin
  if (select auth.uid()) is null then raise exception 'not authorized' using errcode = '42501'; end if;
  if (p_quote is null) = (p_client_offer is null) then raise exception 'give exactly one target'; end if;
  if p_quote is not null then
    select true into v_ok from public.quotes q join public.quote_requests r on r.id = q.quote_request_id
     where q.id = p_quote and r.customer_id = (select auth.uid()) and q.status in ('CLIENT_PRESENTED','CLIENT_ACCEPTED');
    select * into t from public.offer_terms where quote_id = p_quote order by version desc limit 1;
  else
    select true into v_ok from public.client_offers c join public.travel_requests r on r.id = c.travel_request_id
     where c.id = p_client_offer and r.customer_id = (select auth.uid()) and c.status in ('PRESENTED','ACCEPTED');
    select * into t from public.offer_terms where client_offer_id = p_client_offer order by version desc limit 1;
  end if;
  if not coalesce(v_ok,false) then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  if t.id is null then return jsonb_build_object('terms_recorded', false); end if;
  return jsonb_build_object('terms_recorded', true, 'version', t.version, 'currency', t.currency, 'inclusions', t.inclusions, 'exclusions', t.exclusions,
    'taxes_included', t.taxes_included, 'cancellation_policy', t.cancellation_policy, 'payment_terms', t.payment_terms);
end $$;

create table if not exists public.broker_commissions (
  id uuid primary key default gen_random_uuid(),
  booking_intent_id uuid unique references public.booking_intents(id),
  travel_request_id uuid unique references public.travel_requests(id),
  basis text not null check (basis in ('PERCENT_OF_PRICE','FIXED')),
  rate_pct numeric(5,2) check (rate_pct is null or (rate_pct > 0 and rate_pct <= 100)),
  base_amount numeric check (base_amount is null or base_amount > 0),
  currency text not null check (currency in ('USD','SAR','AED')),
  expected_amount numeric not null check (expected_amount > 0),
  status text not null default 'EXPECTED' check (status in ('EXPECTED','INVOICED','RECEIVED','WAIVED')),
  received_at timestamptz,
  note text check (note is null or char_length(note) <= 300),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commission_one_target check (((booking_intent_id is not null)::int + (travel_request_id is not null)::int) = 1),
  constraint commission_basis_chk check ((basis = 'PERCENT_OF_PRICE' and rate_pct is not null and base_amount is not null) or (basis = 'FIXED' and rate_pct is null)),
  constraint commission_received_chk check (status <> 'RECEIVED' or received_at is not null)
);
comment on table public.broker_commissions is 'Broker commission owed BY THE OPERATOR (client pays operator price, no markup). Staff-only.';
alter table public.broker_commissions enable row level security;
create policy broker_commissions_select_staff on public.broker_commissions for select to authenticated using ((select public.is_staff()));
revoke all on public.broker_commissions from anon, authenticated;
grant select on public.broker_commissions to authenticated;

create or replace function public.staff_set_commission(p_booking uuid, p_request uuid, p_basis text, p_rate_pct numeric, p_fixed_amount numeric, p_fixed_currency text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_base numeric; v_cur text; v_exp numeric; v_id uuid; v_status text;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if (p_booking is null) = (p_request is null) then raise exception 'give exactly one target: a booking or a request'; end if;
  if p_booking is not null then
    select q.operator_price_usd, 'USD' into v_base, v_cur from public.booking_intents b join public.quotes q on q.id = b.quote_id where b.id = p_booking;
    if v_base is null then raise exception 'booking not found'; end if;
  else
    select o.operator_total_price, o.currency into v_base, v_cur from public.client_offers c join public.rfq_offers o on o.id = c.rfq_offer_id
     where c.travel_request_id = p_request and c.status = 'ACCEPTED' limit 1;
    if v_base is null then raise exception 'request has no accepted offer yet'; end if;
  end if;
  if p_basis = 'PERCENT_OF_PRICE' then
    if p_rate_pct is null then raise exception 'rate_pct is required'; end if;
    v_exp := round(v_base * p_rate_pct / 100, 2);
  elsif p_basis = 'FIXED' then
    if p_fixed_amount is null or p_fixed_amount <= 0 then raise exception 'fixed amount is required'; end if;
    if p_fixed_currency is null then raise exception 'fixed currency is required'; end if;
    v_exp := p_fixed_amount; v_cur := p_fixed_currency; v_base := null;
  else raise exception 'basis must be PERCENT_OF_PRICE or FIXED'; end if;
  select id, status into v_id, v_status from public.broker_commissions where booking_intent_id is not distinct from p_booking and travel_request_id is not distinct from p_request;
  if v_id is not null then
    if v_status <> 'EXPECTED' then raise exception 'commission already % and cannot be changed', v_status; end if;
    update public.broker_commissions set basis = p_basis, rate_pct = case when p_basis='FIXED' then null else p_rate_pct end, base_amount = v_base, currency = v_cur, expected_amount = v_exp, note = left(p_note,300), updated_at = now() where id = v_id;
  else
    insert into public.broker_commissions(booking_intent_id, travel_request_id, basis, rate_pct, base_amount, currency, expected_amount, note, created_by)
    values (p_booking, p_request, p_basis, case when p_basis='FIXED' then null else p_rate_pct end, v_base, v_cur, v_exp, left(p_note,300), (select auth.uid())) returning id into v_id;
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'commission_set', 'broker_commissions', v_id, jsonb_build_object('basis', p_basis, 'expected', v_exp, 'currency', v_cur));
  return jsonb_build_object('commission_id', v_id, 'expected_amount', v_exp, 'currency', v_cur, 'status', 'EXPECTED');
end $$;

create or replace function public.staff_set_commission_status(p_id uuid, p_new text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.broker_commissions%rowtype;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into c from public.broker_commissions where id = p_id for update;
  if not found then raise exception 'commission not found'; end if;
  if not ((c.status, p_new) in (('EXPECTED','INVOICED'),('EXPECTED','WAIVED'),('INVOICED','RECEIVED'),('INVOICED','WAIVED'))) then raise exception 'illegal commission transition % -> %', c.status, p_new; end if;
  if p_new in ('RECEIVED','WAIVED') and (p_note is null or char_length(trim(p_note)) < 3) then raise exception 'a note is required (receipt reference or waiver reason)'; end if;
  update public.broker_commissions set status = p_new, note = coalesce(left(p_note,300), note), updated_at = now(), received_at = case when p_new = 'RECEIVED' then now() else received_at end where id = p_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'commission_status', 'broker_commissions', p_id, jsonb_build_object('from', c.status, 'to', p_new));
  return jsonb_build_object('commission_id', p_id, 'status', p_new);
end $$;

revoke all on function public.staff_set_offer_terms(uuid,uuid,text[],text[],boolean,text,text) from public, anon;
revoke all on function public.get_my_offer_terms(uuid,uuid) from public, anon;
revoke all on function public.staff_set_commission(uuid,uuid,text,numeric,numeric,text,text) from public, anon;
revoke all on function public.staff_set_commission_status(uuid,text,text) from public, anon;
grant execute on function public.staff_set_offer_terms(uuid,uuid,text[],text[],boolean,text,text) to authenticated;
grant execute on function public.get_my_offer_terms(uuid,uuid) to authenticated;
grant execute on function public.staff_set_commission(uuid,uuid,text,numeric,numeric,text,text) to authenticated;
grant execute on function public.staff_set_commission_status(uuid,text,text) to authenticated;
