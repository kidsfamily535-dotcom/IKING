-- First loop (request -> approved offer -> booking intent). The Eye acts as broker; the human broker (staff) approves 3 gates.
-- Operators have no accounts yet: replies are recorded by the broker on their behalf.

create type public.loop_status as enum (
  'NEW_REQUEST','SEARCHING','OPERATOR_CONTACTED','AWAITING_OFFER','OFFER_RECEIVED','BROKER_REVIEW',
  'PRESENTED','ACCEPTED','AWAITING_BOOKING','CONFIRMED',
  'CLIENT_DECLINED','CLOSED_NO_SUPPLY','CLOSED_NO_OPERATOR_REPLY','CLOSED_NO_CLIENT_REPLY','OFFER_EXPIRED','CANCELLED');

alter table public.travel_requests
  add column loop_status public.loop_status not null default 'NEW_REQUEST',
  add column loop_status_reason text;
comment on column public.travel_requests.loop_status is 'Progress of the first loop. Changes only through loop_* functions, with explicit allowed transitions. Orthogonal to status (data completeness).';

create or replace function public.loop_transition_allowed(f public.loop_status, t public.loop_status)
returns boolean language sql immutable set search_path = '' as $$
  select f <> t and (
    (f::text || '>' || t::text) = any (array[
      'NEW_REQUEST>SEARCHING',
      'SEARCHING>OPERATOR_CONTACTED','SEARCHING>OFFER_RECEIVED','SEARCHING>CLOSED_NO_SUPPLY',
      'OPERATOR_CONTACTED>AWAITING_OFFER',
      'AWAITING_OFFER>OPERATOR_CONTACTED','AWAITING_OFFER>OFFER_RECEIVED','AWAITING_OFFER>SEARCHING',
      'AWAITING_OFFER>CLOSED_NO_OPERATOR_REPLY','AWAITING_OFFER>CLOSED_NO_SUPPLY',
      'OFFER_RECEIVED>BROKER_REVIEW','OFFER_RECEIVED>SEARCHING',
      'BROKER_REVIEW>PRESENTED','BROKER_REVIEW>SEARCHING','BROKER_REVIEW>CLOSED_NO_SUPPLY',
      'PRESENTED>ACCEPTED','PRESENTED>CLIENT_DECLINED','PRESENTED>OFFER_EXPIRED','PRESENTED>CLOSED_NO_CLIENT_REPLY',
      'OFFER_EXPIRED>SEARCHING','OFFER_EXPIRED>CLOSED_NO_CLIENT_REPLY',
      'ACCEPTED>AWAITING_BOOKING',
      'AWAITING_BOOKING>CONFIRMED','AWAITING_BOOKING>SEARCHING'])
    or (t = 'CANCELLED' and f not in ('CLIENT_DECLINED','CLOSED_NO_SUPPLY','CLOSED_NO_OPERATOR_REPLY','CLOSED_NO_CLIENT_REPLY','CANCELLED'))
  ) $$;

-- Contacts with operators (one row per request x operator). Staff only.
create table public.operator_rfqs (
  id uuid primary key default gen_random_uuid(),
  travel_request_id uuid not null references public.travel_requests(id) on delete restrict,
  operator_name text not null check (char_length(trim(operator_name)) between 2 and 120),
  operator_contact text check (char_length(operator_contact) <= 200),
  operator_profile_id uuid references public.profiles(id),
  contact_channel text not null check (contact_channel in ('phone','whatsapp','email','platform','other')),
  status text not null default 'AWAITING' check (status in ('AWAITING','OFFER','DECLINED','NO_RESPONSE')),
  contacted_at timestamptz not null default now(),
  contacted_by uuid references public.profiles(id),
  reminded_at timestamptz,
  responded_at timestamptz,
  decline_reason text check (char_length(decline_reason) <= 300)
);
create unique index operator_rfqs_one_per_operator on public.operator_rfqs (travel_request_id, lower(trim(operator_name)));
create index operator_rfqs_request_idx on public.operator_rfqs (travel_request_id);

-- What the operator replied when available. Operator side of the price.
create table public.rfq_offers (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null unique references public.operator_rfqs(id) on delete restrict,
  travel_request_id uuid not null references public.travel_requests(id) on delete restrict,
  aircraft_type text not null check (char_length(trim(aircraft_type)) between 2 and 80),
  operator_total_price numeric(12,2) not null check (operator_total_price > 0),
  currency text not null check (currency in ('USD','SAR','AED')),
  includes_fees boolean not null,
  flight_time_minutes integer check (flight_time_minutes between 10 and 1200),
  restrictions text check (char_length(restrictions) <= 500),
  valid_until timestamptz not null,
  price_source public.truth_source not null default 'OFFICIAL_OPERATOR' check (price_source in ('OFFICIAL_OPERATOR','VERIFIED_PARTNER')),
  entered_via text not null default 'broker_on_behalf' check (entered_via in ('operator_link','broker_on_behalf')),
  received_at timestamptz not null default now(),
  entered_by uuid references public.profiles(id)
);
create index rfq_offers_request_idx on public.rfq_offers (travel_request_id);

