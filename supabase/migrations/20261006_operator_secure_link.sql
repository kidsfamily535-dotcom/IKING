-- شاشة المشغّل: رابط آمن بالبريد بلا حساب.
-- المبدأ: المشغّل يرى تفاصيل الرحلة التشغيلية فقط (لا هوية عميل ولا النص الخام) ويرد مرة واحدة: عرض أو اعتذار.
-- الرمز العشوائي (256 بت) لا يُخزَّن، يُخزَّن بصمته فقط (SHA-256). ينتهي بوقت محدد ويمكن إعادة إصداره (يلغي القديم).

alter table public.operator_rfqs
  add column if not exists link_token_hash text,
  add column if not exists link_issued_at timestamptz,
  add column if not exists link_expires_at timestamptz,
  add column if not exists link_first_opened_at timestamptz;
create unique index if not exists operator_rfqs_link_token_hash_key on public.operator_rfqs(link_token_hash) where link_token_hash is not null;

-- 1) المنطق المشترك لتسجيل الرد (كان داخل loop_record_reply). نفس القواعد حرفيًا + مصدر الإدخال.
create or replace function public._loop_apply_reply(p_rfq uuid, p_available boolean, p_aircraft_type text, p_price numeric, p_currency text,
  p_includes_fees boolean, p_valid_until timestamptz, p_flight_minutes integer, p_restrictions text, p_reason text, p_via text)
returns uuid language plpgsql security definer set search_path to '' as $f$
declare f public.operator_rfqs%rowtype; r public.travel_requests%rowtype; v_offer uuid;
begin
  select * into f from public.operator_rfqs where id = p_rfq for update;
  if not found then raise exception 'rfq not found'; end if;
  if f.status not in ('AWAITING','NO_RESPONSE') then raise exception 'rfq already has a reply (status %)', f.status; end if;
  select * into r from public.travel_requests where id = f.travel_request_id for update;
  if r.loop_status in ('CLIENT_DECLINED','CLOSED_NO_SUPPLY','CLOSED_NO_OPERATOR_REPLY','CLOSED_NO_CLIENT_REPLY','CANCELLED','CONFIRMED') then
    raise exception 'request is closed (state %)', r.loop_status; end if;
  if p_available is null then raise exception 'availability answer required'; end if;

  if not p_available then
    update public.operator_rfqs set status = 'DECLINED', responded_at = now(), decline_reason = left(p_reason, 300) where id = p_rfq;
    perform public._loop_after_rfq_closed(f.travel_request_id);
    perform public._loop_audit('loop_operator_declined', 'operator_rfq', p_rfq, jsonb_build_object('via', p_via));
    return null;
  end if;

  if p_aircraft_type is null or char_length(trim(p_aircraft_type)) < 2 then raise exception 'aircraft type required'; end if;
  if p_price is null or p_price <= 0 then raise exception 'price must be positive'; end if;
  if p_currency is null or p_currency not in ('USD','SAR','AED') then raise exception 'currency must be USD, SAR or AED'; end if;
  if p_includes_fees is null then raise exception 'state whether the price includes fees'; end if;
  if p_valid_until is null or p_valid_until < now() + interval '10 minutes' then raise exception 'offer validity must be at least 10 minutes ahead'; end if;

  insert into public.rfq_offers(rfq_id, travel_request_id, aircraft_type, operator_total_price, currency, includes_fees,
    flight_time_minutes, restrictions, valid_until, entered_via, entered_by)
  values (p_rfq, f.travel_request_id, trim(p_aircraft_type), p_price, p_currency, p_includes_fees,
    p_flight_minutes, left(p_restrictions, 500), p_valid_until, p_via, (select auth.uid()))
  returning id into v_offer;
  update public.operator_rfqs set status = 'OFFER', responded_at = now() where id = p_rfq;
  if r.loop_status in ('AWAITING_OFFER','SEARCHING') then
    perform public._loop_set(r.id, 'OFFER_RECEIVED', 'operator offer received');
  end if;
  perform public._loop_audit('loop_operator_offer', 'operator_rfq', p_rfq, jsonb_build_object('offer', v_offer, 'via', p_via));
  return v_offer;
