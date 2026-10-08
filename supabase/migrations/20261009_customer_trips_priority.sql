-- Applied on Supabase "I KING" (2026-10-09). What matters most on this trip, stated by the customer only (CUSTOMER_PROVIDED). Nullable; the customer can change or clear it.
-- Own rows via the existing RLS policies (ct_*_own), same as companions.
alter table public.customer_trips add column if not exists priority text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='customer_trips_priority_allowed') then
    alter table public.customer_trips add constraint customer_trips_priority_allowed
      check (priority is null or priority in ('EARLY','PRIVACY','COMFORT','NO_WAIT'));
  end if;
end $$;
