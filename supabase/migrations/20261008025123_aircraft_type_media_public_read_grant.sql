-- The RLS policy already allowed anon SELECT, but the table-level grant was missing, so the browser got "permission denied".
grant select on public.aircraft_type_media to anon;
-- Least privilege: writes go through refresh_aircraft_type_media (service_role only).
revoke insert, update, delete on public.aircraft_type_media from authenticated;
