-- Applied on Supabase "I KING" (2026-10-09). "Mission": what the customer has on (meeting / family / occasion) and when he must be there,
-- stated by the customer only (CUSTOMER_PROVIDED). Independent of any jet request or trip: a customer can have a mission with no aircraft at all.
-- arrive_local is the wall-clock time AT THE DESTINATION exactly as typed (timestamp WITHOUT time zone): we never convert it, so it can't shift by the device's zone.
-- Own rows only via RLS, same shape as customer_trips. priority = same four customer-chosen values as customer_trips.priority.
create table public.customer_missions(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  purpose text check (purpose is null or purpose in ('MEETING','FAMILY','EVENT')),
  title text check (title is null or char_length(title) between 1 and 80),
  destination_code text not null references public.airports(iata_code),
  arrive_local timestamp,
  priority text check (priority is null or priority in ('EARLY','PRIVACY','COMFORT','NO_WAIT')),
  source text not null default 'CUSTOMER_PROVIDED',
  created_at timestamptz not null default now()
);
create index on public.customer_missions(customer_id, created_at);
alter table public.customer_missions enable row level security;
create policy cm_select_own on public.customer_missions for select to authenticated using (customer_id = (select auth.uid()));
create policy cm_insert_own on public.customer_missions for insert to authenticated with check (customer_id = (select auth.uid()));
create policy cm_update_own on public.customer_missions for update to authenticated using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy cm_delete_own on public.customer_missions for delete to authenticated using (customer_id = (select auth.uid()));
revoke all on public.customer_missions from anon, public;
grant select, insert, update, delete on public.customer_missions to authenticated;
-- A customer can keep at most 10 missions (prevents unbounded rows from a single account).
create or replace function public.customer_missions_cap() returns trigger language plpgsql set search_path='' as $$
begin
  if (select count(*) from public.customer_missions where customer_id = new.customer_id) >= 10 then
    raise exception 'mission limit reached' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.customer_missions_cap() from public, anon, authenticated;
create trigger customer_missions_cap before insert on public.customer_missions for each row execute function public.customer_missions_cap();
