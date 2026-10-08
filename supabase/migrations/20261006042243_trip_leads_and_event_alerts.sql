-- طلبات عملاء حقيقية قادمة من نموذج عام (ليست عملاء مسجلين). الكتابة عبر Edge Function فقط (service role).
create table public.trip_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contact_name text not null check (char_length(contact_name) between 2 and 80),
  contact_channel text not null check (contact_channel in ('whatsapp','phone','email')),
  contact_value text not null check (char_length(contact_value) between 5 and 120),
  origin_code text not null check (origin_code ~ '^[A-Z]{3}$'),
  destination_code text not null check (destination_code ~ '^[A-Z]{3}$' and destination_code <> origin_code),
  travel_date date not null,
  return_date date check (return_date is null or return_date >= travel_date),
  departure_period text not null default 'flexible' check (departure_period in ('morning','afternoon','evening','flexible')),
  passengers integer not null check (passengers between 1 and 40),
  note text check (note is null or char_length(note) <= 500),
  consent boolean not null check (consent),
  source text not null default 'DIRECT' check (source in ('DIRECT','HOTEL','TRAVEL_AGENCY','CONCIERGE','YACHT_BROKER','CORPORATE','OTHER')),
  referral_partner text check (referral_partner is null or char_length(referral_partner) <= 60),
  campaign text check (campaign is null or char_length(campaign) <= 60),
  ip_hash text,
  status text not null default 'NEW' check (status in ('NEW','CONTACTED','QUALIFIED','CONVERTED','CLOSED')),
  staff_note text check (staff_note is null or char_length(staff_note) <= 1000),
  owner_notified_at timestamptz
);
create index trip_leads_created_idx on public.trip_leads (created_at desc);
create index trip_leads_ip_idx on public.trip_leads (ip_hash, created_at desc);
create index trip_leads_contact_idx on public.trip_leads (contact_value, created_at desc);
alter table public.trip_leads enable row level security;
revoke all on public.trip_leads from anon, authenticated;
grant select on public.trip_leads to authenticated;
grant update (status, staff_note) on public.trip_leads to authenticated;
create policy trip_leads_staff_select on public.trip_leads for select to authenticated using ((select public.is_staff()));
create policy trip_leads_staff_update on public.trip_leads for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- منع تكرار تنبيه الفعالية لنفس النطاق الزمني
create table public.event_alerts_sent (
  event_id uuid not null references public.gcc_events(id) on delete cascade,
  band integer not null check (band in (3,7,14)),
  sent_at timestamptz not null default now(),
  primary key (event_id, band)
);
alter table public.event_alerts_sent enable row level security;
revoke all on public.event_alerts_sent from anon, authenticated;

-- فعاليات موثّقة بمصدرين، تبدأ خلال 14 يومًا، وعرضها المؤكد صفر. للـservice role فقط.
create or replace function public.eye_event_alerts_due()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare res jsonb;
begin
  select coalesce(jsonb_agg(x order by (x ->> 'starts_on')), '[]'::jsonb) into res from (
    select jsonb_build_object(
      'id', b.id, 'title', b.title, 'title_ar', b.title_ar, 'city', b.city, 'airports', b.codes,
      'starts_on', b.starts_on, 'days_until', b.du, 'band', b.band, 'sources', b.sources,
      'confirmed_availability', b.conf,
      'tracked_aircraft_near_24h', (select count(distinct s.icao24) from public.aircraft_sightings s
          where s.observed_at > now() - interval '24 hours' and s.nearest_airport = any(b.codes) and s.nearest_km <= 150),
      'open_requests',
        (select count(*) from public.travel_requests r where r.destination_code = any(b.codes) and r.status <> 'CANCELLED'
           and r.travel_date between b.starts_on - 3 and b.ends_on + 3)
        + (select count(*) from public.trip_leads l where l.destination_code = any(b.codes) and l.status <> 'CLOSED'
           and l.travel_date between b.starts_on - 3 and b.ends_on + 3)
    ) as x
    from (
      select e.*, ap.codes, greatest(e.starts_on - current_date, 0) as du,
        case when e.starts_on - current_date <= 3 then 3 when e.starts_on - current_date <= 7 then 7 else 14 end as band,
        (select count(*) from public.aircraft_availability a where a.status = 'AVAILABLE' and not a.is_demo
           and a.destination_code = any(ap.codes) and (a.expires_at is null or a.expires_at > now())) as conf
      from public.gcc_events e
      cross join lateral (select coalesce(nullif(e.airports, '{}'::text[]),
        (select array_agg(c.iata) from public._eye_city_airports() c where c.city = e.city)) as codes) ap
      where e.verification = 'CROSS_CHECKED' and e.starts_on >= current_date and e.starts_on <= current_date + 14
    ) b
    where b.conf = 0 and b.codes is not null
      and not exists (select 1 from public.event_alerts_sent s where s.event_id = b.id and s.band <= b.band)
  ) q;
  return res;
end $$;
revoke all on function public.eye_event_alerts_due() from public, anon, authenticated;
grant execute on function public.eye_event_alerts_due() to service_role;

-- eye_notify يقبل الآن وضع events
create or replace function public.eye_notify(p_mode text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare resp private_ext.http_response; sec text;
begin
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'eye_cron_secret';
  perform private_ext.http_set_curlopt('CURLOPT_TIMEOUT_MS', '30000');
  resp := private_ext.http(('POST', 'https://yiklciblxwymcxxszkty.supabase.co/functions/v1/notify-owner?mode=' ||
            case when p_mode = 'digest' then 'digest' when p_mode = 'events' then 'events' else 'alerts' end,
            array[private_ext.http_header('x-cron-secret', sec)], 'application/json', '{}')::private_ext.http_request);
  return jsonb_build_object('status', resp.status, 'body', left(coalesce(resp.content, ''), 600));
exception when others then
  return jsonb_build_object('error', sqlerrm);
end $$;
