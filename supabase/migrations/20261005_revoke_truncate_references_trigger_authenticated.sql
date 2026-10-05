-- Applied to live I KING on 2026-10-05 (owner-approved).
-- TRUNCATE is not covered by RLS; REFERENCES/TRIGGER are not needed by the app.
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;
