-- ===== معاملات الحساب (قابلة للتعديل بلا كود) =====
create table public.day_plan_params(
  key text primary key, value numeric not null, note text);
insert into public.day_plan_params(key,value,note) values
 ('ground_minutes',45,'نقل أرضي تقديري بين المطار والموقع (دقائق)'),
 ('first_leg_buffer_minutes',60,'فسحة قبل أول حدث (دقائق)'),
 ('cruise_kmh',750,'سرعة تقديرية للطيران'),
 ('overhead_minutes',25,'زمن إقلاع وهبوط تقديري'),
 ('route_factor',1.05,'معامل انحراف المسار عن الخط المستقيم'),
 ('comfortable_min',45,'أدنى هامش يُعد مريحًا (دقائق)'),
 ('tight_min',15,'أدنى هامش يُعد ضيقًا لكن ممكنًا (دقائق)'),
 ('late_arrival_minutes',1410,'وصول بعد هذه الدقيقة من اليوم (محليًا) يُعد متأخرًا');
alter table public.day_plan_params enable row level security;
create policy dpp_select on public.day_plan_params for select to authenticated using (true);
create policy dpp_update_admin on public.day_plan_params for update to authenticated using ((select is_admin())) with check ((select is_admin()));

-- ===== جلسات الأحداث الموقوتة (مرتبطة برادار gcc_events) =====
create table public.gcc_event_sessions(
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.gcc_events(id) on delete restrict,
  title_ar text not null,
  airport_code text not null references public.airports(iata_code),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_source truth_source not null default 'UNVERIFIED_WEB',
  evidence jsonb not null default '[]'::jsonb,
  time_verified_at timestamptz,
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','CANCELLED')),
  is_demo boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  constraint ses_time check (ends_at > starts_at and ends_at - starts_at <= interval '16 hours'),
  constraint ses_publish check (status <> 'PUBLISHED' or is_demo or (
    event_id is not null and time_verified_at is not null and time_source <> 'AI_INFERRED'
    and jsonb_typeof(evidence)='array' and jsonb_array_length(evidence) >= 1))
);
create index ses_pub_idx on public.gcc_event_sessions(starts_at) where status='PUBLISHED';
alter table public.gcc_event_sessions enable row level security;
create policy ses_select on public.gcc_event_sessions for select to authenticated
  using ((status='PUBLISHED' and ends_at > now()) or (select is_staff()));
create policy ses_insert_admin on public.gcc_event_sessions for insert to authenticated with check ((select is_admin()));
create policy ses_update_admin on public.gcc_event_sessions for update to authenticated using ((select is_admin())) with check ((select is_admin()));

create function public._gcc_session_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v text;
begin
  if new.status='PUBLISHED' and not new.is_demo then
    select verification into v from public.gcc_events where id=new.event_id;
    if v is distinct from 'CROSS_CHECKED' then
      raise exception 'cannot publish session: parent event is not CROSS_CHECKED';
    end if;
  end if;
  return new;
end$$;
create trigger ses_guard before insert or update on public.gcc_event_sessions for each row execute function public._gcc_session_guard();

create function public._audit_gcc_session() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public._loop_audit('gcc_session_'||lower(tg_op),'gcc_event_sessions',new.id,
    jsonb_build_object('status',new.status,'is_demo',new.is_demo,'title',new.title_ar));
  return new;
end$$;
create trigger ses_audit after insert or update on public.gcc_event_sessions for each row execute function public._audit_gcc_session();

-- ===== خطط اليوم =====
create table public.day_plans(
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  start_airport text not null references public.airports(iata_code),
  plan_date date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','REQUESTED','BROKER_REVIEW','CANCELLED','EXPIRED')),
  worst_status text not null default 'UNKNOWN' check (worst_status in ('COMFORTABLE','TIGHT','INSUFFICIENT','UNKNOWN')),
  return_arrival_at timestamptz,
  suggested_remove_session_id uuid references public.gcc_event_sessions(id),
  params_snapshot jsonb,
  computed_at timestamptz,
  is_demo boolean not null default false,
  requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now());
