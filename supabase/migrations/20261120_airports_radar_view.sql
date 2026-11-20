-- IKING radar home: coordinates for airports + a read-only public view (reference data only).
-- Run on the iKing app project. Additive; safe to re-run.
alter table public.airports add column if not exists latitude_deg double precision, add column if not exists longitude_deg double precision;
update public.airports a set latitude_deg=v.la, longitude_deg=v.lo
from (values ('AMM',31.72,35.99),('AUH',24.43,54.65),('BOM',19.09,72.87),('CAI',30.1,31.4),('CDG',49.0,2.55),('DEL',28.56,77.1),('DMM',26.47,49.8),('DOH',25.27,51.6),('DXB',25.25,55.36),('GVA',46.24,6.11),('HRG',27.18,33.8),('IST',41.26,28.75),('JED',21.68,39.15),('JFK',40.64,-73.78),('KWI',29.23,47.97),('LHR',51.47,-0.46),('MED',24.55,39.7),('MLE',4.19,73.5),('RUH',24.96,46.7),('SIN',1.35,103.99),('TUU',28.37,36.6)) as v(iata,la,lo)
where a.iata_code=v.iata;
create or replace view public.airports_radar as
select iata_code, city, country, name, latitude_deg, longitude_deg from public.airports
where latitude_deg is not null and longitude_deg is not null;
revoke all on public.airports_radar from anon, authenticated;
grant select on public.airports_radar to anon, authenticated;
