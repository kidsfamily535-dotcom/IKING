create table if not exists public.eye_aircraft_perf (
  model text primary key references public.aircraft_models(model),
  speed_kmh int not null, range_seatsfull_km int not null, seats_max int not null, hourly_rate_usd int not null,
  note text);
create table if not exists public.eye_pricing_params (key text primary key, value numeric not null, note text);
create table if not exists public.eye_route_pricing (
  origin_code text not null, dest_code text not null, distance_km int not null,
  aircraft_model text not null references public.aircraft_models(model),
  price_low_usd int not null, price_mid_usd int not null, price_high_usd int not null,
  price_status text not null check (price_status in ('MARKET_ALIGNED','MODEL_ESTIMATE')),
  confidence text not null check (confidence in ('high','medium','low')),
  needs_review boolean not null default false,
  source text not null default 'SkyKing consolidated routes 2026-10 + market-calibrated model v1',
  primary key (origin_code, dest_code));
comment on table public.eye_route_pricing is 'INDICATIVE route prices (seed). Never an offer. One row per pair, direction-agnostic.';
alter table public.eye_aircraft_perf enable row level security;
alter table public.eye_pricing_params enable row level security;
alter table public.eye_route_pricing enable row level security;

insert into public.eye_aircraft_perf values
('Citation CJ3+',740,2480,7,4500,'416kt cruise, 1,339nm seats-full'),
('Citation Latitude',800,4630,9,7500,'451kt, 2,500nm'),
('Challenger 350',820,5780,9,8500,'459kt, 3,120nm'),
('G450',850,7400,14,10500,'476kt, 3,998nm'),
('G650',900,12000,16,14000,'general knowledge ~7,000nm'),
('Global 7500',900,14260,17,14000,'general knowledge ~7,700nm')
on conflict (model) do nothing;
insert into public.eye_pricing_params values
('overhead_h',0.35,'taxi/climb/descent per flight'),('routing_factor',1.04,'route longer than great circle'),
('min_billed_h',1.2,'minimum billed hours'),('fees_usd',800,'landing+handling'),
('pos_max_h',0.75,'max repositioning hours (international)'),('pos_full_until_h',3,''),('pos_zero_at_h',6,''),
('range_safety',0.85,'distance*routing must be <= range*safety'),('price_low_factor',0.85,''),('price_high_factor',1.2,'')
on conflict (key) do nothing;
insert into public.eye_route_pricing(origin_code,dest_code,distance_km,aircraft_model,price_low_usd,price_mid_usd,price_high_usd,price_status,confidence,needs_review) values
('RUH','JED',852,'Citation Latitude',8000,11500,15000,'MARKET_ALIGNED','high',false),('RUH','DMM',353,'Citation CJ3+',4400,5150,5900,'MARKET_ALIGNED','high',false),('RUH','ABT',856,'Citation Latitude',8800,10300,11800,'MARKET_ALIGNED','high',false),('RUH','GIZ',992,'Citation Latitude',9700,11350,13000,'MARKET_ALIGNED','high',false),('RUH','MED',708,'Citation Latitude',8800,10300,12400,'MODEL_ESTIMATE','medium',true),('RUH','TUU',1070,'Citation Latitude',9200,10800,12400,'MARKET_ALIGNED','high',false),('RUH','YNB',878,'Citation Latitude',10200,12000,14400,'MODEL_ESTIMATE','medium',true),('RUH','QAT',329,'Citation CJ3+',4000,4650,5300,'MARKET_ALIGNED','high',false),('RUH','ELQ',875,'Citation Latitude',10200,12000,14400,'MODEL_ESTIMATE','medium',true),('JED','DMM',1204,'Citation Latitude',12900,15200,18200,'MODEL_ESTIMATE','medium',true),('JED','ABT',529,'Citation CJ3+',5300,6200,7400,'MODEL_ESTIMATE','medium',true),('JED','GIZ',642,'Citation CJ3+',5400,6400,7700,'MODEL_ESTIMATE','medium',true),('JED','MED',324,'Citation CJ3+',4000,4650,5300,'MARKET_ALIGNED','high',false),('JED','TUU',786,'Citation Latitude',8800,10300,11800,'MARKET_ALIGNED','high',false),('JED','YNB',296,'Citation CJ3+',5300,6200,7400,'MODEL_ESTIMATE','medium',true),('JED','ELQ',544,'Citation CJ3+',4800,5650,6500,'MARKET_ALIGNED','high',false),('DMM','ABT',1173,'Citation Latitude',10600,12400,14200,'MARKET_ALIGNED','high',false),('DMM','GIZ',1298,'Citation Latitude',11400,13350,15300,'MARKET_ALIGNED','high',false),('DMM','MED',1035,'Citation Latitude',11600,13600,16300,'MODEL_ESTIMATE','medium',true),('DMM','TUU',1317,'Citation Latitude',13900,16300,19600,'MODEL_ESTIMATE','medium',true),('DMM','YNB',1207,'Citation Latitude',12900,15200,18200,'MODEL_ESTIMATE','medium',true),('ABT','GIZ',149,'Citation CJ3+',4400,5150,5900,'MARKET_ALIGNED','high',false),('ABT','MED',766,'Citation Latitude',9200,10800,12400,'MARKET_ALIGNED','high',false),('ABT','TUU',1283,'Citation Latitude',11000,12900,14800,'MARKET_ALIGNED','high',false),('GIZ','MED',902,'Citation Latitude',10600,12400,14200,'MARKET_ALIGNED','high',false),('GIZ','TUU',1414,'Citation Latitude',12300,14400,16500,'MARKET_ALIGNED','high',false),('MED','TUU',523,'Citation CJ3+',5300,6200,7400,'MODEL_ESTIMATE','medium',true),('MED','YNB',172,'Citation CJ3+',5300,6200,7400,'MODEL_ESTIMATE','medium',true),('MED','ELQ',267,'Citation CJ3+',4000,4650,5300,'MARKET_ALIGNED','high',false),('TUU','YNB',491,'Citation CJ3+',6200,7250,8300,'MARKET_ALIGNED','high',false),('TUU','ELQ',257,'Citation CJ3+',5700,6700,7700,'MARKET_ALIGNED','high',false),('YNB','ELQ',260,'Citation CJ3+',5300,6200,7400,'MODEL_ESTIMATE','medium',true),('DXB','AUH',116,'Citation CJ3+',6000,7500,9000,'MARKET_ALIGNED','high',false),('DXB','DWC',45,'Citation CJ3+',5300,6200,7400,'MODEL_ESTIMATE','medium',true),('AUH','DWC',73,'Citation CJ3+',5300,6200,7400,'MODEL_ESTIMATE','medium',true),('DXB','SHJ',17,'Citation CJ3+',5000,6000,7000,'MARKET_ALIGNED','high',false),('DXB','AAN',113,'Citation CJ3+',6000,7250,8500,'MARKET_ALIGNED','medium',true),('DXB','RKT',70,'Citation CJ3+',5500,6750,8000,'MARKET_ALIGNED','medium',true),('DXB','FJR',98,'Citation CJ3+',6000,7250,8500,'MARKET_ALIGNED','medium',true),('AUH','AAN',99,'Citation CJ3+',5000,6250,7500,'MARKET_ALIGNED','medium',true),('AUH','FJR',185,'Citation CJ3+',6500,7750,9000,'MARKET_ALIGNED','medium',true),('RUH','RSI_NUM',1032,'Citation Latitude',11500,13500,16200,'MODEL_ESTIMATE','medium',true),('MCT','SLL',850,'Citation Latitude',10000,11800,14200,'MODEL_ESTIMATE','low',true),('RUH','DXB',873,'Citation Latitude',15300,19950,24600,'MARKET_ALIGNED','high',false),('RUH','DOH',495,'Citation CJ3+',7600,8900,10700,'MARKET_ALIGNED','high',false),('RUH','KWI',491,'Citation CJ3+',7600,8900,10700,'MODEL_ESTIMATE','medium',true),('RUH','BAH',421,'Citation CJ3+',8800,10300,11800,'MARKET_ALIGNED','high',false),('RUH','MCT',1184,'Citation Latitude',18000,21000,24000,'MARKET_ALIGNED','high',false),('RUH','AMM',1289,'Citation Latitude',18400,21700,26000,'MODEL_ESTIMATE','medium',true),('RUH','BEY',1465,'Citation Latitude',19800,23300,28000,'MODEL_ESTIMATE','medium',true),('RUH','CAI',1612,'Citation Latitude',21100,24800,29800,'MODEL_ESTIMATE','medium',true),('RUH','LHR',4940,'G450',57700,67900,81500,'MARKET_ALIGNED','high',false),('RUH','CDG',4651,'G450',54600,64200,77000,'MODEL_ESTIMATE','medium',true),('RUH','ZRH',4174,'Challenger 350',35200,41200,47200,'MARKET_ALIGNED','high',false),('RUH','HKG',6782,'G650',98200,115500,138600,'MODEL_ESTIMATE','medium',true),('RUH','SIN',6673,'G650',96600,113600,136300,'MODEL_ESTIMATE','medium',true),('JED','DXB',1699,'Citation Latitude',21800,25600,30700,'MARKET_ALIGNED','high',false),('JED','DOH',1331,'Citation Latitude',20000,23000,26000,'MARKET_ALIGNED','high',false),('JED','CAI',1217,'Citation Latitude',17800,20900,25100,'MARKET_ALIGNED','high',false),('JED','AMM',1160,'Citation Latitude',17300,20400,24500,'MODEL_ESTIMATE','medium',true),('JED','BEY',1397,'Citation Latitude',19300,22700,27200,'MODEL_ESTIMATE','medium',true),('JED','LHR',4748,'G450',55700,65500,78600,'MARKET_ALIGNED','high',false),('JED','CDG',4427,'G450',42200,49400,56600,'MARKET_ALIGNED','high',false),('DMM','DXB',573,'Citation CJ3+',7900,9250,10600,'MARKET_ALIGNED','high',false),('DMM','DOH',225,'Citation CJ3+',7000,8200,9400,'MARKET_ALIGNED','high',false),('DMM','KWI',355,'Citation CJ3+',6800,8000,9600,'MODEL_ESTIMATE','medium',true),('DMM','BAH',86,'Citation CJ3+',5400,6300,7600,'MODEL_ESTIMATE','medium',true),('ABT','DXB',1525,'Citation Latitude',20300,23900,28700,'MODEL_ESTIMATE','medium',true),('ABT','CAI',1743,'Citation Latitude',22200,26100,31300,'MODEL_ESTIMATE','medium',true),('ABT','ADD',1111,'Citation Latitude',16900,19900,23900,'MODEL_ESTIMATE','medium',true),('MED','DXB',1580,'Citation Latitude',20700,24400,29300,'MODEL_ESTIMATE','medium',true),('MED','CAI',1027,'Citation Latitude',16200,19100,22900,'MODEL_ESTIMATE','medium',true),('MED','AMM',876,'Citation Latitude',15000,17600,21100,'MODEL_ESTIMATE','medium',true),('TUU','DXB',1890,'Citation Latitude',23400,27500,33000,'MODEL_ESTIMATE','medium',true),('TUU','AMM',378,'Citation CJ3+',6900,8100,9700,'MODEL_ESTIMATE','medium',true),('DXB','DOH',378,'Citation CJ3+',6900,8100,9700,'MARKET_ALIGNED','high',false),('DXB','KWI',854,'Citation Latitude',16000,18500,21000,'MARKET_ALIGNED','high',false),('DXB','MCT',348,'Citation CJ3+',6800,8000,9600,'MARKET_ALIGNED','high',false),('DXB','AMM',2022,'Citation Latitude',24500,28800,34600,'MODEL_ESTIMATE','medium',true),('DXB','TLV',2131,'Citation Latitude',25200,29600,35500,'MODEL_ESTIMATE','medium',true),('DXB','BEY',2141,'Citation Latitude',25200,29700,35600,'MODEL_ESTIMATE','medium',true),('DXB','LHR',5497,'G450',63800,75100,90100,'MARKET_ALIGNED','high',false),('DXB','CDG',5239,'G450',61000,71800,86200,'MODEL_ESTIMATE','medium',true),('DXB','ZRH',4767,'G450',55800,65700,78800,'MODEL_ESTIMATE','medium',true),('AUH','MCT',381,'Citation CJ3+',7000,8200,9800,'MODEL_ESTIMATE','medium',true),('AUH','BAH',452,'Citation CJ3+',7300,8600,10300,'MODEL_ESTIMATE','medium',true),('DOH','BAH',148,'Citation CJ3+',5700,6700,8000,'MODEL_ESTIMATE','medium',true),('DOH','AUH',321,'Citation CJ3+',6600,7800,9400,'MODEL_ESTIMATE','medium',true),('DXB','CAI',2416,'Citation Latitude',18000,25000,32000,'MARKET_ALIGNED','high',false),('IST','SAW',63,'Citation CJ3+',5300,6200,7400,'MODEL_ESTIMATE','medium',true),('IST','AYT',518,'Citation CJ3+',5300,6200,7400,'MODEL_ESTIMATE','medium',true),('IST','ESB',380,'Citation CJ3+',5300,6200,7100,'MARKET_ALIGNED','high',false),('SAW','AYT',463,'Citation CJ3+',6600,7700,8800,'MARKET_ALIGNED','medium',true),('SAW','ESB',323,'Citation CJ3+',5100,5950,6800,'MARKET_ALIGNED','medium',true),('AYT','ESB',407,'Citation CJ3+',5500,6400,7300,'MARKET_ALIGNED','medium',true),('IST','RUH',2457,'Citation Latitude',27200,32000,38400,'MARKET_ALIGNED','high',false),('IST','JED',2388,'Citation Latitude',26800,31500,37800,'MODEL_ESTIMATE','medium',true),('IST','DMM',2534,'Challenger 350',30800,36200,43400,'MODEL_ESTIMATE','medium',true),('IST','MED',2118,'Citation Latitude',25100,29500,35400,'MODEL_ESTIMATE','medium',true),('IST','TUU',1603,'Citation Latitude',21000,24700,29600,'MODEL_ESTIMATE','medium',true),('AYT','DXB',2662,'Challenger 350',31800,37400,44900,'MODEL_ESTIMATE','medium',true),('IST','DXB',3028,'Challenger 350',22000,34000,46000,'MARKET_ALIGNED','high',false),('IST','DOH',2756,'Challenger 350',32400,38100,45700,'MODEL_ESTIMATE','medium',true),('IST','KWI',2191,'Citation Latitude',25600,30100,36100,'MODEL_ESTIMATE','medium',true),('IST','CAI',1263,'Citation Latitude',14000,17000,20000,'MARKET_ALIGNED','high',false),('IST','LHR',2488,'Citation Latitude',27400,32200,38600,'MODEL_ESTIMATE','medium',true),('IST','CDG',2214,'Citation Latitude',25700,30200,36200,'MODEL_ESTIMATE','medium',true),('IST','FRA',1838,'Citation Latitude',23000,27000,32400,'MODEL_ESTIMATE','medium',true),('CAI','SSH',376,'Citation CJ3+',5300,6200,7400,'MODEL_ESTIMATE','low',true),('DXB','MLE',3041,'Challenger 350',36100,42500,51000,'MARKET_ALIGNED','high',false),('DXB','GVA',4919,'G450',57500,67700,81200,'MODEL_ESTIMATE','medium',true),('DXB','JFK',11001,'Global 7500',150000,185000,220000,'MARKET_ALIGNED','high',false)
on conflict (origin_code,dest_code) do nothing;