end $f$;

-- 2) الدالة القديمة للوسيط تبقى بنفس التوقيع والسلوك، فقط تمر عبر المنطق المشترك.
create or replace function public.loop_record_reply(p_rfq uuid, p_available boolean, p_aircraft_type text default null, p_price numeric default null,
  p_currency text default null, p_includes_fees boolean default null, p_valid_until timestamptz default null, p_flight_minutes integer default null,
  p_restrictions text default null, p_reason text default null)
returns uuid language plpgsql security definer set search_path to '' as $f$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return public._loop_apply_reply(p_rfq, p_available, p_aircraft_type, p_price, p_currency, p_includes_fees, p_valid_until, p_flight_minutes, p_restrictions, p_reason, 'broker_on_behalf');
end $f$;

-- 3) الوسيط يصدر رابطًا لطلب مفتوح عند مشغّل (يُعرض الرمز مرة واحدة فقط ولا يمكن استرجاعه لاحقًا).
create or replace function public.loop_issue_operator_link(p_rfq uuid, p_ttl_hours integer default 48)
returns text language plpgsql security definer set search_path to '' as $f$
declare f public.operator_rfqs%rowtype; v_status public.loop_status; v_token text;
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_ttl_hours is null or p_ttl_hours < 1 or p_ttl_hours > 168 then raise exception 'link lifetime must be 1 to 168 hours'; end if;
  select * into f from public.operator_rfqs where id = p_rfq for update;
  if not found then raise exception 'rfq not found'; end if;
  if f.status not in ('AWAITING','NO_RESPONSE') then raise exception 'rfq already has a reply (status %)', f.status; end if;
  select loop_status into v_status from public.travel_requests where id = f.travel_request_id;
  if v_status in ('CLIENT_DECLINED','CLOSED_NO_SUPPLY','CLOSED_NO_OPERATOR_REPLY','CLOSED_NO_CLIENT_REPLY','CANCELLED','CONFIRMED') then
    raise exception 'request is closed (state %)', v_status; end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.operator_rfqs
     set link_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
         link_issued_at = now(), link_expires_at = now() + make_interval(hours => p_ttl_hours), link_first_opened_at = null
   where id = p_rfq;
  perform public._loop_audit('loop_operator_link_issued', 'operator_rfq', p_rfq, jsonb_build_object('ttl_hours', p_ttl_hours));
  return v_token;
end $f$;

