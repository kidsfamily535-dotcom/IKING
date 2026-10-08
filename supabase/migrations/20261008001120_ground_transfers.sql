create table if not exists public.ground_transfers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  travel_request_id uuid not null references public.travel_requests(id) on delete cascade,
  direction text not null check (direction in ('TO_AIRPORT','FROM_AIRPORT')),
  airport_code text not null,
  address text check (address is null or char_length(address) between 5 and 200),
  pickup_at timestamptz not null,
  status text not null default 'REQUESTED' check (status in ('REQUESTED','EXECUTED','UNAVAILABLE','CANCELLED')),
  broker_note text check (broker_note is null or char_length(broker_note) <= 300),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  purge_after timestamptz not null
);
create unique index if not exists ground_transfers_one_active on public.ground_transfers (travel_request_id, direction) where status in ('REQUESTED','EXECUTED');
create index if not exists ground_transfers_customer on public.ground_transfers (customer_id, created_at desc);
create index if not exists ground_transfers_purge on public.ground_transfers (purge_after) where address is not null;
alter table public.ground_transfers enable row level security;
revoke all on public.ground_transfers from anon, authenticated;
grant select on public.ground_transfers to authenticated;
create policy ground_transfers_select on public.ground_transfers for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));

create or replace function public.request_my_transfer(p_request uuid, p_direction text, p_address text, p_pickup timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); r public.travel_requests%rowtype; v_code text; v_id uuid; v_addr text := btrim(p_address);
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and status = 'active') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_direction is null or p_direction not in ('TO_AIRPORT','FROM_AIRPORT') then raise exception 'invalid direction'; end if;
  if v_addr is null or char_length(v_addr) < 5 or char_length(v_addr) > 200 then raise exception 'address must be 5 to 200 characters'; end if;
  if p_pickup is null or p_pickup < now() - interval '1 hour' or p_pickup > now() + interval '60 days' then raise exception 'pickup time is out of range'; end if;
  select * into r from public.travel_requests where id = p_request and customer_id = v_uid;
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  v_code := case when p_direction = 'TO_AIRPORT' then r.origin_code else r.destination_code end;
  if v_code is null then raise exception 'the request has no airport for this direction'; end if;
  if exists (select 1 from public.ground_transfers where travel_request_id = r.id and direction = p_direction and status in ('REQUESTED','EXECUTED')) then
    raise exception 'a transfer already exists for this direction'; end if;
  insert into public.ground_transfers (customer_id, travel_request_id, direction, airport_code, address, pickup_at, purge_after)
  values (v_uid, r.id, p_direction, v_code, v_addr, p_pickup, p_pickup + interval '24 hours') returning id into v_id;
  perform public._loop_audit('transfer_requested','ground_transfer', v_id, jsonb_build_object('direction', p_direction, 'request', r.id));
  return jsonb_build_object('id', v_id, 'status', 'REQUESTED');
end $$;

create or replace function public.list_my_transfers()
returns table(id uuid, travel_request_id uuid, direction text, airport_code text, pickup_at timestamptz, status text, broker_note text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.travel_request_id, t.direction, t.airport_code, t.pickup_at, t.status, t.broker_note
    from public.ground_transfers t where t.customer_id = (select auth.uid()) and t.status <> 'CANCELLED' order by t.pickup_at $$;

create or replace function public.cancel_my_transfer(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); n int;
begin
  if v_uid is null then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.ground_transfers set status = 'CANCELLED', decided_at = now(), address = null where id = p_id and customer_id = v_uid and status = 'REQUESTED';
  get diagnostics n = row_count;
  if n = 1 then perform public._loop_audit('transfer_cancelled','ground_transfer', p_id, '{}'::jsonb); end if;
  return n = 1;
end $$;

create or replace function public.list_transfers_staff()
returns table(id uuid, customer_name text, origin_code text, destination_code text, direction text, airport_code text, address text, pickup_at timestamptz, status text, broker_note text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query select t.id, p.full_name, r.origin_code, r.destination_code, t.direction, t.airport_code, t.address, t.pickup_at, t.status, t.broker_note, t.created_at
    from public.ground_transfers t join public.travel_requests r on r.id = t.travel_request_id left join public.profiles p on p.id = t.customer_id
   where t.status in ('REQUESTED','EXECUTED') order by (t.status = 'REQUESTED') desc, t.pickup_at limit 100;
end $$;

create or replace function public.staff_set_transfer(p_id uuid, p_status text, p_note text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_status not in ('EXECUTED','UNAVAILABLE') then raise exception 'invalid status'; end if;
  update public.ground_transfers set status = p_status, broker_note = left(nullif(btrim(p_note),''),300), decided_at = now(), decided_by = (select auth.uid()),
         address = case when p_status = 'UNAVAILABLE' then null else address end
   where id = p_id and status = 'REQUESTED';
  get diagnostics n = row_count;
  if n = 1 then perform public._loop_audit('transfer_' || lower(p_status),'ground_transfer', p_id, '{}'::jsonb); end if;
  return n = 1;
end $$;

create or replace function public.purge_transfer_addresses()
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.ground_transfers set address = null where address is not null and purge_after < now();
  get diagnostics n = row_count; return n;
end $$;

revoke execute on function public.request_my_transfer(uuid,text,text,timestamptz), public.list_my_transfers(), public.cancel_my_transfer(uuid), public.list_transfers_staff(), public.staff_set_transfer(uuid,text,text), public.purge_transfer_addresses() from public, anon, authenticated;
grant execute on function public.request_my_transfer(uuid,text,text,timestamptz), public.list_my_transfers(), public.cancel_my_transfer(uuid), public.list_transfers_staff(), public.staff_set_transfer(uuid,text,text) to authenticated;
select cron.schedule('transfer-address-purge', '50 4 * * *', $cron$select public.purge_transfer_addresses()$cron$);
