-- =============================================================================
-- Wunder Tutor — Supabase / Postgres schema (single migration, NOT yet applied)
-- =============================================================================
--
-- THIS DATABASE HOLDS CHILDREN'S DATA (learners aged roughly 5–15).
-- It is designed for COPPA (US) and GDPR Art. 8 / UK Age-Appropriate Design Code
-- ("GDPR-K") obligations. The rules below are design constraints, not suggestions:
--
--   * PARENT-OWNED ACCOUNT. The only authenticated principal is the parent
--     (auth.users -> public.parents). Children never sign in, never have
--     credentials, and have NO email address, phone number or social handle
--     anywhere in this schema. Do not add one.
--   * DATA MINIMISATION. A child profile is a nickname, an avatar emoji, an age
--     in whole years (no date of birth), and learning preferences. No legal
--     name, school, location, photo, device identifier or free-text "about me".
--   * VERIFIABLE PARENTAL CONSENT is recorded in public.parental_consents
--     (append-only history: granted_at / revoked_at). Voice recording storage and
--     AI conversation are separate consent types and are OFF unless granted.
--   * RAW AUDIO IS SEPARATE FROM DERIVED METRICS. Voice recordings live in a
--     PRIVATE Storage bucket and are referenced from public.recordings only.
--     Scores (attempts, pronunciation_assessments, *_stats) never depend on the
--     audio: attempts.recording_id is ON DELETE SET NULL, so a parent can erase
--     every recording and keep the learning history.
--   * RIGHT TO ERASURE. public.delete_child_data(child) removes everything held
--     about one child in a single call.
--   * ROW LEVEL SECURITY is enabled on every table. A parent can reach only rows
--     belonging to their own children (public.owns_child). Curriculum tables are
--     read-only for authenticated users; the anon role can read nothing.
--   * No analytics/advertising identifiers, no cross-child or cross-family reads.
--
-- Mapping to src/domain/types.ts
--   * Table/column names mirror the TS domain model in snake_case.
--   * TS timestamps are epoch milliseconds; here they are timestamptz. The
--     repository adapter converts.
--   * The front-end identifies curriculum by string ids (lesson.id, item.id).
--     Curriculum tables therefore carry a unique text `slug` next to the uuid PK,
--     and progress tables store that slug as `*_key` plus an optional uuid FK.
--     This lets the local-first app sync progress before/without seeding the
--     curriculum, and keeps progress if a curriculum row is later removed.
--
-- Conventions: uuid primary keys (gen_random_uuid, built in since PG13),
-- timestamptz everywhere, CHECK constraints instead of enums (cheaper to evolve).
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Utilities
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Accounts: parents, children, consent
-- ---------------------------------------------------------------------------