-- 4) ما يراه المشغّل: تفاصيل تشغيلية فقط. لا customer_id ولا raw_text ولا أي سعر أو هامش داخلي.
create or replace function public.operator_link_view(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare f public.operator_rfqs%rowtype; r public.travel_requests%rowtype; o public.rfq_offers%rowtype;
        ao public.airports%rowtype; ad public.airports%rowtype;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state','INVALID'); end if;
  select * into f from public.operator_rfqs where link_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then return jsonb_build_object('state','INVALID'); end if;
  select * into r from public.travel_requests where id = f.travel_request_id;

  if f.status in ('OFFER','DECLINED') then
    select * into o from public.rfq_offers where rfq_id = f.id;
    return jsonb_build_object('state','ANSWERED','answer',f.status,'operator_name',f.operator_name,'answered_at',f.responded_at,
      'offer', case when o.id is null then null else jsonb_build_object('aircraft_type',o.aircraft_type,'price',o.operator_total_price,'currency',o.currency,
        'includes_fees',o.includes_fees,'valid_until',o.valid_until,'flight_minutes',o.flight_time_minutes,'restrictions',o.restrictions) end);
  end if;
  if f.link_expires_at is null or f.link_expires_at < now() then return jsonb_build_object('state','EXPIRED'); end if;
  if r.loop_status in ('CLIENT_DECLINED','CLOSED_NO_SUPPLY','CLOSED_NO_OPERATOR_REPLY','CLOSED_NO_CLIENT_REPLY','CANCELLED','CONFIRMED') then
    return jsonb_build_object('state','CLOSED'); end if;

  if f.link_first_opened_at is null then
    update public.operator_rfqs set link_first_opened_at = now() where id = f.id;
    perform public._loop_audit('loop_operator_link_opened', 'operator_rfq', f.id, '{}'::jsonb);
  end if;
  select * into ao from public.airports where iata_code = r.origin_code;
  select * into ad from public.airports where iata_code = r.destination_code;
  return jsonb_build_object('state','OPEN','operator_name',f.operator_name,'expires_at',f.link_expires_at,
    'trip', jsonb_build_object('origin_code',r.origin_code,'origin_ar',ao.name_ar,'origin_en',ao.name_en,
      'destination_code',r.destination_code,'destination_ar',ad.name_ar,'destination_en',ad.name_en,
      'travel_date',r.travel_date,'departure_period',r.departure_period,'passengers',r.passengers,
      'baggage_note',left(r.baggage_note,200),'return_requested',r.return_requested));
end $f$;

-- 5) رد المشغّل (مرة واحدة). مدة صلاحية العرض تُحسب في الخادم لا في ساعة جهاز المشغّل.
create or replace function public.operator_link_reply(p_token text, p_available boolean, p_aircraft_type text default null, p_price numeric default null,
  p_currency text default null, p_includes_fees boolean default null, p_valid_hours integer default null, p_flight_minutes integer default null,
  p_restrictions text default null, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare f public.operator_rfqs%rowtype; v_offer uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'invalid link' using errcode = '42501'; end if;
  select * into f from public.operator_rfqs where link_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'invalid link' using errcode = '42501'; end if;
  if f.link_expires_at is null or f.link_expires_at < now() then raise exception 'link expired' using errcode = '42501'; end if;
  if p_available is null then raise exception 'availability answer required'; end if;
  if p_available then
    if p_valid_hours is null or p_valid_hours < 1 or p_valid_hours > 72 then raise exception 'offer validity must be 1 to 72 hours'; end if;
    if p_flight_minutes is not null and (p_flight_minutes < 10 or p_flight_minutes > 1200) then raise exception 'flight time out of range'; end if;
  end if;
  v_offer := public._loop_apply_reply(f.id, p_available, p_aircraft_type, p_price, p_currency, p_includes_fees,
    case when p_available then now() + make_interval(hours => p_valid_hours) end, p_flight_minutes, p_restrictions, p_reason, 'operator_link');
  return jsonb_build_object('ok', true, 'result', case when p_available then 'OFFER' else 'DECLINED' end);
end $f$;

revoke all on function public._loop_apply_reply(uuid,boolean,text,numeric,text,boolean,timestamptz,integer,text,text,text) from public, anon, authenticated;
revoke all on function public.loop_issue_operator_link(uuid,integer) from public, anon;
grant execute on function public.loop_issue_operator_link(uuid,integer) to authenticated;
revoke all on function public.operator_link_view(text) from public;
revoke all on function public.operator_link_reply(text,boolean,text,numeric,text,boolean,integer,integer,text,text) from public;
grant execute on function public.operator_link_view(text) to anon, authenticated;
grant execute on function public.operator_link_reply(text,boolean,text,numeric,text,boolean,integer,integer,text,text) to anon, authenticated;
revoke all on function public.loop_record_reply(uuid,boolean,text,numeric,text,boolean,timestamptz,integer,text,text) from public, anon;
grant execute on function public.loop_record_reply(uuid,boolean,text,numeric,text,boolean,timestamptz,integer,text,text) to authenticated;
