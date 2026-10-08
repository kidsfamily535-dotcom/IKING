-- Applied on Supabase "I KING" (2026-10-08). Who travels with the customer, stated by the customer only (CUSTOMER_PROVIDED).
-- Own rows via the existing RLS policies (ct_*_own). Editable and removable by the customer.
alter table public.customer_trips add column if not exists companions text[] not null default '{}'::text[];
alter table public.customer_trips add constraint customer_trips_companions_allowed check (companions <@ array['CHILDREN','LESS_WALKING','MEETING_AFTER']::text[]);
