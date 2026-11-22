-- IKING radar home: read-only public view over existing airports (reference data only, reviewed coords only).
create or replace view public.airports_radar as
select iata_code, name_ar, name_en, country_code, lat, lon
from public.airports
where lat is not null and lon is not null and coalesce(needs_review,false)=false;
revoke all on public.airports_radar from anon, authenticated;
grant select on public.airports_radar to anon, authenticated;
