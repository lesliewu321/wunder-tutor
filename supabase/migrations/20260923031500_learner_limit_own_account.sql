-- The one-learner limit judges only the account's own inserts. A row aimed at another account is left to the row
-- policy, which refuses it as it always did (42501): with the limit checked first, a stranger's insert got "an
-- account has one learner" (54000) instead — a refusal either way, but one that told them whether that account has a
-- learner. Found by supabase/tests/rls.sql after the limit went to one (2026-09-23).
create or replace function private.learners_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_id = auth.uid()
     and (select count(*) from public.learners l where l.parent_id = new.parent_id and l.deleted_at is null) >= 1 then
    raise exception 'an account has one learner' using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function private.learners_limit() from public, anon, authenticated;
