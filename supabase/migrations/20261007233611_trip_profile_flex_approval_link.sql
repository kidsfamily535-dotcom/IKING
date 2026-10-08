-- ============ 1) Trip profile (idea 1) + flexibility settings (idea 3) ============
create table public.trip_profiles (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  default_passengers smallint check (default_passengers between 1 and 30),
  approver_name text check (char_length(approver_name) between 1 and 80),
  approver_email text check (char_length(approver_email) <= 120 and approver_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  flex_days_before smallint not null default 0 check (flex_days_before between 0 and 3),
  flex_days_after smallint not null default 0 check (flex_days_after between 0 and 3),
  accept_alt_airports boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_profiles_approver_pair check ((approver_name is null) = (approver_email is null))
);
create trigger trip_profiles_updated before update on public.trip_profiles
  for each row execute function public.set_updated_at();

create table public.trip_profile_travelers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  note text check (char_length(note) <= 120),
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index trip_profile_travelers_customer_idx on public.trip_profile_travelers (customer_id);

create table public.trip_profile_airports (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  iata_code text not null references public.airports(iata_code),
  role text not null check (role in ('preferred','alternate')),
  rank smallint not null default 1 check (rank between 1 and 8),
  primary key (customer_id, iata_code)
);

-- ============ 3) One-touch approval link (idea 5) ============
create table public.approval_links (
  id uuid primary key default gen_random_uuid(),
  client_offer_id uuid not null references public.client_offers(id) on delete cascade,
  travel_request_id uuid not null references public.travel_requests(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  approver_name text not null,
  approver_email text not null,
  token_hash text not null unique,
  summary jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','DECLINED','REVOKED')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  first_opened_at timestamptz,
  decided_at timestamptz,
  decision_note text check (char_length(decision_note) <= 300)
);
create unique index approval_links_one_pending on public.approval_links (client_offer_id) where status = 'PENDING';
create index approval_links_customer_idx on public.approval_links (customer_id, issued_at desc);

alter table public.trip_profiles enable row level security;
alter table public.trip_profile_travelers enable row level security;
alter table public.trip_profile_airports enable row level security;
alter table public.approval_links enable row level security;

create policy trip_profiles_select on public.trip_profiles for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy trip_profile_travelers_select on public.trip_profile_travelers for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy trip_profile_airports_select on public.trip_profile_airports for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy approval_links_staff_select on public.approval_links for select to authenticated
  using ((select public.is_staff()));

revoke all on public.trip_profiles, public.trip_profile_travelers, public.trip_profile_airports, public.approval_links from anon, authenticated;
grant select on public.trip_profiles, public.trip_profile_travelers, public.trip_profile_airports, public.approval_links to authenticated;

-- ============ Functions: profile ============
create or replace function public.get_my_trip_profile()
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'default_passengers', tp.default_passengers,
    'approver_name', tp.approver_name,
    'approver_email', tp.approver_email,
    'flex_days_before', coalesce(tp.flex_days_before,0),
    'flex_days_after', coalesce(tp.flex_days_after,0),
    'accept_alt_airports', coalesce(tp.accept_alt_airports,false),
    'travelers', coalesce((select jsonb_agg(jsonb_build_object('name',t.display_name,'note',t.note) order by t.position) from public.trip_profile_travelers t where t.customer_id = (select auth.uid())), '[]'::jsonb),
    'airports', coalesce((select jsonb_agg(jsonb_build_object('code',a.iata_code,'role',a.role,'rank',a.rank) order by a.role, a.rank) from public.trip_profile_airports a where a.customer_id = (select auth.uid())), '[]'::jsonb))
  from (select 1) x left join public.trip_profiles tp on tp.customer_id = (select auth.uid())
  where (select auth.uid()) is not null $$;

