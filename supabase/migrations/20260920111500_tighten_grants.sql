-- =============================================================================
-- Wunder Tutor — nothing more than what was granted on purpose
-- =============================================================================
-- Found by checking the grants after the first migration (2026-09-20):
--
--   * The project's defaults still hand TRUNCATE, REFERENCES and TRIGGER on every new public table to `anon`,
--     `authenticated` and `service_role`. The REST API cannot issue any of them, but TRUNCATE is not subject to row
--     level security, so it must not sit with a role a browser can hold. Taken away here, and from the defaults, so
--     the tables of later migrations start clean too.
--   * `public.rls_auto_enable()` — Supabase's own event-trigger function behind the "automatic RLS" project setting —
--     was executable by everyone (the security advisor's one finding that was not intended). It can only run as an
--     event trigger, which needs no EXECUTE privilege, so nobody needs to be able to call it.
--
-- What the security advisor still reports, on purpose: `delete_learner()` and `delete_my_account()` are SECURITY
-- DEFINER functions a signed-in parent can call. They have to be: a parent may not set `deleted_at` or touch
-- `auth.users` directly, and both functions act on `auth.uid()`'s own rows only.
-- =============================================================================

revoke truncate, references, trigger on all tables in schema public from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated, service_role;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
