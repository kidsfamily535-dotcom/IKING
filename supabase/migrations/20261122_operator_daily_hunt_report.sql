-- Operator daily hunt report ("صيد النهارده") + operator replies.
-- Draft is prepared by the team, approved by an admin, then shown ONLY to that operator's company.
-- Items carry no client identity, no scores, no margin (allow-listed keys). No automatic contact.
create table if not exists public.operator_hunt_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.operator_companies(id) on delete cascade,
  report_date date not null default current_date,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','WITHDRAWN')),
  items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 5),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz
);
create table if not exists public.operator_hunt_replies (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.operator_hunt_reports(id) on delete cascade,
  company_id uuid not null references public.operator_companies(id) on delete cascade,
  item_idx int not null check (item_idx between 0 and 4),
  user_id uuid not null references auth.users(id),
  reply text not null check (reply in ('INTERESTED','NOT_FIT','DETAILS','HAVE_AIRCRAFT')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, item_idx, user_id)
);
create index if not exists operator_hunt_reports_company_idx on public.operator_hunt_reports (company_id, created_at desc);
alter table public.operator_hunt_reports enable row level security;
alter table public.operator_hunt_replies enable row level security;
revoke all on public.operator_hunt_reports from anon, authenticated;
revoke all on public.operator_hunt_replies from anon, authenticated;

create or replace function public.admin_hunt_create(p_company uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare e jsonb; k text; v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if not exists (select 1 from public.operator_companies where id=p_company and status='active') then raise exception 'unknown or inactive company'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 5 then raise exception 'items must be 1 to 5'; end if;
  for e in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(e)<>'object' then raise exception 'bad item'; end if;
    for k in select jsonb_object_keys(e) loop
      if k not in ('route','when','reason','confidence') then raise exception 'field % is not allowed in an operator report', k; end if;
    end loop;
    if coalesce(btrim(e->>'route'),'')='' or char_length(e->>'route')>120 then raise exception 'route required (max 120)'; end if;
    if coalesce(btrim(e->>'reason'),'')='' or char_length(e->>'reason')>300 then raise exception 'reason required (max 300)'; end if;
    if char_length(coalesce(e->>'when',''))>120 then raise exception 'when too long'; end if;
    if coalesce(e->>'confidence','') not in ('VERIFIED','ESTIMATED','UNCONFIRMED') then raise exception 'confidence must be VERIFIED, ESTIMATED or UNCONFIRMED'; end if;
  end loop;
  insert into public.operator_hunt_reports(company_id,items,created_by) values (p_company,p_items,(select auth.uid())) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_hunt_review(p_id uuid, p_action text)
returns text language plpgsql security definer set search_path to '' as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  select * into r from public.operator_hunt_reports where id=p_id for update;
  if not found then raise exception 'not found'; end if;
  if p_action='APPROVE' and r.status='DRAFT' then
    update public.operator_hunt_reports set status='APPROVED', approved_by=(select auth.uid()), approved_at=now() where id=p_id;
    return 'APPROVED';
  elsif p_action='WITHDRAW' and r.status in ('DRAFT','APPROVED') then
    update public.operator_hunt_reports set status='WITHDRAWN' where id=p_id;
    return 'WITHDRAWN';
  end if;
  raise exception 'action % not allowed from status %', p_action, r.status;
end $$;

create or replace function public.admin_hunt_list()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select r.id, r.status, r.report_date, r.items, r.created_at, c.name as company,
      coalesce((select jsonb_agg(jsonb_build_object('item_idx',p.item_idx,'reply',p.reply,'note',p.note,'at',p.updated_at) order by p.item_idx) from public.operator_hunt_replies p where p.report_id=r.id),'[]'::jsonb) as replies
    from public.operator_hunt_reports r join public.operator_companies c on c.id=r.company_id
    where r.created_at > now() - interval '30 days' limit 60) x),'[]'::jsonb);
end $$;

create or replace function public.operator_hunt_today()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_c uuid := public._my_active_company();
begin
  if (select auth.uid()) is null then raise exception 'not authenticated' using errcode='28000'; end if;
  if v_c is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select r.id, r.report_date, r.items, r.created_at,
      coalesce((select jsonb_agg(jsonb_build_object('item_idx',p.item_idx,'reply',p.reply,'note',p.note)) from public.operator_hunt_replies p where p.report_id=r.id and p.user_id=(select auth.uid())),'[]'::jsonb) as replies
    from public.operator_hunt_reports r
    where r.company_id=v_c and r.status='APPROVED' and r.approved_at > now() - interval '3 days' limit 5) x),'[]'::jsonb);
end $$;

create or replace function public.operator_hunt_reply(p_report uuid, p_idx int, p_reply text, p_note text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare v_c uuid := public._my_active_company(); r record;
begin
  if (select auth.uid()) is null then raise exception 'not authenticated' using errcode='28000'; end if;
  if v_c is null then raise exception 'no active organization' using errcode='42501'; end if;
  if p_reply not in ('INTERESTED','NOT_FIT','DETAILS','HAVE_AIRCRAFT') then raise exception 'bad reply'; end if;
  select * into r from public.operator_hunt_reports where id=p_report and company_id=v_c and status='APPROVED';
  if not found then raise exception 'report not available'; end if;
  if p_idx < 0 or p_idx >= jsonb_array_length(r.items) then raise exception 'bad item'; end if;
  insert into public.operator_hunt_replies(report_id,company_id,item_idx,user_id,reply,note)
  values (p_report,v_c,p_idx,(select auth.uid()),p_reply,nullif(btrim(coalesce(p_note,'')),''))
  on conflict (report_id,item_idx,user_id) do update set reply=excluded.reply, note=excluded.note, updated_at=now();
end $$;

revoke all on function public.admin_hunt_create(uuid,jsonb), public.admin_hunt_review(uuid,text), public.admin_hunt_list(), public.operator_hunt_today(), public.operator_hunt_reply(uuid,int,text,text) from public, anon;
grant execute on function public.admin_hunt_create(uuid,jsonb), public.admin_hunt_review(uuid,text), public.admin_hunt_list(), public.operator_hunt_today(), public.operator_hunt_reply(uuid,int,text,text) to authenticated;