create or replace function public.save_my_trip_profile(p_profile jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_uid uuid := (select auth.uid()); t jsonb; a jsonb; i int := 0; v_code text; v_role text;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then raise exception 'profile must be an object'; end if;
  if jsonb_typeof(coalesce(p_profile->'travelers','[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_profile->'travelers','[]'::jsonb)) > 12 then
    raise exception 'travelers must be a list of at most 12'; end if;
  if jsonb_typeof(coalesce(p_profile->'airports','[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_profile->'airports','[]'::jsonb)) > 8 then
    raise exception 'airports must be a list of at most 8'; end if;

  insert into public.trip_profiles (customer_id, default_passengers, approver_name, approver_email, flex_days_before, flex_days_after, accept_alt_airports)
  values (v_uid,
    nullif(p_profile->>'default_passengers','')::smallint,
    nullif(btrim(p_profile->>'approver_name'),''),
    nullif(btrim(lower(p_profile->>'approver_email')),''),
    coalesce(nullif(p_profile->>'flex_days_before','')::smallint,0),
    coalesce(nullif(p_profile->>'flex_days_after','')::smallint,0),
    coalesce((p_profile->>'accept_alt_airports')::boolean,false))
  on conflict (customer_id) do update set
    default_passengers = excluded.default_passengers, approver_name = excluded.approver_name,
    approver_email = excluded.approver_email, flex_days_before = excluded.flex_days_before,
    flex_days_after = excluded.flex_days_after, accept_alt_airports = excluded.accept_alt_airports;

  delete from public.trip_profile_travelers where customer_id = v_uid;
  for t in select * from jsonb_array_elements(coalesce(p_profile->'travelers','[]'::jsonb)) loop
    i := i + 1;
    insert into public.trip_profile_travelers (customer_id, display_name, note, position)
    values (v_uid, btrim(t->>'name'), nullif(btrim(t->>'note'),''), i);
  end loop;

  delete from public.trip_profile_airports where customer_id = v_uid;
  for a in select * from jsonb_array_elements(coalesce(p_profile->'airports','[]'::jsonb)) loop
    v_code := upper(btrim(a->>'code')); v_role := a->>'role';
    if not exists (select 1 from public.airports where iata_code = v_code) then raise exception 'unknown airport %', v_code; end if;
    insert into public.trip_profile_airports (customer_id, iata_code, role, rank)
    values (v_uid, v_code, v_role, coalesce(nullif(a->>'rank','')::smallint,1))
    on conflict (customer_id, iata_code) do update set role = excluded.role, rank = excluded.rank;
  end loop;

  perform public._loop_audit('trip_profile_saved','trip_profile', v_uid, '{}'::jsonb);
  return public.get_my_trip_profile();
end $$;

-- ============ Functions: flexible matches (idea 3) ============
create or replace function public.list_my_flexible_legs(p_request uuid)
returns table(availability_id uuid, origin_code text, origin_name_ar text, destination_code text, destination_name_ar text,
              departure_from timestamptz, departure_until timestamptz, seats integer, match_kind text, relaxations text[],
              day_shift integer, confidence text, verified_at timestamptz, is_demo boolean, notice_ar text)
language plpgsql stable security definer set search_path to '' as $$
#variable_conflict use_column
declare r public.travel_requests%rowtype; tp public.trip_profiles%rowtype; v_before int; v_after int; v_alt boolean;
begin
  select * into r from public.travel_requests where id = p_request and customer_id = (select auth.uid());
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  if r.origin_code is null or r.destination_code is null or r.travel_date is null then return; end if;
  select * into tp from public.trip_profiles where customer_id = r.customer_id;
  v_before := coalesce(tp.flex_days_before,0); v_after := coalesce(tp.flex_days_after,0); v_alt := coalesce(tp.accept_alt_airports,false);

  return query
  with oset as (
    select r.origin_code as code, false as is_alt
    union all
    select a.iata_code, true from public.trip_profile_airports a
      join public.airports ax on ax.iata_code = a.iata_code
      join public.airports ro on ro.iata_code = r.origin_code
     where v_alt and a.customer_id = r.customer_id and a.role = 'alternate' and a.iata_code <> r.origin_code and ax.country_code = ro.country_code),
  dset as (
    select r.destination_code as code, false as is_alt
    union all
    select a.iata_code, true from public.trip_profile_airports a
      join public.airports ax on ax.iata_code = a.iata_code
      join public.airports rd on rd.iata_code = r.destination_code
     where v_alt and a.customer_id = r.customer_id and a.role = 'alternate' and a.iata_code <> r.destination_code and ax.country_code = rd.country_code),
  cand as (
    select av.id, av.origin_code, av.destination_code, av.departure_from, av.departure_until, av.seats, av.confidence, av.verified_at, av.is_demo,
           o.is_alt as oa, d.is_alt as da,
           (av.departure_from at time zone 'Asia/Riyadh')::date as df, (av.departure_until at time zone 'Asia/Riyadh')::date as du
      from public.aircraft_availability av
      join oset o on o.code = av.origin_code
      join dset d on d.code = av.destination_code
     where av.status = 'AVAILABLE' and (av.expires_at is null or av.expires_at > now()) and av.departure_until > now()
       and av.seats >= coalesce(r.passengers,1)
       and (av.departure_from at time zone 'Asia/Riyadh')::date <= r.travel_date + v_after
       and (av.departure_until at time zone 'Asia/Riyadh')::date >= r.travel_date - v_before),
  sh as (
    select c.*, case when c.df <= r.travel_date and c.du >= r.travel_date then 0
                     when c.df > r.travel_date then c.df - r.travel_date else c.du - r.travel_date end as shift
      from cand c),
  fin as (
    select s.*, array_remove(array[case when s.oa then 'ALT_ORIGIN' end, case when s.da then 'ALT_DESTINATION' end, case when s.shift <> 0 then 'DATE_SHIFT' end], null) as rel
      from sh s)
  select f.id, f.origin_code, ao.name_ar, f.destination_code, ad.name_ar, f.departure_from, f.departure_until, f.seats,
         case when cardinality(f.rel) = 0 then 'EXACT' else 'FLEX' end, f.rel, f.shift::int, f.confidence, f.verified_at, f.is_demo,
         'رحلة فاضية قد تتغير أو تُلغى إن تغيّرت خطة المشغّل. التأكيد النهائي بعد موافقة المشغّل.'::text
    from fin f
    left join public.airports ao on ao.iata_code = f.origin_code
    left join public.airports ad on ad.iata_code = f.destination_code
   order by cardinality(f.rel), abs(f.shift), f.departure_from
   limit 5;
end $$;

-- ============ Functions: approval link (idea 5) ============
create or replace function public.request_approval_link(p_client_offer uuid, p_ttl_hours integer default 24)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_uid uuid := (select auth.uid()); co public.client_offers%rowtype; r public.travel_requests%rowtype;
        tp public.trip_profiles%rowtype; o public.rfq_offers%rowtype; ao public.airports%rowtype; ad public.airports%rowtype;
        v_token text; v_id uuid; v_exp timestamptz; v_prep text;
begin
  if v_uid is null then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_ttl_hours is null or p_ttl_hours < 1 or p_ttl_hours > 72 then raise exception 'link lifetime must be 1 to 72 hours'; end if;
  select * into co from public.client_offers where id = p_client_offer for update;
  if not found then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  select * into r from public.travel_requests where id = co.travel_request_id;
  if r.customer_id <> v_uid then raise exception 'not found or not authorized' using errcode = '42501'; end if;
  if co.status <> 'PRESENTED' or co.valid_until <= now() then raise exception 'offer is not open for a decision'; end if;
  select * into tp from public.trip_profiles where customer_id = v_uid;
  if not found or tp.approver_email is null then raise exception 'set an approver in the trip profile first'; end if;
  select * into o from public.rfq_offers where id = co.rfq_offer_id;
  select * into ao from public.airports where iata_code = r.origin_code;
  select * into ad from public.airports where iata_code = r.destination_code;
  select full_name into v_prep from public.profiles where id = v_uid;

  update public.approval_links set status = 'REVOKED' where client_offer_id = co.id and status = 'PENDING';
  v_exp := least(now() + make_interval(hours => p_ttl_hours), co.valid_until);
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.approval_links (client_offer_id, travel_request_id, customer_id, approver_name, approver_email, token_hash, expires_at, summary)
  values (co.id, r.id, v_uid, tp.approver_name, tp.approver_email, encode(extensions.digest(v_token,'sha256'),'hex'), v_exp,
    jsonb_build_object('origin_code', r.origin_code, 'origin_ar', ao.name_ar, 'origin_en', ao.name_en,
      'destination_code', r.destination_code, 'destination_ar', ad.name_ar, 'destination_en', ad.name_en,
      'travel_date', r.travel_date, 'departure_period', r.departure_period, 'passengers', r.passengers,
      'cabin_label', co.cabin_label, 'price', co.client_price, 'currency', co.currency,
      'fees_included', o.includes_fees, 'fees_note', co.fees_note, 'valid_until', co.valid_until, 'prepared_by', v_prep))
  returning id into v_id;
  perform public._loop_audit('approval_link_issued','approval_link', v_id, jsonb_build_object('client_offer', co.id, 'ttl_hours', p_ttl_hours));
  return jsonb_build_object('link_id', v_id, 'token', v_token, 'expires_at', v_exp, 'approver_name', tp.approver_name,
    'notice_ar', 'أرسل هذا الرابط لصاحب القرار. الموافقة تسجّل نية حجز فقط، والتأكيد النهائي بعد مراجعة المشغّل.');
end $$;

create or replace function public.list_my_approval_links()
returns table(link_id uuid, client_offer_id uuid, request_id uuid, approver_name text, status text, issued_at timestamptz,
              expires_at timestamptz, first_opened_at timestamptz, decided_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select l.id, l.client_offer_id, l.travel_request_id, l.approver_name,
         case when l.status = 'PENDING' and l.expires_at <= now() then 'EXPIRED' else l.status end,
         l.issued_at, l.expires_at, l.first_opened_at, l.decided_at
    from public.approval_links l where l.customer_id = (select auth.uid()) order by l.issued_at desc limit 50 $$;

create or replace function public.revoke_approval_link(p_link uuid)
returns boolean language plpgsql security definer set search_path to '' as $$
declare n int;
begin
  update public.approval_links set status = 'REVOKED' where id = p_link and customer_id = (select auth.uid()) and status = 'PENDING';
  get diagnostics n = row_count;
  if n > 0 then perform public._loop_audit('approval_link_revoked','approval_link', p_link, '{}'::jsonb); end if;
  return n > 0;
end $$;

create or replace function public.approver_link_view(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare l public.approval_links%rowtype; co public.client_offers%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','INVALID'); end if;
  select * into l from public.approval_links where token_hash = encode(extensions.digest(p_token,'sha256'),'hex');
  if not found then return jsonb_build_object('state','INVALID'); end if;
  if l.status in ('APPROVED','DECLINED') then
    return jsonb_build_object('state','ANSWERED','answer',l.status,'answered_at',l.decided_at,'approver_name',l.approver_name); end if;
  if l.status = 'REVOKED' then return jsonb_build_object('state','REVOKED'); end if;
  if l.expires_at <= now() then return jsonb_build_object('state','EXPIRED'); end if;
  select * into co from public.client_offers where id = l.client_offer_id;
  if co.status <> 'PRESENTED' or co.valid_until <= now() then return jsonb_build_object('state','CLOSED'); end if;
  if co.client_price is distinct from (l.summary->>'price')::numeric or co.currency is distinct from (l.summary->>'currency')
     or co.valid_until is distinct from (l.summary->>'valid_until')::timestamptz then
    return jsonb_build_object('state','CHANGED'); end if;
  if l.first_opened_at is null then
    update public.approval_links set first_opened_at = now() where id = l.id;
    perform public._loop_audit('approval_link_opened','approval_link', l.id, '{}'::jsonb);
  end if;
  return jsonb_build_object('state','OPEN','approver_name',l.approver_name,'expires_at',l.expires_at,'summary',l.summary,
    'notice_ar','الموافقة تسجّل نية حجز فقط. التأكيد النهائي للطائرة والحجز بعد مراجعة المشغّل.');
end $$;

create or replace function public.approver_link_decide(p_token text, p_accept boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare l public.approval_links%rowtype; co public.client_offers%rowtype; r public.travel_requests%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_accept is null then return jsonb_build_object('ok', false, 'state','INVALID'); end if;
  select * into l from public.approval_links where token_hash = encode(extensions.digest(p_token,'sha256'),'hex') for update;
  if not found then return jsonb_build_object('ok', false, 'state','INVALID'); end if;
  if l.status in ('APPROVED','DECLINED') then return jsonb_build_object('ok', false, 'state','ANSWERED'); end if;
  if l.status = 'REVOKED' then return jsonb_build_object('ok', false, 'state','REVOKED'); end if;
  if l.expires_at <= now() then return jsonb_build_object('ok', false, 'state','EXPIRED'); end if;
  select * into co from public.client_offers where id = l.client_offer_id for update;
  select * into r from public.travel_requests where id = l.travel_request_id for update;
  if co.status <> 'PRESENTED' or co.valid_until <= now() then return jsonb_build_object('ok', false, 'state','CLOSED'); end if;
  if co.client_price is distinct from (l.summary->>'price')::numeric or co.currency is distinct from (l.summary->>'currency')
     or co.valid_until is distinct from (l.summary->>'valid_until')::timestamptz then
    return jsonb_build_object('ok', false, 'state','CHANGED'); end if;

  if p_accept then
    update public.client_offers set status = 'ACCEPTED', decided_at = now() where id = co.id;
    update public.client_offers set status = 'WITHDRAWN', decided_at = now(), decision_reason = 'another option was accepted'
     where travel_request_id = r.id and id <> co.id and status in ('DRAFT','APPROVED','PRESENTED');
    perform public._loop_set(r.id, 'ACCEPTED', 'approver accepted via link (booking intent only)');
    perform public._learn(r.customer_id, r.id, null, 'SELECTED', 'approval_link', jsonb_build_object('client_offer', co.id, 'approval_link', l.id));
    update public.approval_links set status = 'APPROVED', decided_at = now(), decision_note = left(p_note,300) where id = l.id;
    perform public._loop_audit('approval_link_approved','approval_link', l.id, jsonb_build_object('client_offer', co.id, 'request', r.id));
    return jsonb_build_object('ok', true, 'state','APPROVED',
      'notice_ar','سجّلنا موافقتك. هذه نية حجز وليست حجزًا مؤكدًا حتى نؤكد التفاصيل مع المشغّل.');
  else
    update public.approval_links set status = 'DECLINED', decided_at = now(), decision_note = left(p_note,300) where id = l.id;
    perform public._loop_audit('approval_link_declined','approval_link', l.id, jsonb_build_object('client_offer', co.id));
    return jsonb_build_object('ok', true, 'state','DECLINED', 'notice_ar','سجّلنا قرارك. سنبلغ من جهّز الرحلة.');
  end if;
end $$;

-- ============ Grants ============
revoke execute on function public.get_my_trip_profile(), public.save_my_trip_profile(jsonb), public.list_my_flexible_legs(uuid),
  public.request_approval_link(uuid,integer), public.list_my_approval_links(), public.revoke_approval_link(uuid),
  public.approver_link_view(text), public.approver_link_decide(text,boolean,text) from public, anon, authenticated;
grant execute on function public.get_my_trip_profile(), public.save_my_trip_profile(jsonb), public.list_my_flexible_legs(uuid),
  public.request_approval_link(uuid,integer), public.list_my_approval_links(), public.revoke_approval_link(uuid) to authenticated;
grant execute on function public.approver_link_view(text), public.approver_link_decide(text,boolean,text) to anon, authenticated;
