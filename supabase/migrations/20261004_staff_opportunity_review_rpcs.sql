-- Staff review RPCs: list opportunities for staff, reject with mandatory reason (logged to audit_logs + learning_events).
-- Approval uses the existing public.activate_opportunity(uuid).
create or replace function public.list_opportunities_staff()
returns table(id uuid, origin_code text, destination_code text, aircraft_category text, seats integer,
  trigger_type public.opportunity_trigger, status public.opportunity_status, source public.truth_source,
  verified_at timestamptz, expires_at timestamptz, score integer, score_parts jsonb, status_reason text,
  is_demo boolean, segment public.demand_segment, relevance integer, gate_decision text, gate_reason text,
  match_reasons text[], created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
  select o.id, o.origin_code, o.destination_code, mo.category, a.seats, o.trigger_type, o.status, o.source,
         o.verified_at, o.expires_at, o.score, o.score_parts, o.status_reason, a.is_demo,
         m.segment, m.relevance, m.gate_decision, m.gate_reason,
         coalesce(array(select jsonb_array_elements_text(m.reason -> 'text_ar')), '{}'::text[]),
         o.created_at
  from public.opportunities o
  join public.aircraft_availability a on a.id = o.availability_id
  join public.aircraft_models mo on mo.model = a.aircraft_model
  left join lateral (select x.* from public.opportunity_matches x where x.opportunity_id = o.id
                     order by x.relevance desc limit 1) m on true
  order by (o.status = 'ACTIVATION_PENDING') desc, o.created_at desc
  limit 30;
end $$;

create or replace function public.reject_opportunity(p_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare op public.opportunities%rowtype; m record; why text := btrim(coalesce(p_reason, ''));
begin
  if not (select public.is_staff()) then raise exception 'not authorized' using errcode = '42501'; end if;
  if char_length(why) = 0 then raise exception 'reason required'; end if;
  if char_length(why) > 300 then raise exception 'reason too long'; end if;
  select * into op from public.opportunities where id = p_id for update;
  if not found then raise exception 'not found'; end if;
  if op.status <> 'ACTIVATION_PENDING' then
    raise exception 'opportunity is not awaiting approval (status %)', op.status;
  end if;
  update public.opportunities set status = 'REJECTED', status_reason = 'REJECTED_BY_STAFF: ' || why where id = p_id;
  for m in select id, customer_id, related_request_id from public.opportunity_matches
            where opportunity_id = p_id and status = 'MATCHED' loop
    update public.opportunity_matches set status = 'REJECTED', updated_at = now() where id = m.id;
    insert into public.learning_events(customer_id, request_id, availability_id, outcome, channel, details)
    values (m.customer_id, m.related_request_id, op.availability_id, 'REJECTED', null,
            jsonb_build_object('opportunity_id', p_id, 'decided_by', 'staff', 'stage', 'before_activation', 'reason', why));
  end loop;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'opportunity_rejected_by_staff', 'opportunity', p_id, jsonb_build_object('reason', why));
end $$;

revoke all on function public.list_opportunities_staff() from public, anon;
revoke all on function public.reject_opportunity(uuid, text) from public, anon;
grant execute on function public.list_opportunities_staff() to authenticated;
grant execute on function public.reject_opportunity(uuid, text) to authenticated;
