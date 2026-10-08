create table public.trip_watches(
  trip_id uuid primary key references public.customer_trips(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  alerts_opt_in boolean not null default false,
  opted_in_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  last_cat text check (last_cat in ('MVFR','IFR','LIFR')),
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.trip_watches(customer_id);
alter table public.trip_watches enable row level security;
create policy tw_select_own on public.trip_watches for select to authenticated using (customer_id = (select auth.uid()));
revoke all on public.trip_watches from anon, public, authenticated;
grant select (trip_id, alerts_opt_in, opted_in_at) on public.trip_watches to authenticated;

create table public.trip_alert_log(
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.customer_trips(id) on delete set null,
  customer_id uuid,
  mode text not null check (mode in ('DRY_RUN','SENT','FAILED')),
  category text,
  payload jsonb,
  error text,
  created_at timestamptz not null default now()
);
alter table public.trip_alert_log enable row level security;
revoke all on public.trip_alert_log from anon, public, authenticated;

create table public.trip_alert_config(
  id boolean primary key default true check (id),
  live boolean not null default false,
  checked_at timestamptz
);
insert into public.trip_alert_config(id, live) values (true, false);
alter table public.trip_alert_config enable row level security;
revoke all on public.trip_alert_config from anon, public, authenticated;

create or replace function public.add_watched_trip(p_origin text, p_destination text, p_departure timestamptz, p_alerts boolean)
 returns uuid language plpgsql security definer set search_path to '' as $f$
declare tid uuid; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into public.customer_trips(customer_id, origin_code, destination_code, departure_at, kind)
    values (uid, upper(p_origin), upper(p_destination), p_departure, 'TRIP') returning id into tid;
  insert into public.trip_watches(trip_id, customer_id, alerts_opt_in, opted_in_at)
    values (tid, uid, coalesce(p_alerts,false), case when p_alerts then now() end);
  return tid;
end $f$;

create or replace function public.set_trip_alerts(p_trip_id uuid, p_on boolean)
 returns boolean language plpgsql security definer set search_path to '' as $f$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.customer_trips where id = p_trip_id and customer_id = uid and kind = 'TRIP') then return false; end if;
  insert into public.trip_watches(trip_id, customer_id, alerts_opt_in, opted_in_at)
    values (p_trip_id, uid, p_on, case when p_on then now() end)
  on conflict (trip_id) do update set alerts_opt_in = excluded.alerts_opt_in,
    opted_in_at = case when excluded.alerts_opt_in then coalesce(public.trip_watches.opted_in_at, now()) else public.trip_watches.opted_in_at end,
    last_cat = case when excluded.alerts_opt_in then public.trip_watches.last_cat else null end;
  return true;
end $f$;

create or replace function public.unsubscribe_trip_alerts(p_token uuid)
 returns boolean language sql security definer set search_path to '' as $f$
  with u as (update public.trip_watches set alerts_opt_in = false, last_cat = null where unsubscribe_token = p_token returning 1)
  select exists (select 1 from u) $f$;

create or replace function public.trip_alert_status()
 returns jsonb language sql stable security definer set search_path to '' as $f$
  select jsonb_build_object('live', coalesce((select live and checked_at > now() - interval '1 hour' from public.trip_alert_config), false)) $f$;

create or replace function public.trip_alert_due()
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare out jsonb := '[]'::jsonb; r record; l record; legs jsonb; worst text; cat text; wind int; vis text; alt record; rk int;
begin
  for r in
    select tw.trip_id, tw.customer_id, tw.unsubscribe_token tok, tw.last_cat, tw.last_sent_at,
           ct.origin_code o, ct.destination_code d, ct.departure_at dep
    from public.trip_watches tw join public.customer_trips ct on ct.id = tw.trip_id
    where tw.alerts_opt_in and ct.kind = 'TRIP' and ct.departure_at > now() and ct.departure_at <= now() + interval '36 hours'
  loop
    legs := '[]'::jsonb; worst := null; rk := 0;
    for l in select * from (values (r.o, 'dep'), (r.d, 'arr')) v(code, leg) loop
      cat := null; wind := null; vis := null;
      select m.flight_category, m.wind_speed_kt, m.visibility into cat, wind, vis
        from public.weather_snapshots m
        where m.airport_code = l.code and m.report_type = 'METAR' and m.issued_at >= now() - interval '150 minutes'
        order by m.issued_at desc limit 1;
      if cat in ('MVFR','IFR','LIFR') then
        select q.* into alt from (
          select a2.iata_code code, a2.name_en, a2.name_ar,
                 round(6371 * acos(least(1, sin(radians(a1.lat))*sin(radians(a2.lat)) + cos(radians(a1.lat))*cos(radians(a2.lat))*cos(radians(a2.lon - a1.lon)))))::int km
          from public.airports a1, public.airports a2
          where a1.iata_code = l.code and a2.iata_code <> l.code and a1.lat is not null and a2.lat is not null) q
        where q.km <= 450 and exists (
          select 1 from public.weather_snapshots w where w.airport_code = q.code and w.report_type = 'METAR' and w.flight_category = 'VFR'
            and w.issued_at >= now() - interval '150 minutes'
            and w.issued_at = (select max(w2.issued_at) from public.weather_snapshots w2 where w2.airport_code = q.code and w2.report_type = 'METAR'))
        order by q.km limit 1;
        legs := legs || jsonb_build_object('leg', l.leg, 'code', l.code, 'cat', cat, 'wind_kt', wind, 'vis', vis,
          'alt', case when alt.code is null then null else jsonb_build_object('code', alt.code, 'name_en', alt.name_en, 'name_ar', alt.name_ar, 'km', alt.km) end);
        if (case cat when 'LIFR' then 3 when 'IFR' then 2 else 1 end) > rk then rk := case cat when 'LIFR' then 3 when 'IFR' then 2 else 1 end; worst := cat; end if;
      end if;
    end loop;
    if worst is null then
      if r.last_cat is not null then update public.trip_watches set last_cat = null where trip_id = r.trip_id; end if;
      continue;
    end if;
    if (r.last_cat is null or rk > (case r.last_cat when 'LIFR' then 3 when 'IFR' then 2 else 1 end))
       and (r.last_sent_at is null or r.last_sent_at < now() - interval '6 hours') then
      out := out || jsonb_build_object('trip_id', r.trip_id, 'customer_id', r.customer_id, 'token', r.tok, 'origin', r.o, 'destination', r.d,
                                       'departure_at', r.dep, 'worst', worst, 'legs', legs);
    end if;
  end loop;
  return out;
end $f$;

create or replace function public.trip_alert_mark(p_trip_id uuid, p_customer uuid, p_cat text, p_mode text, p_payload jsonb, p_error text)
 returns void language plpgsql security definer set search_path to '' as $f$
begin
  insert into public.trip_alert_log(trip_id, customer_id, mode, category, payload, error) values (p_trip_id, p_customer, p_mode, p_cat, p_payload, p_error);
  if p_mode in ('SENT','DRY_RUN') then update public.trip_watches set last_cat = p_cat, last_sent_at = now() where trip_id = p_trip_id; end if;
end $f$;

create or replace function public.trip_alert_set_live(p_live boolean)
 returns void language sql security definer set search_path to '' as $f$
  update public.trip_alert_config set live = p_live, checked_at = now() where id $f$;

create or replace function public.eye_notify_trips()
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare resp private_ext.http_response; sec text;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'eye_cron_secret';
  perform private_ext.http_set_curlopt('CURLOPT_TIMEOUT_MS', '30000');
  resp := private_ext.http(('POST', 'https://yiklciblxwymcxxszkty.supabase.co/functions/v1/notify-trip-watchers',
            array[private_ext.http_header('x-cron-secret', sec)], 'application/json', '{}')::private_ext.http_request);
  return jsonb_build_object('status', resp.status, 'body', left(coalesce(resp.content, ''), 600));
exception when others then
  return jsonb_build_object('error', sqlerrm);
end $f$;

revoke all on function public.add_watched_trip(text,text,timestamptz,boolean), public.set_trip_alerts(uuid,boolean), public.unsubscribe_trip_alerts(uuid),
  public.trip_alert_status(), public.trip_alert_due(), public.trip_alert_mark(uuid,uuid,text,text,jsonb,text), public.trip_alert_set_live(boolean), public.eye_notify_trips() from public, anon, authenticated;
grant execute on function public.add_watched_trip(text,text,timestamptz,boolean), public.set_trip_alerts(uuid,boolean) to authenticated;
grant execute on function public.unsubscribe_trip_alerts(uuid), public.trip_alert_status() to anon, authenticated;
grant execute on function public.trip_alert_due(), public.trip_alert_mark(uuid,uuid,text,text,jsonb,text), public.trip_alert_set_live(boolean) to service_role;
select cron.schedule('trip-alerts', '5-59/10 * * * *', 'select public.eye_notify_trips()');
