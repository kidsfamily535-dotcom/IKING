create table if not exists public.aircraft_type_media (
  model text primary key references public.aircraft_models(model) on delete cascade,
  aviapages_type_id integer,
  aviapages_name text,
  slug text,
  image_url text,
  image_source text not null default 'Aviapages',
  pax_max integer,
  range_km integer,
  cabin_height_m numeric,
  cabin_length_m numeric,
  cabin_width_m numeric,
  luggage_m3 numeric,
  description_en text,
  match_status text not null default 'PENDING' check (match_status in ('PENDING','MATCHED','NOT_FOUND')),
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.aircraft_type_media is 'Aircraft TYPE photos and cabin facts cached from Aviapages (reference data, not availability). Filled only by refresh_aircraft_type_media(). Matching is by name search; MATCHED rows should be eyeballed once.';
alter table public.aircraft_type_media enable row level security;
create policy aircraft_type_media_read on public.aircraft_type_media for select to anon, authenticated using (true);

create or replace function public.refresh_aircraft_type_media(p_model text, p_search text default null)
returns text
language plpgsql
security definer
set search_path = public, private_ext, vault
as $fn$
declare
  k text;
  s text := coalesce(p_search, p_model);
  r private_ext.http_response;
  t jsonb;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'aviapage_token';
  if k is null then raise exception 'aviapage_token missing in vault'; end if;
  r := private_ext.http((
        'GET',
        'https://dir.aviapages.com/api/aircraft_types/?page_size=15&search=' || private_ext.urlencode(s),
        ARRAY[private_ext.http_header('Authorization','Token '||k)],
        NULL, NULL)::private_ext.http_request);
  if r.status <> 200 then
    return 'HTTP '||r.status;
  end if;
  select x into t
  from jsonb_array_elements((r.content::jsonb)->'results') x
  where lower(x->>'name') like '%'||lower(s)||'%'
  order by length(x->>'name')
  limit 1;
  if t is null then
    update public.aircraft_type_media set match_status='NOT_FOUND', fetched_at=now() where model=p_model;
    insert into public.aircraft_type_media(model, match_status, fetched_at)
      select p_model,'NOT_FOUND',now() where not exists (select 1 from public.aircraft_type_media where model=p_model);
    return 'NOT_FOUND';
  end if;
  insert into public.aircraft_type_media(model, aviapages_type_id, aviapages_name, slug, image_url, pax_max, range_km,
        cabin_height_m, cabin_length_m, cabin_width_m, luggage_m3, description_en, match_status, fetched_at)
  values (p_model, (t->>'aircraft_type_id')::int, t->>'name', t->>'slug',
        t->'images'->0->'media'->>'path', (t->>'pax_maximum')::int, (t->>'range_maximum')::int,
        (t->>'cabin_height')::numeric, (t->>'cabin_length')::numeric, (t->>'cabin_width')::numeric,
        (t->>'luggage_volume')::numeric, t->'aircraft_type_extension'->>'description', 'MATCHED', now())
  on conflict (model) do update set
        aviapages_type_id=excluded.aviapages_type_id, aviapages_name=excluded.aviapages_name, slug=excluded.slug,
        image_url=excluded.image_url, pax_max=excluded.pax_max, range_km=excluded.range_km,
        cabin_height_m=excluded.cabin_height_m, cabin_length_m=excluded.cabin_length_m, cabin_width_m=excluded.cabin_width_m,
        luggage_m3=excluded.luggage_m3, description_en=excluded.description_en, match_status='MATCHED', fetched_at=now();
  return 'MATCHED: '||(t->>'name');
end
$fn$;

revoke all on function public.refresh_aircraft_type_media(text, text) from public, anon, authenticated;
grant execute on function public.refresh_aircraft_type_media(text, text) to service_role;