-- What the customer is shown. Holds the broker price (margin = client_price - operator price). Staff only; customers read via RPC.
create table public.client_offers (
  id uuid primary key default gen_random_uuid(),
  travel_request_id uuid not null references public.travel_requests(id) on delete restrict,
  rfq_offer_id uuid not null unique references public.rfq_offers(id) on delete restrict,
  client_price numeric(12,2) not null check (client_price > 0),
  currency text not null check (currency in ('USD','SAR','AED')),
  cabin_label text not null check (char_length(cabin_label) between 2 and 80),
  client_note text check (char_length(client_note) <= 500),
  fees_note text check (char_length(fees_note) <= 300),
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','PRESENTED','ACCEPTED','REJECTED','EXPIRED','WITHDRAWN')),
  valid_until timestamptz not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  presented_at timestamptz,
  reminded_at timestamptz,
  decided_at timestamptz,
  decision_reason text check (char_length(decision_reason) <= 300)
);
create index client_offers_request_idx on public.client_offers (travel_request_id);

-- The 3 human approval gates. Append-only record of who approved what and when.
create table public.request_approvals (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  travel_request_id uuid not null references public.travel_requests(id) on delete restrict,
  gate smallint not null check (gate in (1,2,3)),
  decision text not null check (decision in ('APPROVED','CHANGES_REQUESTED','REJECTED')),
  approver_id uuid not null references public.profiles(id),
  note text check (char_length(note) <= 500),
  scope jsonb not null default '{}'::jsonb,
  target_id uuid,
  snapshot jsonb,
  decided_at timestamptz not null default now()
);
create index request_approvals_lookup_idx on public.request_approvals (travel_request_id, gate, seq desc);
comment on table public.request_approvals is 'Gate 1 = send request to operators (scope.operators); gate 2 = present offer to client (target_id = client_offers.id, snapshot of what was approved); gate 3 = confirm with operator after client acceptance. Append-only.';

alter table public.operator_rfqs enable row level security;
alter table public.rfq_offers enable row level security;
alter table public.client_offers enable row level security;
alter table public.request_approvals enable row level security;
create policy rfqs_staff_select on public.operator_rfqs for select to authenticated using ((select public.is_staff()));
create policy rfq_offers_staff_select on public.rfq_offers for select to authenticated using ((select public.is_staff()));
create policy client_offers_staff_select on public.client_offers for select to authenticated using ((select public.is_staff()));
create policy approvals_staff_select on public.request_approvals for select to authenticated using ((select public.is_staff()));
revoke all on table public.operator_rfqs, public.rfq_offers, public.client_offers, public.request_approvals from anon, authenticated;
grant select on table public.operator_rfqs, public.rfq_offers, public.client_offers, public.request_approvals to authenticated;

-- Guard: loop_status cannot be set on insert, cannot change except via loop functions, and only along allowed transitions.
create or replace function public.guard_loop_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.loop_status := 'NEW_REQUEST'; new.loop_status_reason := null; return new;
  end if;
  -- the existing cancel flow (status = CANCELLED) also closes the loop
  if new.status = 'CANCELLED' and old.status is distinct from 'CANCELLED'
     and new.loop_status = old.loop_status and public.loop_transition_allowed(old.loop_status, 'CANCELLED') then
    new.loop_status := 'CANCELLED'; new.loop_status_reason := 'request cancelled';
    update public.client_offers set status = 'WITHDRAWN', decided_at = now(), decision_reason = 'request cancelled'
      where travel_request_id = new.id and status in ('DRAFT','APPROVED','PRESENTED');
    return new;
  end if;
  if new.loop_status is distinct from old.loop_status then
    if coalesce(current_setting('app.loop_via_fn', true), '') <> '1' then
      raise exception 'loop_status can only change through the loop functions' using errcode = '42501';
    end if;
    if not public.loop_transition_allowed(old.loop_status, new.loop_status) then
      raise exception 'loop transition % -> % is not allowed', old.loop_status, new.loop_status using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger trg_guard_loop before insert or update on public.travel_requests for each row execute function public.guard_loop_status();
revoke execute on function public.guard_loop_status() from public, anon, authenticated;
revoke execute on function public.loop_transition_allowed(public.loop_status, public.loop_status) from public, anon, authenticated;
