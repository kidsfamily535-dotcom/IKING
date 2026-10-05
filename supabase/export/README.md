# I KING — database export (2026-10-05)

Source: Supabase project "I KING" (eu-west-1). 32 tables, 13 enums, 98 functions, 43 RLS policies, 4 views, 8 pg_cron jobs, 37 applied migrations.

## Files
- `full_schema.sql` — structure only (no data). Order: extensions → enums → tables → constraints → indexes → views → functions → RLS/policies → cron.
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
4. Test on a Supabase branch or scratch project first — this file was generated from catalog introspection and has not been replayed.

## Known gaps to verify
- No triggers were found in the `public` schema; confirm state transitions are enforced by RPC functions rather than triggers.
- Table grants (migration `revoke_anon_table_privileges`) are not in the export; re-apply or add `grant/revoke` statements.