-- One row per authenticated adult. The id IS the auth.users id.
create table public.parents (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text check (char_length(display_name) <= 80),
  ui_locale         text not null default 'en',
  -- Mirrors ParentSettings. Recording storage is opt-in and additionally requires
  -- an active 'voice_recording_storage' consent row.
  store_recordings  boolean not null default false,
  theme             text not null default 'auto' check (theme in ('auto', 'light', 'dark')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.parents is
  'Adult account holder (1:1 with auth.users). The only principal that can sign in.';

create trigger parents_set_updated_at
  before update on public.parents
  for each row execute function public.set_updated_at();

-- Accents a learner can target (en-US, en-GB). Defined here because child_profiles
-- references it; the rest of the curriculum follows in section 2.
create table public.languages (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,            -- ISO 639-1, e.g. 'en'
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.pronunciation_targets (
  id           uuid primary key default gen_random_uuid(),
  language_id  uuid not null references public.languages (id) on delete cascade,
  code         text not null unique,           -- BCP-47 accent/locale, e.g. 'en-US'
  name         text not null,                  -- 'American English'
  created_at   timestamptz not null default now()
);
comment on table public.pronunciation_targets is
  'Target accents. code matches the Accent type and the speech-assessment locale.';
create index pronunciation_targets_language_idx on public.pronunciation_targets (language_id);

-- A child learner. Deliberately minimal — see header.
create table public.child_profiles (
  id             uuid primary key default gen_random_uuid(),
  parent_id      uuid not null references public.parents (id) on delete cascade,
  -- Nickname chosen by the parent. NOT a legal name; keep it short so it cannot
  -- become a free-text field for personal details.
  name           text not null check (char_length(name) between 1 and 24),
  avatar         text not null default '🦊' check (char_length(avatar) <= 16),
  -- Whole years only; no date of birth is collected.
  age            smallint not null check (age between 4 and 17),
  band           text not null check (band in ('little', 'junior', 'teen')),
  home_language  text not null default 'other'
                 check (home_language in ('es','fr','de','pt','zh','ja','ko','hi','ar','other')),
  level          text not null default 'new' check (level in ('new', 'some', 'confident')),
  goal           text not null default 'fun' check (goal in ('school', 'travel', 'fun', 'friends')),
  accent         text not null default 'en-US' references public.pronunciation_targets (code),
  xp             integer not null default 0 check (xp >= 0),
  daily_goal_xp  integer not null default 30 check (daily_goal_xp between 5 and 500),
  -- PronunciationProfile.fluencyEma / prosodyEma
  fluency_ema    numeric(5,2) check (fluency_ema between 0 and 100),
  prosody_ema    numeric(5,2) check (prosody_ema between 0 and 100),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.child_profiles is
  'Child learner owned by a parent. No email, DOB, legal name, school or location — by design.';
create index child_profiles_parent_idx on public.child_profiles (parent_id);

create trigger child_profiles_set_updated_at
  before update on public.child_profiles
  for each row execute function public.set_updated_at();

-- Consent ledger. Rows are never updated except to set revoked_at; a new grant
-- after a revocation is a new row, so the full history is auditable.
create table public.parental_consents (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid not null references public.parents (id) on delete cascade,
  -- NULL = consent that applies to the whole family account. SET NULL (not cascade)
  -- so proof that consent existed survives erasure of the child's data.
  child_id        uuid references public.child_profiles (id) on delete set null,
  consent_type    text not null check (consent_type in (
                    'terms_and_privacy',        -- baseline: account + child profile
                    'voice_processing',         -- send audio to the speech provider for scoring
                    'voice_recording_storage',  -- keep raw audio in Storage
                    'ai_conversation'           -- LLM conversation partner
                  )),
  policy_version  text not null,                -- version of the notice the parent saw
  method          text not null default 'in_app_parent_gate',
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= granted_at)
);
create index parental_consents_parent_idx on public.parental_consents (parent_id, consent_type);
create index parental_consents_child_idx on public.parental_consents (child_id) where child_id is not null;
-- At most one ACTIVE consent per (parent, child-or-account, type).
create unique index parental_consents_active_uniq
  on public.parental_consents (
    parent_id,
    coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid),
    consent_type
  )
  where revoked_at is null;

-- Deleting a child (by any route: delete_child_data, a plain DELETE, or the parent
-- account cascading) ends that child's consents. They must be revoked BEFORE the FK
-- nulls child_id, otherwise a still-active child-level row would turn into an active
-- account-level row and could collide with parental_consents_active_uniq.
create or replace function public.revoke_child_consents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.parental_consents pc
     set revoked_at = now()
   where pc.child_id = old.id
     and pc.revoked_at is null;
  return old;
end;
$$;
revoke all on function public.revoke_child_consents() from public;

create trigger child_profiles_revoke_consents
  before delete on public.child_profiles
  for each row execute function public.revoke_child_consents();

-- ---------------------------------------------------------------------------
-- 2. Curriculum (shared, read-only for clients; written by service role / seeds)
-- ---------------------------------------------------------------------------

create table public.phonemes (
  id            uuid primary key default gen_random_uuid(),
  language_id   uuid not null references public.languages (id) on delete cascade,
  ipa           text not null,                  -- PhonemeId, e.g. 'θ'
  kind          text not null check (kind in ('vowel', 'diphthong', 'consonant')),
  example_word  text,
  tip           text,                           -- child-friendly articulation hint
  difficulty    smallint not null default 1 check (difficulty between 1 and 5),
  created_at    timestamptz not null default now(),
  unique (language_id, ipa)
);

-- Which phonemes belong to which accent's inventory (e.g. /ɒ/ is en-GB only).
create table public.pronunciation_target_phonemes (
  target_id   uuid not null references public.pronunciation_targets (id) on delete cascade,
  phoneme_id  uuid not null references public.phonemes (id) on delete cascade,
  primary key (target_id, phoneme_id)
);
create index pronunciation_target_phonemes_phoneme_idx on public.pronunciation_target_phonemes (phoneme_id);

create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,            -- Course.id in the front-end
  language_id  uuid not null references public.languages (id),
  title        text not null,
  published    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index courses_language_idx on public.courses (language_id);

create table public.units (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,             -- Unit.id
  course_id   uuid not null references public.courses (id) on delete cascade,
  position    integer not null,
  title       text not null,
  subtitle    text not null default '',
  icon        text not null default '',
  color       text not null default '',
  locked      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (course_id, position)
);

create table public.lessons (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,             -- Lesson.id
  unit_id     uuid not null references public.units (id) on delete cascade,
  position    integer not null,
  title       text not null,
  icon        text not null default '',
  kind        text not null check (kind in
                ('words','phrases','pronunciation','listening','speaking','conversation','review')),
  created_at  timestamptz not null default now(),
  unique (unit_id, position)
);

-- "vocabulary" is the SpeakItem catalogue: every sound, word, phrase or sentence
-- a child can be asked to say or recognise.
create table public.vocabulary (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,            -- SpeakItem.id
  language_id  uuid not null references public.languages (id),
  text         text not null,
  kind         text not null check (kind in ('sound','syllable','word','phrase','sentence')),
  picture      text,                            -- emoji
  meaning      text,
  say          text,                            -- spoken form when it differs from text
  created_at   timestamptz not null default now()
);
create index vocabulary_language_idx on public.vocabulary (language_id);

-- SpeakItem.focus
create table public.vocabulary_phonemes (
  vocabulary_id  uuid not null references public.vocabulary (id) on delete cascade,
  phoneme_id     uuid not null references public.phonemes (id) on delete cascade,
  primary key (vocabulary_id, phoneme_id)
);
create index vocabulary_phonemes_phoneme_idx on public.vocabulary_phonemes (phoneme_id);

-- One row per exercise PER AGE BAND (Lesson.exercises is Record<AgeBand, Exercise[]>).
create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,             -- Exercise.id
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  band        text not null check (band in ('little', 'junior', 'teen')),
  position    integer not null,
  type        text not null check (type in ('speak', 'choose-heard', 'minimal-pair', 'dialogue')),
  -- Type-specific fields that are not items: prompt, answerIndex, tutorLine, picture, focus …
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (lesson_id, band, position)
);

-- Items used by an exercise, with their role inside it.
create table public.exercise_items (
  exercise_id    uuid not null references public.exercises (id) on delete cascade,
  vocabulary_id  uuid not null references public.vocabulary (id) on delete cascade,
  role           text not null check (role in ('item', 'answer', 'option', 'pair', 'reply')),
  position       integer not null default 0,
  primary key (exercise_id, role, position)
);
create index exercise_items_vocabulary_idx on public.exercise_items (vocabulary_id);

-- Achievement catalogue (what can be earned). Earned rows are in child_achievements.
create table public.achievements (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,             -- Achievement.id
  title       text not null,
  detail      text not null default '',
  icon        text not null default '',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Recordings — raw audio references, deliberately separate from all metrics
-- ---------------------------------------------------------------------------

-- The audio bytes live in the PRIVATE Storage bucket 'recordings' at
--   {parent_id}/{child_id}/{recording_id}.wav
-- This table only points at them. Deleting a row here must be paired with
-- removing the Storage object (use the Storage API; see delete_child_data).
-- Nothing derived (scores, stats) references audio content, and the only FK
-- pointing here (attempts.recording_id) is ON DELETE SET NULL.
create table public.recordings (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references public.child_profiles (id) on delete cascade,
  storage_bucket  text not null default 'recordings',
  storage_path    text not null,
  mime_type       text not null default 'audio/wav',
  duration_ms     integer check (duration_ms >= 0),
  size_bytes      integer check (size_bytes >= 0),
  created_at      timestamptz not null default now(),
  -- Retention: a scheduled job should purge rows (and objects) past expires_at.
  expires_at      timestamptz not null default (now() + interval '90 days'),
  unique (storage_bucket, storage_path)
);
comment on table public.recordings is
  'Pointers to raw child voice audio in private Storage. Only populated when the parent has opted in. Safe to delete at any time without losing scores.';
create index recordings_child_created_idx on public.recordings (child_id, created_at desc);
create index recordings_expires_idx on public.recordings (expires_at);

-- ---------------------------------------------------------------------------
-- 4. Progress
-- ---------------------------------------------------------------------------

-- ChildProfile.lessonsCompleted
create table public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references public.child_profiles (id) on delete cascade,
  lesson_key    text not null,                  -- Lesson.id (= lessons.slug)
  lesson_id     uuid references public.lessons (id) on delete set null,
  stars         smallint not null default 0 check (stars between 0 and 3),
  best_avg      numeric(5,2) not null default 0 check (best_avg between 0 and 100),
  times_completed integer not null default 1 check (times_completed >= 0),
  completed_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (child_id, lesson_key)
);
create index lesson_progress_child_completed_idx on public.lesson_progress (child_id, completed_at desc);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id) where lesson_id is not null;

