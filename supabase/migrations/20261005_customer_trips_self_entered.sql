-- Applied on Supabase "I KING". Trips the customer enters himself (booked with another operator). CUSTOMER_PROVIDED. RLS: own rows only.
create table public.customer_trips(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  origin_code text not null references public.airports(iata_code),
  destination_code text not null references public.airports(iata_code),
  departure_at timestamptz,
  operator_name text check (char_length(operator_name) <= 80),
  note text check (char_length(note) <= 300),
  source text not null default 'CUSTOMER_PROVIDED',
  created_at timestamptz not null default now(),
  check (origin_code <> destination_code)
);
create index on public.customer_trips(customer_id, departure_at);
alter table public.customer_trips enable row level security;
create policy ct_select_own on public.customer_trips for select to authenticated using (customer_id = (select auth.uid()));
create policy ct_insert_own on public.customer_trips for insert to authenticated with check (customer_id = (select auth.uid()));
create policy ct_update_own on public.customer_trips for update to authenticated using (customer_id = (select auth.uid())) with check (customer_id = (select auth.uid()));
create policy ct_delete_own on public.customer_trips for delete to authenticated using (customer_id = (select auth.uid()));
revoke all on public.customer_trips from anon, public;
grant select, insert, update, delete on public.customer_trips to authenticated;
