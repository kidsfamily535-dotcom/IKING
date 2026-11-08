-- Phase 1: organization types + document-based human verification.
-- Applied live on 2026-11-08 via apply_migration (name: organizations_types_and_verification).
-- Extends operator_companies; nothing is removed. Admin-only RPCs; no anon access.
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='org_kind') then
    create type public.org_kind as enum ('OPERATOR','BROKER','FBO','HANDLER','GROUND_TRANSPORT','YACHT','CONCIERGE','OTHER');
  end if;
end $$;

alter table public.operator_companies
  add column if not exists org_kind public.org_kind not null default 'OPERATOR',
  add column if not exists verification text not null default 'UNVERIFIED',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid,
  add column if not exists countries text[] not null default '{}',
  add column if not exists airports text[] not null default '{}';
alter table public.operator_companies drop constraint if exists operator_companies_verification_chk;
alter table public.operator_companies add constraint operator_companies_verification_chk check (verification in ('UNVERIFIED','VERIFIED','REJECTED'));

create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.operator_companies(id) on delete cascade,
  doc_type text not null check (doc_type in ('AOC','INSURANCE','AIRPORT_LICENCE','COMMERCIAL_REGISTRATION','MYBA_MEMBERSHIP','OTHER')),
  reference_no text check (reference_no is null or char_length(reference_no) <= 120),
  issuer text check (issuer is null or char_length(issuer) <= 160),
  valid_until date,
  evidence_url text check (evidence_url is null or (evidence_url ~ '^https://' and char_length(evidence_url) <= 500)),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  review_note text check (review_note is null or char_length(review_note) <= 300),
  reviewed_by uuid, reviewed_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists company_documents_company_idx on public.company_documents(company_id);
alter table public.company_documents enable row level security;
drop policy if exists company_documents_select on public.company_documents;
create policy company_documents_select on public.company_documents for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.operator_company_members m
         where m.company_id = company_documents.company_id and m.user_id = (select auth.uid()) and m.status = 'active'));
drop policy if exists company_documents_insert on public.company_documents;
create policy company_documents_insert on public.company_documents for insert to authenticated
  with check (status = 'PENDING' and reviewed_by is null and reviewed_at is null and exists (
    select 1 from public.operator_company_members m
    where m.company_id = company_documents.company_id and m.user_id = (select auth.uid()) and m.status = 'active'));

-- Required approved + unexpired documents per kind:
-- OPERATOR: AOC+INSURANCE | BROKER/YACHT/CONCIERGE/OTHER: COMMERCIAL_REGISTRATION | FBO/HANDLER: AIRPORT_LICENCE | GROUND_TRANSPORT: COMMERCIAL_REGISTRATION+INSURANCE
create or replace function public._company_meets_requirements(p_company uuid)
returns boolean language plpgsql stable security definer set search_path to '' as $$
declare k public.org_kind; req text[]; t text;
begin
  select org_kind into k from public.operator_companies where id = p_company;
  if not found then return false; end if;
  req := case k
    when 'OPERATOR' then array['AOC','INSURANCE']
    when 'BROKER' then array['COMMERCIAL_REGISTRATION']
    when 'FBO' then array['AIRPORT_LICENCE']
    when 'HANDLER' then array['AIRPORT_LICENCE']
    when 'GROUND_TRANSPORT' then array['COMMERCIAL_REGISTRATION','INSURANCE']
    else array['COMMERCIAL_REGISTRATION'] end;
  foreach t in array req loop
    if not exists (select 1 from public.company_documents d
        where d.company_id = p_company and d.doc_type = t and d.status = 'APPROVED'
          and ((d.valid_until is null and t = 'COMMERCIAL_REGISTRATION') or d.valid_until >= current_date)) then
      return false;
    end if;
  end loop;
  return true;
end $$;

