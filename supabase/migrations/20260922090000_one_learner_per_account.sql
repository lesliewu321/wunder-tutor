-- One learner per account (Leslie, 2026-09-22: "family account too complex. one user per account"). The account is
-- the learner's own; a learner under 18 has a parent's consent (recorded in public.consents with its wording).
-- Accounts from before keep the learners they have: the app syncs the one used most recently (src/account/sync.ts).
-- The tables keep their first names (parents, parent_id): an account's owner is now the learner.
create or replace function private.learners_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.learners l where l.parent_id = new.parent_id and l.deleted_at is null) >= 1 then
    raise exception 'an account has one learner' using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function private.learners_limit() from public, anon, authenticated;
