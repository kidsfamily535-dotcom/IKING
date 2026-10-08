-- Definition of eye_demand_radar(integer), referenced (but not included) by 20261006_gcc_events_demand_radar.sql.
-- Taken verbatim from the live database (pg_get_functiondef) on 2026-10-09.
CREATE OR REPLACE FUNCTION public.eye_demand_radar(p_days integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d int := least(greatest(coalesce(p_days, 60), 1), 180); res jsonb;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(x order by (x ->> 'starts_on')), '[]'::jsonb) into res from (
    select jsonb_build_object(
      'id', e.id, 'title', e.title, 'title_ar', e.title_ar, 'category', e.category, 'city', e.city,
      'airports', ap.codes, 'starts_on', e.starts_on, 'ends_on', e.ends_on, 'end_basis', e.end_basis,
      'days_until', greatest(e.starts_on - current_date, 0), 'live_now', (current_date between e.starts_on and e.ends_on),
      'verification', e.verification, 'sources', e.sources, 'verified_at', e.verified_at, 'note', e.note,
      'supply', jsonb_build_object(
        'tracked_aircraft_near_24h', (select count(distinct s.icao24) from public.aircraft_sightings s
            where s.observed_at > now() - interval '24 hours' and s.nearest_airport = any(ap.codes) and s.nearest_km <= 150),
        'tracked_basis', 'INFERRED',
        'confirmed_availability', (select count(*) from public.aircraft_availability a
            where a.status = 'AVAILABLE' and not a.is_demo and a.destination_code = any(ap.codes) and (a.expires_at is null or a.expires_at > now())),
        'demo_availability', (select count(*) from public.aircraft_availability a
            where a.status = 'AVAILABLE' and a.is_demo and a.destination_code = any(ap.codes) and (a.expires_at is null or a.expires_at > now())),
        'open_requests', (select count(*) from public.travel_requests r
            where r.destination_code = any(ap.codes) and r.status <> 'CANCELLED' and r.travel_date between e.starts_on - 3 and e.ends_on + 3))
    ) as x
    from public.gcc_events e
    cross join lateral (select coalesce(nullif(e.airports, '{}'::text[]), (select array_agg(c.iata) from public._eye_city_airports() c where c.city = e.city)) as codes) ap
    where e.ends_on >= current_date and e.starts_on <= current_date + d
  ) q;
  return jsonb_build_object('generated_at', now(), 'window_days', d, 'events', res,
    'note', 'الأحداث حقائق تقويمية من مصادر عامة، وليست طلبًا مؤكدًا. الطائرات المرصودة استنتاج من تتبّع عام ولا تعني التوافر. التوافر المؤكد من المشغّل وحده.');
end $function$;
