create table if not exists public.operator_desks(
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  contact text check (char_length(contact) <= 200),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  first_opened_at timestamptz,
  created_by uuid references public.profiles(id));
create table if not exists public.operator_leg_submissions(
  id uuid primary key default gen_random_uuid(),
  desk_id uuid not null references public.operator_desks(id),
  origin_code text not null references public.airports(iata_code),
  destination_code text references public.airports(iata_code),
  departure_from timestamptz not null,
  departure_until timestamptz not null,
  aircraft_model text not null check (char_length(trim(aircraft_model)) between 2 and 80),
  seats integer not null check (seats between 1 and 40),
  indicative_price numeric check (indicative_price > 0),
  currency text check (currency in ('USD','SAR','AED')),
  notes text check (char_length(notes) <= 300),
  status text not null default 'RECEIVED' check (status in ('RECEIVED','WITHDRAWN','REJECTED','CONVERTED')),
  created_at timestamptz not null default now(),
  constraint sub_route check (destination_code is null or destination_code <> origin_code),
  constraint sub_window check (departure_until >= departure_from),
  constraint sub_price_cur check (indicative_price is null or currency is not null));
alter table public.operator_desks enable row level security;
alter table public.operator_leg_submissions enable row level security;
revoke all on public.operator_desks, public.operator_leg_submissions from anon, authenticated;

create or replace function public.loop_issue_desk_link(p_name text, p_contact text default null, p_ttl_days integer default 30)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare v_tok text; v_id uuid;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode='42501'; end if;
  if p_ttl_days is null or p_ttl_days < 1 or p_ttl_days > 180 then raise exception 'lifetime must be 1 to 180 days'; end if;
  v_tok := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.operator_desks(name,contact,token_hash,expires_at,created_by)
  values (trim(p_name), left(p_contact,200), encode(extensions.digest(v_tok,'sha256'),'hex'), now()+make_interval(days=>p_ttl_days), (select auth.uid()))
  returning id into v_id;
  perform public._loop_audit('desk_link_issued','operator_desk',v_id,jsonb_build_object('ttl_days',p_ttl_days));
  return jsonb_build_object('id',v_id,'token',v_tok);
end $f$;

create or replace function public.loop_revoke_desk_link(p_desk uuid)
returns void language plpgsql security definer set search_path to '' as $f$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode='42501'; end if;
  update public.operator_desks set revoked_at = now() where id = p_desk and revoked_at is null;
  perform public._loop_audit('desk_link_revoked','operator_desk',p_desk,'{}'::jsonb);
end $f$;

create or replace function public.operator_desk_view(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare d public.operator_desks%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','INVALID'); end if;
  select * into d from public.operator_desks where token_hash = encode(extensions.digest(p_token,'sha256'),'hex');
  if not found or d.revoked_at is not null then return jsonb_build_object('state','INVALID'); end if;
  if d.expires_at < now() then return jsonb_build_object('state','EXPIRED'); end if;
  if d.first_opened_at is null then
    update public.operator_desks set first_opened_at = now() where id = d.id;
    perform public._loop_audit('desk_link_opened','operator_desk',d.id,'{}'::jsonb);
  end if;
  return jsonb_build_object('state','OPEN','operator_name',d.name,'expires_at',d.expires_at,
    'airports',(select coalesce(jsonb_agg(jsonb_build_object('code',iata_code,'ar',name_ar,'en',name_en) order by country_code,iata_code),'[]'::jsonb) from public.airports where lat is not null),
    'models',(select coalesce(jsonb_agg(model order by model),'[]'::jsonb) from public.aircraft_models),
    'legs',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'origin',s.origin_code,'destination',s.destination_code,'from',s.departure_from,'until',s.departure_until,
       'model',s.aircraft_model,'seats',s.seats,'price',s.indicative_price,'currency',s.currency,'status',s.status) order by s.created_at desc),'[]'::jsonb)
       from (select * from public.operator_leg_submissions where desk_id = d.id order by created_at desc limit 20) s));
end $f$;