create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

-- ItemProgress: per-item mastery + Leitner spaced repetition.
create table public.item_progress (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.child_profiles (id) on delete cascade,
  item_key    text not null,                    -- SpeakItem.id (= vocabulary.slug)
  item_id     uuid references public.vocabulary (id) on delete set null,
  text        text not null,
  best        numeric(5,2) not null default 0 check (best between 0 and 100),
  mastered    boolean not null default false,
  mastered_at timestamptz,
  box         smallint not null default 0 check (box between 0 and 4),   -- Leitner box
  due_at      timestamptz not null default now(),
  attempts    integer not null default 0 check (attempts >= 0),
  updated_at  timestamptz not null default now(),
  unique (child_id, item_key)
);
-- "What is due for review for this child?" is the hot query.
create index item_progress_child_due_idx on public.item_progress (child_id, due_at);
create index item_progress_item_idx on public.item_progress (item_id) where item_id is not null;

create trigger item_progress_set_updated_at
  before update on public.item_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. AI conversations (declared before attempts so a turn can be linked)
-- ---------------------------------------------------------------------------

-- ConversationRecord + the transcript. Transcripts are speech-recognition text
-- only (never audio) and should be kept short-lived; see retention note below.
create table public.ai_conversations (
  id              uuid primary key default gen_random_uuid(),
  child_id        uuid not null references public.child_profiles (id) on delete cascade,
  scenario_key    text not null,                -- ConversationRecord.scenarioId
  scenario_title  text,
  band            text not null check (band in ('little', 'junior', 'teen')),
  score           numeric(5,2) check (score between 0 and 100),
  strong          text[] not null default '{}', -- words said well
  practice        text[] not null default '{}', -- PhonemeIds to practise
  child_turns     integer not null default 0 check (child_turns >= 0),
  completed       boolean not null default false,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  created_at      timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index ai_conversations_child_created_idx on public.ai_conversations (child_id, created_at desc);

create table public.ai_conversation_turns (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.ai_conversations (id) on delete cascade,
  -- Denormalised so RLS is a single owns_child() call and erasure is one DELETE.
  child_id         uuid not null references public.child_profiles (id) on delete cascade,
  turn_index       integer not null check (turn_index >= 0),
  role             text not null check (role in ('tutor', 'child')),
  text             text not null check (char_length(text) <= 1000),
  created_at       timestamptz not null default now(),
  unique (conversation_id, turn_index)
);
comment on table public.ai_conversation_turns is
  'Transcript lines. Text only. Consider purging turns after 30 days and keeping just the ai_conversations summary.';
create index ai_conversation_turns_child_created_idx on public.ai_conversation_turns (child_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. Attempts and pronunciation assessments (derived metrics — no audio)
-- ---------------------------------------------------------------------------

create table public.attempts (
  id                    uuid primary key default gen_random_uuid(),
  child_id              uuid not null references public.child_profiles (id) on delete cascade,
  item_key              text not null,          -- Attempt.itemId (may be a free-practice id)
  item_id               uuid references public.vocabulary (id) on delete set null,
  lesson_id             uuid references public.lessons (id) on delete set null,
  exercise_id           uuid references public.exercises (id) on delete set null,
  conversation_turn_id  uuid references public.ai_conversation_turns (id) on delete set null,
  text                  text not null,          -- what the child was asked to say
  context               text not null check (context in ('lesson', 'lab', 'practice', 'onboarding', 'conversation')),
  -- Attempt.audioKey. SET NULL: erasing a recording must never erase the score.
  recording_id          uuid references public.recordings (id) on delete set null,
  created_at            timestamptz not null default now()
);
create index attempts_child_created_idx on public.attempts (child_id, created_at desc);
create index attempts_child_item_idx on public.attempts (child_id, item_key, created_at desc);
create index attempts_recording_idx on public.attempts (recording_id) where recording_id is not null;
create index attempts_item_idx on public.attempts (item_id) where item_id is not null;
create index attempts_lesson_idx on public.attempts (lesson_id) where lesson_id is not null;
create index attempts_exercise_idx on public.attempts (exercise_id) where exercise_id is not null;
create index attempts_conversation_turn_idx on public.attempts (conversation_turn_id) where conversation_turn_id is not null;

-- Assessment (provider-neutral). One per attempt.
create table public.pronunciation_assessments (
  id              uuid primary key default gen_random_uuid(),
  attempt_id      uuid not null unique references public.attempts (id) on delete cascade,
  child_id        uuid not null references public.child_profiles (id) on delete cascade,
  provider        text not null,                -- 'azure', 'mock', …
  locale          text references public.pronunciation_targets (code),
  reference_text  text not null,
  overall         numeric(5,2) not null check (overall between 0 and 100),
  accuracy        numeric(5,2) not null check (accuracy between 0 and 100),
  fluency         numeric(5,2) not null check (fluency between 0 and 100),
  completeness    numeric(5,2) not null check (completeness between 0 and 100),
  prosody         numeric(5,2) check (prosody between 0 and 100),   -- optional per provider
  -- WordScore[]: [{ word, score, errorType, syllables:[{text,score}],
  --                 phonemes:[{phoneme,score,heardAs?}] }]
  -- Kept as jsonb: it is always read/written whole with its assessment, and the
  -- queryable aggregates live in phoneme_stats / word_stats.
  words           jsonb not null default '[]'::jsonb check (jsonb_typeof(words) = 'array'),
  duration_ms     integer not null default 0 check (duration_ms >= 0),
  created_at      timestamptz not null default now()
);
create index pronunciation_assessments_child_created_idx
  on public.pronunciation_assessments (child_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. Persistent pronunciation-weakness profile (PronunciationProfile)
-- ---------------------------------------------------------------------------

-- PhonemeStat. `phoneme` is the IPA symbol as returned by the assessment
-- provider; intentionally NOT an FK to public.phonemes because providers can
-- emit symbols outside the curated inventory.
create table public.phoneme_stats (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.child_profiles (id) on delete cascade,
  phoneme      text not null,
  ema          numeric(5,2) not null check (ema between 0 and 100),       -- recency-weighted mean
  first_score  numeric(5,2) not null check (first_score between 0 and 100),
  best         numeric(5,2) not null check (best between 0 and 100),
  count        integer not null default 0 check (count >= 0),
  low_count    integer not null default 0 check (low_count >= 0),
  last_seen    timestamptz not null default now(),
  -- Substitution histogram, e.g. {"s": 4, "f": 1} for θ heard as s / f.
  heard_as     jsonb not null default '{}'::jsonb check (jsonb_typeof(heard_as) = 'object'),
  mastered_at  timestamptz,
  updated_at   timestamptz not null default now(),
  unique (child_id, phoneme),
  check (low_count <= count)
);
-- "Weakest sounds for this child" — served by the unique index + this one.
create index phoneme_stats_child_ema_idx on public.phoneme_stats (child_id, ema);

create trigger phoneme_stats_set_updated_at
  before update on public.phoneme_stats
  for each row execute function public.set_updated_at();

-- WordStat
create table public.word_stats (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references public.child_profiles (id) on delete cascade,
  word        text not null check (word = lower(word)),
  best        numeric(5,2) not null check (best between 0 and 100),
  last_score  numeric(5,2) not null check (last_score between 0 and 100),
  attempts    integer not null default 0 check (attempts >= 0),
  retries     integer not null default 0 check (retries >= 0),
  last_seen   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (child_id, word)
);
create index word_stats_child_last_idx on public.word_stats (child_id, last_score);

create trigger word_stats_set_updated_at
  before update on public.word_stats
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Motivation: daily stats, streaks, earned achievements
-- ---------------------------------------------------------------------------

-- DayStat. `day` is the child's LOCAL calendar date (the client decides).
create table public.daily_stats (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.child_profiles (id) on delete cascade,
  day          date not null,
  attempts     integer not null default 0 check (attempts >= 0),
  score_sum    numeric(10,2) not null default 0 check (score_sum >= 0),
  speaking_ms  integer not null default 0 check (speaking_ms >= 0),
  xp           integer not null default 0 check (xp >= 0),
  updated_at   timestamptz not null default now(),
  unique (child_id, day)
);

create trigger daily_stats_set_updated_at
  before update on public.daily_stats
  for each row execute function public.set_updated_at();

-- ChildProfile.streak — one row per child.
create table public.streaks (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null unique references public.child_profiles (id) on delete cascade,
  count       integer not null default 0 check (count >= 0),
  best        integer not null default 0 check (best >= 0),
  last_day    date,
  updated_at  timestamptz not null default now(),
  check (best >= count)
);

create trigger streaks_set_updated_at
  before update on public.streaks
  for each row execute function public.set_updated_at();

-- Earned achievements / mastery milestones. Item- and phoneme-level mastery is
-- recorded on item_progress.mastered(_at) and phoneme_stats.mastered_at; this
-- table is the child-facing trophy shelf.
create table public.child_achievements (
  id               uuid primary key default gen_random_uuid(),
  child_id         uuid not null references public.child_profiles (id) on delete cascade,
  achievement_key  text not null,               -- Achievement.id (= achievements.slug)
  achievement_id   uuid references public.achievements (id) on delete set null,
  -- Snapshot so the shelf still renders if the catalogue entry changes.
  title            text not null,
  detail           text not null default '',
  icon             text not null default '',
  earned_at        timestamptz not null default now(),
  unique (child_id, achievement_key)
);
create index child_achievements_child_earned_idx on public.child_achievements (child_id, earned_at desc);
create index child_achievements_achievement_idx on public.child_achievements (achievement_id) where achievement_id is not null;

-- ---------------------------------------------------------------------------
-- 9. Ownership helper
-- ---------------------------------------------------------------------------

-- TRUE when the calling (authenticated) parent owns the given child profile.
-- SECURITY DEFINER so policies on other tables can consult child_profiles without
-- recursing through its RLS; STABLE so the planner can cache it per statement;
-- search_path pinned to '' (every reference is schema-qualified) so it cannot be
-- hijacked by objects in a caller-controlled schema.
create or replace function public.owns_child(child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.child_profiles cp
    where cp.id = owns_child.child
      and cp.parent_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_child(uuid) from public;
revoke all on function public.owns_child(uuid) from anon;
grant execute on function public.owns_child(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. Row Level Security
-- ---------------------------------------------------------------------------
-- `(select auth.uid())` rather than `auth.uid()` lets Postgres evaluate it once
-- per statement (initplan) instead of once per row.

-- 10a. Accounts ---------------------------------------------------------------

alter table public.parents enable row level security;
create policy parents_select_own on public.parents
  for select to authenticated using (id = (select auth.uid()));
create policy parents_insert_own on public.parents
  for insert to authenticated with check (id = (select auth.uid()));
create policy parents_update_own on public.parents
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy parents_delete_own on public.parents
  for delete to authenticated using (id = (select auth.uid()));

alter table public.child_profiles enable row level security;
create policy child_profiles_select_own on public.child_profiles
  for select to authenticated using (parent_id = (select auth.uid()));
create policy child_profiles_insert_own on public.child_profiles
  for insert to authenticated with check (parent_id = (select auth.uid()));
create policy child_profiles_update_own on public.child_profiles
  for update to authenticated
  using (parent_id = (select auth.uid())) with check (parent_id = (select auth.uid()));
create policy child_profiles_delete_own on public.child_profiles
  for delete to authenticated using (parent_id = (select auth.uid()));

-- Consent ledger: a parent can read and add their own rows and mark them revoked.
-- No DELETE policy — history is retained (it goes when the account is deleted).
alter table public.parental_consents enable row level security;
create policy parental_consents_select_own on public.parental_consents
  for select to authenticated using (parent_id = (select auth.uid()));
create policy parental_consents_insert_own on public.parental_consents
  for insert to authenticated
  with check (
    parent_id = (select auth.uid())
    and (child_id is null or public.owns_child(child_id))
  );
create policy parental_consents_update_own on public.parental_consents
  for update to authenticated
  using (parent_id = (select auth.uid()))
  with check (
    parent_id = (select auth.uid())
    and (child_id is null or public.owns_child(child_id))
  );
-- Column-level: the only thing a client may change on an existing consent row is
-- revoked_at, so granted_at / consent_type / policy_version cannot be rewritten.
revoke update on public.parental_consents from authenticated;
grant update (revoked_at) on public.parental_consents to authenticated;

-- 10b. Child-owned data: identical policy on every table ------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'recordings',
    'lesson_progress',
    'item_progress',
    'attempts',
    'pronunciation_assessments',
    'phoneme_stats',
    'word_stats',
    'daily_stats',
    'streaks',
    'child_achievements',
    'ai_conversations',
    'ai_conversation_turns'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.owns_child(child_id))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.owns_child(child_id))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.owns_child(child_id)) with check (public.owns_child(child_id))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.owns_child(child_id))',
      t || '_delete_own', t);
    -- The anon role has no business here at all.
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

