-- Tongue-twister leaderboard (2026-09-25, Leslie: "add tongue twister gamification. I am thinking of a global/regional
-- leaderboard table too. so user can see"). One row per device and twister: the best PASS (said right, judged by the
-- scorer) and how fast it was said. Written and read by the API only (secret key); nothing a browser role can touch.
-- What is public: an avatar emoji, a nickname (the learner's chosen name, cut short) and a region (a country code
-- from the request) — no age, no account, no device id leaves the API.
create table public.twister_scores (
  id          uuid primary key default gen_random_uuid(),
  twister     text not null check (char_length(twister) between 3 and 64),
  device      text not null check (char_length(device) between 8 and 64),
  nickname    text not null check (char_length(nickname) between 1 and 16),
  avatar      text not null check (char_length(avatar) between 1 and 8),
  region      text not null check (char_length(region) between 2 and 2),
  ms          integer not null check (ms between 200 and 60000),
  score       integer not null check (score between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (twister, device)
);
comment on table public.twister_scores is 'Tongue-twister leaderboard: a device''s best passing time per twister. API-only.';
create index twister_scores_board on public.twister_scores (twister, ms);
create index twister_scores_region on public.twister_scores (twister, region, ms);
alter table public.twister_scores enable row level security;
grant select, insert, update, delete on public.twister_scores to service_role;