create or replace function public.eye_read_route(p_origin text, p_dest text, p_pax int default 2)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  prm jsonb := (select jsonb_object_agg(key,value) from eye_pricing_params);
  o airports%rowtype; d airports%rowtype; rp eye_route_pricing%rowtype;
  g numeric; intl boolean; opts jsonb := '[]'::jsonb; r record; h numeric; pos numeric; bh numeric; p numeric; n int := 0;
  ov numeric := (prm->>'overhead_h')::numeric; rf numeric := (prm->>'routing_factor')::numeric;
  use_row boolean;
begin
  p_origin := upper(trim(p_origin)); p_dest := upper(trim(p_dest));
  if p_pax is null or p_pax < 1 or p_pax > 40 then raise exception 'invalid pax'; end if;
  select * into o from airports where iata_code=p_origin; select * into d from airports where iata_code=p_dest;
  select * into rp from eye_route_pricing where (origin_code=p_origin and dest_code=p_dest) or (origin_code=p_dest and dest_code=p_origin) limit 1;
  if o.lat is not null and d.lat is not null then
    g := 2*6371*asin(sqrt(power(sin(radians(d.lat-o.lat)/2),2)+cos(radians(o.lat))*cos(radians(d.lat))*power(sin(radians(d.lon-o.lon)/2),2)));
    intl := o.country_code is distinct from d.country_code;
  elsif rp.distance_km is not null then g := rp.distance_km; intl := true;
  else return jsonb_build_object('status','UNKNOWN_ROUTE','message','route not in database'); end if;
  g := round(g);
  for r in select f.*, a.category from eye_aircraft_perf f join aircraft_models a using(model)
           where g*rf <= f.range_seatsfull_km*(prm->>'range_safety')::numeric and f.seats_max >= p_pax
           order by f.hourly_rate_usd, f.speed_kmh limit 2 loop
    n := n+1;
    h := round(g*rf/r.speed_kmh+ov,2);
    pos := case when intl then (prm->>'pos_max_h')::numeric*greatest(0,least(1,((prm->>'pos_zero_at_h')::numeric-h)/((prm->>'pos_zero_at_h')::numeric-(prm->>'pos_full_until_h')::numeric))) else 0 end;
    bh := greatest(h+pos,(prm->>'min_billed_h')::numeric);
    p := round((bh*r.hourly_rate_usd+(prm->>'fees_usd')::numeric)/100)*100;
    use_row := rp.aircraft_model = r.model;
    opts := opts || jsonb_build_array(jsonb_build_object(
      'role', case n when 1 then 'BEST_FIT' else 'MORE_SPACIOUS' end,
      'model', r.model, 'category', r.category, 'seats_max', r.seats_max, 'range_km', r.range_seatsfull_km,
      'flight_hours', h,
      'price_low_usd', case when use_row then rp.price_low_usd else round(p*(prm->>'price_low_factor')::numeric/100)*100 end,
      'price_mid_usd', case when use_row then rp.price_mid_usd else p end,
      'price_high_usd', case when use_row then rp.price_high_usd else round(p*(prm->>'price_high_factor')::numeric/100)*100 end,
      'price_status', case when use_row then rp.price_status else 'MODEL_ESTIMATE' end,
      'confidence', case when use_row then rp.confidence else 'medium' end,
      'image_url', (select image_url from aircraft_type_media m where m.model=r.model),
      'cabin', (select jsonb_build_object('length_m',cabin_length_m,'width_m',cabin_width_m,'height_m',cabin_height_m,'luggage_m3',luggage_m3) from aircraft_type_media m where m.model=r.model)));
  end loop;
  return jsonb_build_object('status', case when n=0 then 'NO_DIRECT_OPTION' else 'OK' end,
    'origin',p_origin,'dest',p_dest,'distance_km',g,'international',intl,'pax',p_pax,'options',opts,
    'is_offer', false, 'disclaimer','INDICATIVE estimate only. Not an offer. Requires operator confirmation and human approval.');
end $fn$;
revoke all on function public.eye_read_route(text,text,int) from public, anon;
grant execute on function public.eye_read_route(text,text,int) to authenticated, service_role;
