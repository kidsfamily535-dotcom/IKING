# I KING — database export (2026-10-05, rev 2)

Source: Supabase project "I KING" (eu-west-1). 32 tables, 13 enums, 98 functions, **16 triggers**, 43 RLS policies, 4 views, 8 pg_cron jobs, 37 applied migrations.

## Files
- `full_schema.sql` — structure only (no data). Order: extensions → enums → tables → constraints → indexes → functions → triggers → views → RLS/policies → cron.
- `seed_reference_data.sql` — reference data only: airports (164), aircraft_models (36), route_price_reference (41, all INDICATIVE), ref_icao_types (35), eye_decision_policy (8), activation_channels (5). Rows flagged `needs_review` keep that flag.

## Not included (by design)
- Operational/customer data (profiles, availability, requests, quotes, sightings, weather rows, audit logs).
- Vault secret `eye_cron_secret` — recreate it in the new project's Vault.
- Edge Functions (e.g. `notify-owner`) — export separately from the repo/Supabase.
- Auth users and settings.

## Before running on a new project
1. Replace the hardcoded project URL in `eye_notify` (`https://yiklciblxwymcxxszkty.supabase.co/functions/v1/notify-owner`) with the new project's URL.
2. Enable `pg_cron`, `http` (isolated schema as in migration phase8c) and `supabase_vault`, create the `eye_cron_secret` secret.
3. Run `full_schema.sql`, then `seed_reference_data.sql`.
4. Test on a Supabase branch or scratch project first.

## Rev 2 fixes (found by replaying on a clean Postgres 16)
- `create extension uuid-ossp` was unquoted (syntax error) → now `"uuid-ossp"`.
- `private_ext` schema + `http` extension were missing, so 5 functions failed → added to section 1.
- Views were created before the functions they call (`is_staff()`, `is_active_operator()`) → views moved after functions.
- **The 16 triggers were missing** (rev 1 wrongly said none exist). They carry the state-transition guards and audit logging → added in section 7, taken from the live DB.

## Verification done (rev 2)
Replayed `full_schema.sql` then `seed_reference_data.sql` on a clean local Postgres 16 with stubs for `auth`, `cron`, `vault`, `anon/authenticated/service_role` and the `http` type: 0 errors; 32 tables, 16 triggers, 98 functions, 43 policies, 4 views; seed counts 164 / 36 / 41 / 35 / 8 / 5. In a rolled-back transaction, `PENDING_VERIFICATION → BOOKED` was rejected by `guard_availability`.
Not verified: real Supabase (pg_cron, vault, http, auth) and RLS behaviour per role.

## Known gaps
- Table grants (migration `revoke_anon_table_privileges`) are not in the export; re-apply or add `grant/revoke` statements.
