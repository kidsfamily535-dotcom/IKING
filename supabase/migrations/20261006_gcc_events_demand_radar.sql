-- Demand Radar v1 (ALREADY APPLIED on Supabase "I KING" as migration gcc_events_demand_radar, 2026-10-06). Reference copy.
-- gcc_events: public calendar FACTS with their sources. Not demand, not availability, names no individuals.
-- An event is CROSS_CHECKED only with >= 2 recorded sources + verified_at (enforced by a CHECK constraint, tested).
-- eye_demand_radar(days): staff-only, read-only. Compares event windows with supply signals at the event airports:
--   tracked aircraft (ADS-B, INFERRED), confirmed availability (non-demo), demo availability (reported separately), open customer requests.
create table public.gcc_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  title_ar text,
  category text not null check (category in ('SEASON','SPORT','ENTERTAINMENT','BUSINESS','EXHIBITION')),
  city text not null,
  airports text[] not null default '{}',
  starts_on date not null,
  ends_on date not null,
  end_basis text not null default 'ANNOUNCED' check (end_basis in ('ANNOUNCED','COMPUTED')),
  source_level public.truth_source not null default 'UNVERIFIED_WEB',
  verification text not null default 'PENDING_VERIFICATION' check (verification in ('PENDING_VERIFICATION','CROSS_CHECKED')),
  sources jsonb not null default '[]'::jsonb,
  verified_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint gcc_events_dates_check check (ends_on >= starts_on),
  constraint gcc_events_cross_check_guard check (
    verification = 'PENDING_VERIFICATION'
    or (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) >= 2 and verified_at is not null))
);
create index gcc_events_dates_idx on public.gcc_events (starts_on, ends_on);
alter table public.gcc_events enable row level security;
revoke all on table public.gcc_events from anon, authenticated;
grant select, insert, update, delete on table public.gcc_events to authenticated;
create policy ge_select_staff on public.gcc_events for select to authenticated using ((select public.is_staff()));
create policy ge_insert_admin on public.gcc_events for insert to authenticated with check ((select public.is_admin()));
create policy ge_update_admin on public.gcc_events for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy ge_delete_admin on public.gcc_events for delete to authenticated using ((select public.is_admin()));

-- Seed (2026-10-06). CROSS_CHECKED: Riyadh Season (opens 21 Oct, 10 weeks; end date COMPUTED), Six Kings Slam (21,22,24 Oct), ADIPEC (2-5 Nov).
-- PENDING_VERIFICATION: WWE Crown Jewel (single source) and six UAE/Saudi events copied from the owner's document, not yet verified.
-- (Seed rows are in the live database; list them with: select title, starts_on, verification from public.gcc_events order by starts_on;)

create or replace function public._audit_gcc_event() returns trigger language plpgsql security definer set search_path to '' as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'event_' || lower(tg_op), 'gcc_event', coalesce(new.id, old.id),
          jsonb_build_object('title', coalesce(new.title, old.title), 'verification', coalesce(new.verification, old.verification)));
  return coalesce(new, old);
end $$;
revoke execute on function public._audit_gcc_event() from public, anon, authenticated;
create trigger trg_audit_gcc_event after insert or update or delete on public.gcc_events for each row execute function public._audit_gcc_event();

-- eye_demand_radar(p_days): see the live function (select pg_get_functiondef('public.eye_demand_radar(integer)'::regprocedure)).
-- Returns jsonb {generated_at, window_days, events[], note}; each event carries verification, sources, and a supply{} block.
-- grants: revoke execute from public, anon; grant execute to authenticated (the function itself requires is_staff()).
