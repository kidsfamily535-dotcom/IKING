-- Customer screen: besides his own trip, the customer can note an empty leg he knows of (a lead).
-- Same table, same RLS (own rows only). kind separates a real trip of his from an empty-leg lead.
-- An EMPTY_LEG row is CUSTOMER_PROVIDED: it never becomes an availability or an opportunity by itself;
-- the broker verifies it first (aircraft_availability is untouched by this migration).
alter table public.customer_trips
  add column if not exists kind text not null default 'TRIP',
  add column if not exists seats integer;
alter table public.customer_trips
  add constraint customer_trips_kind_check check (kind in ('TRIP','EMPTY_LEG')),
  add constraint customer_trips_seats_check check (seats is null or (seats between 1 and 40)),
  add constraint customer_trips_seats_only_leg check (kind = 'EMPTY_LEG' or seats is null);