revoke all on public.parents, public.child_profiles, public.parental_consents from anon;

-- 10c. Curriculum: readable by any signed-in user, writable only by service role ---
-- (RLS enabled + a SELECT policy only => no client INSERT/UPDATE/DELETE.)

do $$
declare
  t text;
begin
  foreach t in array array[
    'languages',
    'pronunciation_targets',
    'phonemes',
    'pronunciation_target_phonemes',
    'courses',
    'units',
    'lessons',
    'vocabulary',
    'vocabulary_phonemes',
    'exercises',
    'exercise_items',
    'achievements'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_read_authenticated', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Private Storage bucket for recordings
-- ---------------------------------------------------------------------------
-- Object path convention: {parent_id}/{child_id}/{recording_id}.wav
-- The first folder must be the caller's own auth uid, so one family can never
-- read, write or list another family's audio. No UPDATE policy: audio is immutable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 5242880, array['audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg'])
on conflict (id) do nothing;

create policy recordings_objects_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recordings_objects_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recordings_objects_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 12. Right to erasure
-- ---------------------------------------------------------------------------

-- Deletes everything held about one child. Callable by the owning parent (or the
-- service role, where auth.uid() is null and the ownership check is skipped).
--
--   delete_profile = true  (default): removes the child profile itself; every
--                          child table cascades from it.
--   delete_profile = false: wipes all learning data, recordings and transcripts
--                          but keeps the (reset) profile so the child can start over.
--
-- RETURNS the Storage objects that belonged to the child. Postgres cannot remove
-- Storage objects safely, so the caller MUST pass the returned paths to
-- supabase.storage.from(bucket).remove(paths) (or do it in an Edge Function) to
-- complete the erasure. When the profile is deleted, consent rows are kept as proof
-- of consent but are marked revoked and detached from the child (child_id -> NULL).
create or replace function public.delete_child_data(child uuid, delete_profile boolean default true)
returns table (storage_bucket text, storage_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is not null and not public.owns_child(delete_child_data.child) then
    raise exception 'not authorised to delete this child profile'
      using errcode = '42501';
  end if;
  -- No uid: only trusted callers (service role via the API, or a direct admin SQL
  -- session) may proceed. EXECUTE is already revoked from anon; this is belt and braces.
  if caller is null and coalesce((select auth.role()), '') in ('anon', 'authenticated') then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Collect the audio pointers first so the caller can purge Storage.
  return query
    select r.storage_bucket, r.storage_path
    from public.recordings r
    where r.child_id = delete_child_data.child;

  if delete_profile then
    -- Cascades to every child-owned table. The child_profiles BEFORE DELETE trigger
    -- revokes the child's consents, then the FK detaches them (child_id -> NULL).
    delete from public.child_profiles cp where cp.id = delete_child_data.child;
    return;
  end if;

  -- Data reset only: consents stay active because the parent has not withdrawn them.

  delete from public.attempts a               where a.child_id = delete_child_data.child; -- cascades to assessments
  delete from public.pronunciation_assessments pa where pa.child_id = delete_child_data.child;
  delete from public.recordings r             where r.child_id = delete_child_data.child;
  delete from public.ai_conversations c       where c.child_id = delete_child_data.child; -- cascades to turns
  delete from public.ai_conversation_turns t  where t.child_id = delete_child_data.child;
  delete from public.phoneme_stats ps         where ps.child_id = delete_child_data.child;
  delete from public.word_stats ws            where ws.child_id = delete_child_data.child;
  delete from public.item_progress ip         where ip.child_id = delete_child_data.child;
  delete from public.lesson_progress lp       where lp.child_id = delete_child_data.child;
  delete from public.daily_stats ds           where ds.child_id = delete_child_data.child;
  delete from public.streaks s                where s.child_id = delete_child_data.child;
  delete from public.child_achievements ca    where ca.child_id = delete_child_data.child;

  update public.child_profiles cp
     set xp = 0, fluency_ema = null, prosody_ema = null
   where cp.id = delete_child_data.child;
end;
$$;

revoke all on function public.delete_child_data(uuid, boolean) from public;
revoke all on function public.delete_child_data(uuid, boolean) from anon;
grant execute on function public.delete_child_data(uuid, boolean) to authenticated, service_role;

-- Convenience for "delete all recordings, keep the scores": a plain
--   delete from public.recordings where child_id = :child returning storage_bucket, storage_path;
-- is allowed by RLS, and attempts.recording_id becomes NULL automatically.

-- ---------------------------------------------------------------------------
-- 13. Reference seed (safe to re-run)
-- ---------------------------------------------------------------------------

insert into public.languages (code, name)
values ('en', 'English')
on conflict (code) do nothing;

insert into public.pronunciation_targets (language_id, code, name)
select l.id, v.code, v.name
from public.languages l
cross join (values ('en-US', 'American English'), ('en-GB', 'British English')) as v (code, name)
where l.code = 'en'
on conflict (code) do nothing;

commit;
