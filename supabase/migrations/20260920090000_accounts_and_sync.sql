-- =============================================================================
-- Wunder Tutor — accounts, learners, consent, usage, plan
-- =============================================================================
--
-- THIS DATABASE HOLDS CHILDREN'S DATA (learners aged 5–17, and adult learners).
-- The rules below are design constraints, not suggestions:
--
--   * PARENT-OWNED ACCOUNT. The only one who signs in is the grown-up (auth.users -> public.parents).
--     Children never sign in, have no credentials, and no email, phone or social handle anywhere here.
--   * ONE RECORD PER LEARNER. The app works offline first; what it knows about a learner (nickname, avatar, age in
--     whole years, settings, progress, pronunciation statistics) is one JSON document, the same shape the app keeps
--     on the device (src/domain/types.ts: ChildProfile). Devices sync that document; `rev` tells them who was first.
--     An earlier draft mirrored the app in 27 tables (supabase/archive/): every table was another way for sync to go
--     wrong, and none of them was needed to restore a learner on a new phone.
--   * NO AUDIO. Recordings stay on the device. Nothing here can hold one.
--   * DATA MINIMISATION. No legal name, date of birth, school, location, photo or device identifier.
--   * CONSENT is an append-only ledger with the wording's version and language.
--   * ERASURE is one call: delete_learner() leaves an empty tombstone (so other devices learn of it),
--     delete_my_account() removes everything including the sign-in.
--   * CLOSED BY DEFAULT. The project was created with "automatically expose new tables" OFF and "automatic RLS" ON:
--     nothing is reachable until it is granted below, and only to the signed-in parent, for their own rows.
--     The `anon` role is granted nothing. usage_daily and plans are written by the server only.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Parents (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.parents (
  id           uuid primary key references auth.users (id) on delete cascade,
  ui_language  text not null default 'en' check (ui_language in ('en', 'zh-Hant')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.parents is 'The grown-up who signs in (1:1 with auth.users). No profile data beyond the app language.';
alter table public.parents enable row level security;

create trigger parents_set_updated_at before update on public.parents
  for each row execute function private.set_updated_at();

-- A parents row appears with the sign-in, so every other table can rely on it.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.parents (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create policy "parents: read own" on public.parents for select to authenticated using (id = (select auth.uid()));
create policy "parents: update own" on public.parents for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select, update (ui_language) on public.parents to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Learners — one document each
-- ---------------------------------------------------------------------------
create table public.learners (
  parent_id       uuid not null default auth.uid() references public.parents (id) on delete cascade,
  -- Made on the device (a learner exists before the first sync). Unique per parent, so nobody can sit on another family's id.
  id              text not null check (char_length(id) between 8 and 64),
  -- The app's ChildProfile. Emptied ('{}') when the learner is deleted.
  state           jsonb not null check (jsonb_typeof(state) = 'object'),
  -- The shape of `state`, so a newer app can upgrade an older document.
  schema_version  integer not null default 1 check (schema_version >= 1),
  -- Goes up by one with every write. A device sends the rev it last saw; if another device was first, its write finds no row.
  rev             bigint not null default 1 check (rev >= 1),
  updated_at      timestamptz not null default now(),
  -- A deleted learner stays as an empty tombstone until purged, so the family's other devices delete it too.
  deleted_at      timestamptz,
  primary key (parent_id, id),
  constraint learners_state_small check (pg_column_size(state) < 1048576),
  -- A nickname, not a place for personal details.
  constraint learners_nickname_short check (deleted_at is not null or char_length(coalesce(state ->> 'name', '')) between 1 and 24),
  constraint learners_age_whole_years check (deleted_at is not null or ((state ->> 'age') ~ '^[0-9]{1,2}$' and (state ->> 'age')::int between 4 and 99)),
  constraint learners_tombstone_is_empty check (deleted_at is null or state = '{}'::jsonb)
);
comment on table public.learners is 'One learner of a family: the app''s whole ChildProfile as a document. No audio, no legal name, no date of birth.';
alter table public.learners enable row level security;

create or replace function private.learners_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.rev <> old.rev + 1 then
      raise exception 'learners.rev must go up by exactly one (was %, got %)', old.rev, new.rev using errcode = '40001';
    end if;
    if old.deleted_at is not null then
      raise exception 'a deleted learner cannot be written to' using errcode = '55000';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger learners_before_write before insert or update on public.learners
  for each row execute function private.learners_before_write();

-- A family, not a school: a runaway device must not fill the table.
create or replace function private.learners_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.learners l where l.parent_id = new.parent_id and l.deleted_at is null) >= 8 then
    raise exception 'a family can have at most 8 learners' using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function private.learners_limit() from public, anon, authenticated;
create trigger learners_limit before insert on public.learners
  for each row execute function private.learners_limit();

create policy "learners: read own" on public.learners for select to authenticated using (parent_id = (select auth.uid()));
create policy "learners: add own" on public.learners for insert to authenticated with check (parent_id = (select auth.uid()));
create policy "learners: write own" on public.learners for update to authenticated using (parent_id = (select auth.uid())) with check (parent_id = (select auth.uid()));
-- No delete policy: deleting goes through delete_learner(), which leaves the tombstone.
grant select, insert, update (state, schema_version, rev) on public.learners to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Consent ledger (append-only; a change of mind is a new row or a revoked_at)
-- ---------------------------------------------------------------------------
create table public.consents (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid not null default auth.uid() references public.parents (id) on delete cascade,
  -- NULL = applies to the whole family account. Not a foreign key: proof that consent existed outlives the learner.
  learner_id      text check (learner_id is null or char_length(learner_id) between 8 and 64),
  consent_type    text not null check (consent_type in (
                    'terms_and_privacy',   -- the account and the learners' profiles
                    'voice_processing',    -- a take goes to the speech service to be scored (not kept there)
                    'page_reading',        -- a photographed page or typed text goes to the reading service
                    'ai_conversation',     -- conversation practice with an AI tutor
                    'share_recordings'     -- the grown-up made a file of recordings to give to the team
                  )),
  policy_version  text not null check (char_length(policy_version) between 1 and 32),
  -- The language the wording was read in, and exactly what it said.
  language        text not null check (language in ('en', 'zh-Hant')),
  wording         text not null check (char_length(wording) between 1 and 4000),
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  check (revoked_at is null or revoked_at >= granted_at)
);
comment on table public.consents is 'What the grown-up agreed to, when, in which language and wording. Rows are never edited except to set revoked_at.';
alter table public.consents enable row level security;
create index consents_parent_idx on public.consents (parent_id, consent_type);

create policy "consents: read own" on public.consents for select to authenticated using (parent_id = (select auth.uid()));
create policy "consents: add own" on public.consents for insert to authenticated with check (parent_id = (select auth.uid()));
create policy "consents: revoke own" on public.consents for update to authenticated using (parent_id = (select auth.uid())) with check (parent_id = (select auth.uid()));
grant select, insert, update (revoked_at) on public.consents to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Usage and plan — written by the server only (the API counts and enforces), read by the family
-- ---------------------------------------------------------------------------
create table public.usage_daily (
  parent_id   uuid not null references public.parents (id) on delete cascade,
  day         date not null,
  scorings    integer not null default 0 check (scorings >= 0),  -- billed pronunciation scorings
  reads       integer not null default 0 check (reads >= 0),     -- pages read
  voice       integer not null default 0 check (voice >= 0),     -- teacher-voice clips generated (not cache hits)
  tutor       integer not null default 0 check (tutor >= 0),     -- conversation turns
  primary key (parent_id, day)
);
comment on table public.usage_daily is 'Per family per day, counted by the API. The family can see it; only the server writes it.';
alter table public.usage_daily enable row level security;
create policy "usage: read own" on public.usage_daily for select to authenticated using (parent_id = (select auth.uid()));
grant select on public.usage_daily to authenticated;

create table public.plans (
  parent_id           uuid primary key references public.parents (id) on delete cascade,
  plan                text not null default 'beta' check (plan in ('beta', 'free', 'family')),
  status              text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  current_period_end  timestamptz,
  source              text check (source in ('stripe', 'app_store', 'play_store', 'manual')),
  updated_at          timestamptz not null default now()
);
comment on table public.plans is 'What the family has paid for. Written by the payment webhooks (service role) only.';
alter table public.plans enable row level security;
create trigger plans_set_updated_at before update on public.plans
  for each row execute function private.set_updated_at();
create policy "plans: read own" on public.plans for select to authenticated using (parent_id = (select auth.uid()));
grant select on public.plans to authenticated;

-- The API's counter: one atomic step, returning the day's totals so the API can compare them with the plan's limits.
create or replace function public.count_usage(p_parent uuid, p_kind text, p_amount integer default 1)
returns public.usage_daily language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Asia/Hong_Kong')::date;
  row_out public.usage_daily;
begin
  if p_kind not in ('scorings', 'reads', 'voice', 'tutor') or p_amount < 0 or p_amount > 100 then
    raise exception 'bad usage kind or amount' using errcode = '22023';
  end if;
  insert into public.usage_daily (parent_id, day) values (p_parent, today) on conflict (parent_id, day) do nothing;
  execute format('update public.usage_daily set %I = %I + $1 where parent_id = $2 and day = $3 returning *', p_kind, p_kind)
    into row_out using p_amount, p_parent, today;
  return row_out;
end;
$$;
revoke all on function public.count_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.count_usage(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Erasure
-- ---------------------------------------------------------------------------
-- Delete one learner: the document is emptied at once; the empty tombstone tells the family's other devices.
create or replace function public.delete_learner(p_learner text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  update public.consents set revoked_at = now()
   where parent_id = (select auth.uid()) and learner_id = p_learner and revoked_at is null;
  -- Deleting wins over whatever another device was about to write: it takes the next rev itself, and the tombstone
  -- refuses every later write. (Clients cannot set deleted_at: they are granted state, schema_version and rev only.)
  update public.learners set state = '{}'::jsonb, deleted_at = now(), rev = rev + 1
   where parent_id = (select auth.uid()) and id = p_learner and deleted_at is null;
end;
$$;
revoke all on function public.delete_learner(text) from public, anon;
grant execute on function public.delete_learner(text) to authenticated;

-- Delete the whole account: every learner, consent, usage row, the plan row, and the sign-in itself.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from public.parents where id = me;   -- cascades to learners, consents, usage_daily, plans
  delete from auth.users where id = me;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
