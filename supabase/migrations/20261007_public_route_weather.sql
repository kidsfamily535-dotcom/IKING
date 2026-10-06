-- Public, read-only route weather for the "Watch your trip" page (?view=watch), so a visitor sees value before giving an email.
-- Same shape and same rules as get_route_weather (METAR newer than 150 min is CURRENT, else STALE/UNKNOWN, TAF if valid),
-- but callable by anon. Exposes only official weather already public (Aviation Weather Center) for airports in our own table.
-- No personal data, no writes. The authenticated version stays unchanged.
create or replace function public.get_route_weather_public(p_origin text, p_destination text)
 returns table(airport_code text, airport_name_ar text, leg_ar text, obs_status text, observed_at timestamptz, age_minutes integer, condition_ar text, wind_dir text, wind_speed_kt integer, visibility text, temp_c numeric, forecast_available boolean, forecast_valid_to timestamptz, notice_ar text)
 language sql stable security definer set search_path to ''
as $function$
  select a.iata_code, a.name_ar, v.leg,
    case when a.icao_code is null or m.id is null then 'UNKNOWN'
         when m.issued_at < now() - interval '150 minutes' then 'STALE' else 'CURRENT' end,
    m.issued_at,
    case when m.id is null then null else floor(extract(epoch from now() - m.issued_at) / 60)::int end,
    case when m.id is null or m.issued_at < now() - interval '150 minutes' then null else
      case m.flight_category when 'VFR' then 'رؤية جيدة' when 'MVFR' then 'رؤية حدّية' when 'IFR' then 'رؤية منخفضة'
                             when 'LIFR' then 'رؤية منخفضة جدًا' else 'غير محدد' end end,
    case when m.issued_at >= now() - interval '150 minutes' then m.wind_dir end,
    case when m.issued_at >= now() - interval '150 minutes' then m.wind_speed_kt end,
    case when m.issued_at >= now() - interval '150 minutes' then m.visibility end,
    case when m.issued_at >= now() - interval '150 minutes' then m.temp_c end,
    (t.id is not null), t.valid_to,
    case when a.icao_code is null or m.id is null or m.issued_at < now() - interval '150 minutes'
         then 'الطقس غير معروف حاليًا وسيتحقق منه فريقنا.'
         else 'رصد من مصدر رسمي (Aviation Weather Center) وقت الرصد المذكور. القرار النهائي للمشغّل والطاقم.' end
  from (values (upper(left(p_origin, 4)), 'المغادرة'), (upper(left(p_destination, 4)), 'الوصول')) v(code, leg)
  join public.airports a on a.iata_code = v.code
  left join lateral (select s.* from public.weather_snapshots s where s.airport_code = a.iata_code and s.report_type = 'METAR'
                      order by s.issued_at desc limit 1) m on true
  left join lateral (select s.* from public.weather_snapshots s where s.airport_code = a.iata_code and s.report_type = 'TAF'
                      and s.valid_to > now() order by s.issued_at desc limit 1) t on true
  order by case v.leg when 'المغادرة' then 1 else 2 end $function$;
revoke all on function public.get_route_weather_public(text, text) from public;
grant execute on function public.get_route_weather_public(text, text) to anon, authenticated;