create or replace function public.admin_set_company_profile(p_company uuid, p_kind public.org_kind, p_countries text[], p_airports text[])
returns void language plpgsql security definer set search_path to '' as $$
declare v_old public.org_kind;
begin
  if not (select public.is_admin()) then raise exception 'not authorized' using errcode='42501'; end if;
  if coalesce(array_length(p_countries,1),0) > 60 or coalesce(array_length(p_airports,1),0) > 120 then raise exception 'too many entries'; end if;
  select org_kind into v_old from public.operator_companies where id = p_company for update;
  if not found then raise exception 'company not found'; end if;
  update public.operator_companies
     set org_kind = p_kind,
         countries = coalesce((select array_agg(distinct upper(btrim(x))) from unnest(p_countries) x where btrim(x) <> ''), '{}'),
         airports  = coalesce((select array_agg(distinct upper(btrim(x))) from unnest(p_airports) x where btrim(x) <> ''), '{}'),
         verification = case when v_old is distinct from p_kind then 'UNVERIFIED' else verification end,
         verified_at = case when v_old is distinct from p_kind then null else verified_at end,
         verified_by = case when v_old is distinct from p_kind then null else verified_by end,
         updated_at = now()
   where id = p_company;
  perform public._loop_audit('company_profile_set','operator_company', p_company, jsonb_build_object('kind', p_kind, 'previous_kind', v_old));
end $$;

create or replace function public.admin_review_document(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare v_co uuid; v_actor uuid := (select auth.uid());
begin
  if not (select public.is_admin()) then raise exception 'not authorized' using errcode='42501'; end if;
  if p_status not in ('APPROVED','REJECTED') then raise exception 'invalid status'; end if;
  if p_status = 'REJECTED' and (p_note is null or char_length(btrim(p_note)) < 3) then raise exception 'rejection reason required'; end if;
  update public.company_documents set status = p_status, review_note = left(p_note,300), reviewed_by = v_actor, reviewed_at = now()
   where id = p_id returning company_id into v_co;
  if v_co is null then raise exception 'document not found'; end if;
  if not public._company_meets_requirements(v_co) then
    update public.operator_companies set verification = 'UNVERIFIED', verified_at = null, verified_by = null
     where id = v_co and verification = 'VERIFIED';
  end if;
  perform public._loop_audit('company_document_'||lower(p_status),'company_document', p_id, jsonb_build_object('company_id', v_co));
end $$;

create or replace function public.admin_set_company_verification(p_company uuid, p_verification text, p_note text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if not (select public.is_admin()) then raise exception 'not authorized' using errcode='42501'; end if;
  if p_verification not in ('VERIFIED','REJECTED','UNVERIFIED') then raise exception 'invalid verification'; end if;
  if not exists (select 1 from public.operator_companies where id = p_company) then raise exception 'company not found'; end if;
  if p_verification = 'VERIFIED' and not public._company_meets_requirements(p_company) then
    raise exception 'requirements not met: approved, unexpired documents are missing';
  end if;
  update public.operator_companies
     set verification = p_verification,
         verified_at = case when p_verification = 'VERIFIED' then now() else null end,
         verified_by = case when p_verification = 'VERIFIED' then v_actor else null end,
         updated_at = now()
   where id = p_company;
  perform public._loop_audit('company_verification_'||lower(p_verification),'operator_company', p_company, jsonb_build_object('note', left(p_note,300)));
end $$;

-- admin_list_operator_companies() was extended to also return org_kind, verification, countries, airports,
-- meets_requirements and documents (see live database for the current definition).

revoke all on function public._company_meets_requirements(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_company_profile(uuid, public.org_kind, text[], text[]) from public, anon;
revoke all on function public.admin_review_document(uuid, text, text) from public, anon;
revoke all on function public.admin_set_company_verification(uuid, text, text) from public, anon;
grant execute on function public.admin_set_company_profile(uuid, public.org_kind, text[], text[]) to authenticated;
grant execute on function public.admin_review_document(uuid, text, text) to authenticated;
grant execute on function public.admin_set_company_verification(uuid, text, text) to authenticated;