create index dp_cust_idx on public.day_plans(customer_id);
create table public.day_plan_sessions(
  plan_id uuid not null references public.day_plans(id) on delete cascade,
  session_id uuid not null references public.gcc_event_sessions(id),
  primary key(plan_id,session_id));
create index dps_ses_idx on public.day_plan_sessions(session_id);
create table public.day_plan_stops(
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.day_plans(id) on delete cascade,
  seq int not null,
  kind text not null check (kind in ('SESSION','LEG')),
  session_id uuid references public.gcc_event_sessions(id),
  from_airport text, to_airport text,
  starts_at timestamptz, ends_at timestamptz,
  flight_minutes int, margin_minutes int,
  margin_status text check (margin_status is null or margin_status in ('COMFORTABLE','TIGHT','INSUFFICIENT','UNKNOWN')),
  time_basis text not null check (time_basis in ('ESTIMATED','SOURCE')),
  unique(plan_id,seq),
  check ((kind='SESSION' and session_id is not null) or (kind='LEG' and from_airport is not null and to_airport is not null)));
alter table public.day_plans enable row level security;
alter table public.day_plan_sessions enable row level security;
alter table public.day_plan_stops enable row level security;
create policy dp_select on public.day_plans for select to authenticated using (customer_id=(select auth.uid()) or (select is_staff()));
create policy dps_select on public.day_plan_sessions for select to authenticated using (exists(select 1 from public.day_plans p where p.id=plan_id and (p.customer_id=(select auth.uid()) or (select is_staff()))));
create policy dpst_select on public.day_plan_stops for select to authenticated using (exists(select 1 from public.day_plans p where p.id=plan_id and (p.customer_id=(select auth.uid()) or (select is_staff()))));

create function public._day_plan_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status is distinct from old.status and not (
    (old.status='DRAFT' and new.status in ('REQUESTED','CANCELLED','EXPIRED')) or
    (old.status='REQUESTED' and new.status in ('BROKER_REVIEW','CANCELLED','EXPIRED')) or
    (old.status='BROKER_REVIEW' and new.status in ('CANCELLED','EXPIRED'))) then
    raise exception 'illegal day plan transition % -> %', old.status, new.status;
  end if;
  return new;
end$$;
create trigger dp_guard before update on public.day_plans for each row execute function public._day_plan_guard();

-- ===== دوال الحساب القطعية =====
create function public.day_plan_param(p_key text) returns numeric language sql stable security definer set search_path=public,pg_temp as $$
  select value from public.day_plan_params where key=p_key $$;

create function public.day_plan_flight_minutes(p_from text,p_to text) returns int language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a public.airports; b public.airports; d double precision;
begin
  select * into a from public.airports where iata_code=p_from;
  select * into b from public.airports where iata_code=p_to;
  if a.lat is null or a.lon is null or b.lat is null or b.lon is null then return null; end if;
  d := 2*6371*asin(sqrt(power(sin(radians(b.lat-a.lat)/2),2)+cos(radians(a.lat))*cos(radians(b.lat))*power(sin(radians(b.lon-a.lon)/2),2)));
  return round(public.day_plan_param('overhead_minutes') + (d::numeric*public.day_plan_param('route_factor'))/(public.day_plan_param('cruise_kmh')/60.0))::int;
end$$;

create function public.day_plan_margin_status(p_m int) returns text language sql stable security definer set search_path=public,pg_temp as $$
  select case when p_m is null then 'UNKNOWN'
    when p_m >= public.day_plan_param('comfortable_min') then 'COMFORTABLE'
    when p_m >= public.day_plan_param('tight_min') then 'TIGHT' else 'INSUFFICIENT' end $$;

create function public._day_plan_tz(p_airport text) returns text language sql stable security definer set search_path=public,pg_temp as $$
  select case (select country_code from public.airports where iata_code=p_airport) when 'AE' then 'Asia/Dubai' else 'Asia/Riyadh' end $$;