create or replace function public.operator_desk_add_leg(p_token text, p_origin text, p_destination text, p_from timestamptz, p_until timestamptz,
  p_model text, p_seats integer, p_price numeric default null, p_currency text default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare d public.operator_desks%rowtype; v_id uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'invalid link' using errcode='42501'; end if;
  select * into d from public.operator_desks where token_hash = encode(extensions.digest(p_token,'sha256'),'hex') for update;
  if not found or d.revoked_at is not null then raise exception 'invalid link' using errcode='42501'; end if;
  if d.expires_at < now() then raise exception 'link expired' using errcode='42501'; end if;
  if p_from is null or p_until is null or p_until < p_from then raise exception 'invalid departure window'; end if;
  if p_until < now() then raise exception 'departure window already passed'; end if;
  if p_from > now() + interval '30 days' then raise exception 'departure window too far ahead'; end if;
  if p_destination is not null and p_destination = '' then p_destination := null; end if;
  if (select count(*) from public.operator_leg_submissions where desk_id = d.id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'daily limit reached'; end if;
  insert into public.operator_leg_submissions(desk_id,origin_code,destination_code,departure_from,departure_until,aircraft_model,seats,indicative_price,currency,notes)
  values (d.id,p_origin,p_destination,p_from,p_until,trim(p_model),p_seats,p_price,p_currency,left(nullif(trim(p_notes),''),300)) returning id into v_id;
  perform public._loop_audit('desk_leg_submitted','operator_leg_submission',v_id,jsonb_build_object('desk',d.id));
  return jsonb_build_object('ok',true,'id',v_id);
end $f$;

create or replace function public.operator_desk_withdraw_leg(p_token text, p_leg uuid)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare d public.operator_desks%rowtype; n int;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'invalid link' using errcode='42501'; end if;
  select * into d from public.operator_desks where token_hash = encode(extensions.digest(p_token,'sha256'),'hex');
  if not found or d.revoked_at is not null or d.expires_at < now() then raise exception 'invalid link' using errcode='42501'; end if;
  update public.operator_leg_submissions set status='WITHDRAWN' where id = p_leg and desk_id = d.id and status='RECEIVED';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'cannot withdraw'; end if;
  perform public._loop_audit('desk_leg_withdrawn','operator_leg_submission',p_leg,'{}'::jsonb);
  return jsonb_build_object('ok',true);
end $f$;

create or replace function public.list_leg_submissions()
returns table(id uuid, desk_id uuid, operator_name text, operator_contact text, origin_code text, destination_code text, departure_from timestamptz,
  departure_until timestamptz, aircraft_model text, seats integer, indicative_price numeric, currency text, notes text, status text, created_at timestamptz, model_known boolean)
language sql stable security definer set search_path to '' as $f$
  select s.id, s.desk_id, d.name, d.contact, s.origin_code, s.destination_code, s.departure_from, s.departure_until, s.aircraft_model, s.seats,
         s.indicative_price, s.currency, s.notes, s.status, s.created_at, exists(select 1 from public.aircraft_models m where m.model = s.aircraft_model)
  from public.operator_leg_submissions s join public.operator_desks d on d.id = s.desk_id
  where (select public.is_staff()) order by s.created_at desc limit 100 $f$;

create or replace function public.list_desk_links()
returns table(id uuid, name text, contact text, expires_at timestamptz, revoked_at timestamptz, first_opened_at timestamptz)
language sql stable security definer set search_path to '' as $f$
  select id, name, contact, expires_at, revoked_at, first_opened_at from public.operator_desks where (select public.is_staff()) order by created_at desc limit 50 $f$;

revoke all on function public.loop_issue_desk_link(text,text,integer), public.loop_revoke_desk_link(uuid), public.list_leg_submissions(), public.list_desk_links() from public, anon;
grant execute on function public.loop_issue_desk_link(text,text,integer), public.loop_revoke_desk_link(uuid), public.list_leg_submissions(), public.list_desk_links() to authenticated;
revoke all on function public.operator_desk_view(text), public.operator_desk_add_leg(text,text,text,timestamptz,timestamptz,text,integer,numeric,text,text), public.operator_desk_withdraw_leg(text,uuid) from public;
grant execute on function public.operator_desk_view(text), public.operator_desk_add_leg(text,text,text,timestamptz,timestamptz,text,integer,numeric,text,text), public.operator_desk_withdraw_leg(text,uuid) to anon, authenticated;
