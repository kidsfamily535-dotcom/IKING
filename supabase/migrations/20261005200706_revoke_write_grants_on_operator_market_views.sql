-- These role-filtered read views should never accept writes.
revoke insert, update, delete, truncate, references, trigger on public.operator_market_sightings from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.operator_market_legs from anon, authenticated;
grant select on public.operator_market_sightings to authenticated;
grant select on public.operator_market_legs to authenticated;
comment on view public.operator_market_sightings is 'Read-only. SECURITY DEFINER on purpose: rows are filtered inside the view to staff and active operators; underlying tables stay staff-only.';
comment on view public.operator_market_legs is 'Read-only. SECURITY DEFINER on purpose: rows are filtered inside the view to staff and active operators; underlying tables stay staff-only.';