create function public._day_plan_validate(p_start text,p_date date,p_ids uuid[]) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n int; ok int; demo boolean;
begin
  n := coalesce(cardinality(p_ids),0);
  if n < 1 or n > 4 then raise exception 'a day plan needs 1 to 4 sessions'; end if;
  if not exists(select 1 from public.airports where iata_code=p_start) then raise exception 'unknown start airport'; end if;
  select count(*), coalesce(bool_or(is_demo),false) into ok, demo from public.gcc_event_sessions
   where id = any(p_ids) and status='PUBLISHED' and ends_at > now()
     and (starts_at at time zone 'Asia/Riyadh')::date = p_date;
  if ok <> n then raise exception 'one or more sessions are unavailable, expired, or not on the plan date'; end if;
  return demo;
end$$;

create function public._day_plan_compute(p_plan uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  pl public.day_plans; s public.gcc_event_sessions;
  cur_air text; cur_end timestamptz; f int; dep timestamptz; arr timestamptz; mg int; st text;
  n int := 0; rnk int := 0; r int; sugg uuid; ret_arr timestamptz;
  g int; fb int; late int; tz text; lmin int; ldate date; worst text;
begin
  select * into pl from public.day_plans where id=p_plan;
  if not found then raise exception 'day plan not found'; end if;
  g := public.day_plan_param('ground_minutes')::int;
  fb := public.day_plan_param('first_leg_buffer_minutes')::int;
  late := public.day_plan_param('late_arrival_minutes')::int;
  delete from public.day_plan_stops where plan_id=p_plan;
  cur_air := pl.start_airport; cur_end := null;
  for s in select x.* from public.gcc_event_sessions x join public.day_plan_sessions ps on ps.session_id=x.id
           where ps.plan_id=p_plan order by x.starts_at loop
    mg := null; st := 'COMFORTABLE';
    if s.airport_code <> cur_air then
      f := public.day_plan_flight_minutes(cur_air, s.airport_code);
      n := n+1;
      if f is null then
        insert into public.day_plan_stops(plan_id,seq,kind,from_airport,to_airport,margin_status,time_basis)
          values (p_plan,n,'LEG',cur_air,s.airport_code,'UNKNOWN','ESTIMATED');
        st := 'UNKNOWN';
      else
        if cur_end is null then dep := s.starts_at - make_interval(mins => g+f+fb);
        else dep := cur_end + make_interval(mins => g); end if;
        arr := dep + make_interval(mins => f);
        mg := floor(extract(epoch from (s.starts_at - (arr + make_interval(mins => g))))/60)::int;
        st := public.day_plan_margin_status(mg);
        insert into public.day_plan_stops(plan_id,seq,kind,from_airport,to_airport,starts_at,ends_at,flight_minutes,time_basis)
          values (p_plan,n,'LEG',cur_air,s.airport_code,dep,arr,f,'ESTIMATED');
      end if;
    elsif cur_end is not null then
      mg := floor(extract(epoch from (s.starts_at - cur_end))/60)::int;
      st := public.day_plan_margin_status(mg);
    end if;
    n := n+1;
    insert into public.day_plan_stops(plan_id,seq,kind,session_id,from_airport,to_airport,starts_at,ends_at,margin_minutes,margin_status,time_basis)
      values (p_plan,n,'SESSION',s.id,s.airport_code,s.airport_code,s.starts_at,s.ends_at,mg,st,'SOURCE');
    r := case st when 'COMFORTABLE' then 0 when 'TIGHT' then 1 when 'UNKNOWN' then 2 else 3 end;
    if r > rnk then rnk := r; end if;
    if st='INSUFFICIENT' and sugg is null then sugg := s.id; end if;
    cur_air := s.airport_code; cur_end := s.ends_at;
  end loop;
  if cur_end is not null then
    if cur_air <> pl.start_airport then
      f := public.day_plan_flight_minutes(cur_air, pl.start_airport);
      n := n+1;
      if f is null then
        insert into public.day_plan_stops(plan_id,seq,kind,from_airport,to_airport,margin_status,time_basis)
          values (p_plan,n,'LEG',cur_air,pl.start_airport,'UNKNOWN','ESTIMATED');
        if rnk < 2 then rnk := 2; end if;
      else
        dep := cur_end + make_interval(mins => g); arr := dep + make_interval(mins => f); ret_arr := arr;
        insert into public.day_plan_stops(plan_id,seq,kind,from_airport,to_airport,starts_at,ends_at,flight_minutes,time_basis)
          values (p_plan,n,'LEG',cur_air,pl.start_airport,dep,arr,f,'ESTIMATED');
        tz := public._day_plan_tz(pl.start_airport);
        lmin := extract(hour from (arr at time zone tz))::int*60 + extract(minute from (arr at time zone tz))::int;
        ldate := (arr at time zone tz)::date;
        if (lmin > late or ldate > pl.plan_date) and rnk < 1 then rnk := 1; end if;
      end if;
    else
      ret_arr := cur_end + make_interval(mins => g);
    end if;
  end if;
  worst := case rnk when 0 then 'COMFORTABLE' when 1 then 'TIGHT' when 2 then 'UNKNOWN' else 'INSUFFICIENT' end;
  update public.day_plans set worst_status=worst, return_arrival_at=ret_arr, suggested_remove_session_id=sugg,
    params_snapshot=(select jsonb_object_agg(key,value) from public.day_plan_params), computed_at=now(), updated_at=now()
   where id=p_plan;
  return jsonb_build_object('worst_status',worst,'return_arrival_at',ret_arr,'suggested_remove_session_id',sugg,'stops',n);
end$$;

-- ===== واجهة التطبيق (RPC) =====
create function public.create_day_plan(p_start text,p_date date,p_session_ids uuid[]) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid := auth.uid(); ids uuid[]; demo boolean; pid uuid; res jsonb;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select array(select distinct unnest(p_session_ids)) into ids;
  demo := public._day_plan_validate(p_start,p_date,ids);
  insert into public.day_plans(customer_id,start_airport,plan_date,is_demo) values (uid,p_start,p_date,demo) returning id into pid;
  insert into public.day_plan_sessions(plan_id,session_id) select pid, unnest(ids);
  res := public._day_plan_compute(pid);
  perform public._loop_audit('day_plan_created','day_plans',pid,jsonb_build_object('sessions',ids,'worst',res->>'worst_status'));
  return res || jsonb_build_object('id',pid);
end$$;

create function public.set_day_plan_sessions(p_plan uuid,p_session_ids uuid[]) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid := auth.uid(); pl public.day_plans; ids uuid[]; demo boolean; res jsonb;
begin
  select * into pl from public.day_plans where id=p_plan for update;
  if not found or uid is null or pl.customer_id <> uid then raise exception 'day plan not found'; end if;
  if pl.status <> 'DRAFT' then raise exception 'only a DRAFT plan can be edited'; end if;
  select array(select distinct unnest(p_session_ids)) into ids;
  demo := public._day_plan_validate(pl.start_airport,pl.plan_date,ids);
  delete from public.day_plan_sessions where plan_id=p_plan;
  insert into public.day_plan_sessions(plan_id,session_id) select p_plan, unnest(ids);
  update public.day_plans set is_demo=demo where id=p_plan;
  res := public._day_plan_compute(p_plan);
  return res || jsonb_build_object('id',p_plan);
end$$;

create function public.request_day_plan(p_plan uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid := auth.uid(); pl public.day_plans; res jsonb; open_n int;
begin
  select * into pl from public.day_plans where id=p_plan for update;
  if not found or uid is null or pl.customer_id <> uid then raise exception 'day plan not found'; end if;
  if pl.status <> 'DRAFT' then raise exception 'only a DRAFT plan can be requested'; end if;
  select count(*) into open_n from public.day_plans where customer_id=uid and status in ('REQUESTED','BROKER_REVIEW');
  if open_n >= 5 then raise exception 'too many open day plan requests'; end if;
  perform public._day_plan_validate(pl.start_airport,pl.plan_date,array(select session_id from public.day_plan_sessions where plan_id=p_plan));
  res := public._day_plan_compute(p_plan);
  if res->>'worst_status' in ('INSUFFICIENT','UNKNOWN') then
    raise exception 'day plan is not feasible: %', res->>'worst_status';
  end if;
  update public.day_plans set status='REQUESTED', requested_at=now(), updated_at=now() where id=p_plan;
  perform public._loop_audit('day_plan_requested','day_plans',p_plan,jsonb_build_object('worst',res->>'worst_status','no_operator_contacted',true));
  return res || jsonb_build_object('id',p_plan,'status','REQUESTED');
end$$;

create function public.cancel_day_plan(p_plan uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid := auth.uid(); pl public.day_plans;
begin
  select * into pl from public.day_plans where id=p_plan for update;
  if not found or uid is null or (pl.customer_id <> uid and not public.is_staff()) then raise exception 'day plan not found'; end if;
  update public.day_plans set status='CANCELLED', updated_at=now() where id=p_plan;
  perform public._loop_audit('day_plan_cancelled','day_plans',p_plan,'{}'::jsonb);
end$$;

create function public.staff_review_day_plan(p_plan uuid,p_note text default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_staff() then raise exception 'staff only'; end if;
  update public.day_plans set status='BROKER_REVIEW', updated_at=now() where id=p_plan and status='REQUESTED';
  if not found then raise exception 'plan is not in REQUESTED state'; end if;
  perform public._loop_audit('day_plan_broker_review','day_plans',p_plan,jsonb_build_object('note',p_note));
end$$;

create function public.day_plan_expire_stale() returns int language plpgsql security definer set search_path=public,pg_temp as $$
declare c int;
begin
  if auth.uid() is not null and not public.is_staff() then raise exception 'staff only'; end if;
  update public.day_plans p set status='EXPIRED', updated_at=now()
   where p.status in ('DRAFT','REQUESTED')
     and not exists(select 1 from public.day_plan_sessions ps join public.gcc_event_sessions s on s.id=ps.session_id
                    where ps.plan_id=p.id and s.ends_at > now());
  get diagnostics c = row_count;
  return c;
end$$;

-- ===== الصلاحيات =====
revoke all on public.day_plan_params, public.gcc_event_sessions, public.day_plans, public.day_plan_sessions, public.day_plan_stops from anon, authenticated;
grant select on public.day_plan_params, public.gcc_event_sessions, public.day_plans, public.day_plan_sessions, public.day_plan_stops to authenticated;
grant insert, update on public.gcc_event_sessions to authenticated;
grant update on public.day_plan_params to authenticated;
revoke all on function public._gcc_session_guard(), public._audit_gcc_session(), public._day_plan_guard(), public._day_plan_validate(text,date,uuid[]), public._day_plan_compute(uuid), public._day_plan_tz(text), public.day_plan_param(text), public.day_plan_margin_status(int) from public, anon, authenticated;
revoke all on function public.day_plan_flight_minutes(text,text), public.create_day_plan(text,date,uuid[]), public.set_day_plan_sessions(uuid,uuid[]), public.request_day_plan(uuid), public.cancel_day_plan(uuid), public.staff_review_day_plan(uuid,text), public.day_plan_expire_stale() from public, anon;
grant execute on function public.day_plan_flight_minutes(text,text), public.create_day_plan(text,date,uuid[]), public.set_day_plan_sessions(uuid,uuid[]), public.request_day_plan(uuid), public.cancel_day_plan(uuid), public.staff_review_day_plan(uuid,text), public.day_plan_expire_stale() to authenticated;

-- ===== جلسات تجريبية موسومة (ليست أحداثًا حقيقية) =====
insert into public.gcc_event_sessions(title_ar,airport_code,starts_at,ends_at,time_source,status,is_demo,note) values
 ('لقاء أعمال (تجريبي)','JED','2026-10-14 11:00+03','2026-10-14 12:30+03','INTERNAL_DATABASE','PUBLISHED',true,'DEMO — ليس حدثًا حقيقيًا'),
 ('معرض (تجريبي)','JED','2026-10-14 14:00+03','2026-10-14 15:30+03','INTERNAL_DATABASE','PUBLISHED',true,'DEMO — ليس حدثًا حقيقيًا'),
 ('ملتقى (تجريبي)','DXB','2026-10-14 18:00+04','2026-10-14 19:30+04','INTERNAL_DATABASE','PUBLISHED',true,'DEMO — ليس حدثًا حقيقيًا');
