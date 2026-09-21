-- =============================================================================
-- Wunder Tutor — invite codes, and the recordings families choose to give back
-- =============================================================================
-- Both are written by the API only (with the project's secret key). No browser role is granted anything on them:
-- a family never reads another family's code usage, and nobody but the Wunder Tutor team reads a recording.
--
-- 1. Invite codes (Leslie, 2026-09-21): many codes instead of one shared passphrase, each good for 10 families and
--    for 14 days — the places left and the end date are the urgency. The limit is enforced when a code is REDEEMED:
--    the app only keeps a code once the server has accepted it for this device. After that, a family that joined is
--    never turned away because the code later expired or filled up; the date is for joining, not a cut-off.
--
-- 2. Contributions (Leslie, 2026-09-21): "so parents don't need to download and send data for testing". A practice
--    recording already travels to the server to be scored. With the learner's consent the server now keeps that copy
--    instead of discarding it — so nothing new leaves the device. Stored with no name: the device's random id, the
--    age band, home language, what was asked and what the scorer said. That is exactly what the manual export in
--    Settings has always contained, arriving by itself.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Invite codes
-- ---------------------------------------------------------------------------
create table public.invite_codes (
  code        text primary key check (code ~ '^[A-Z0-9-]{4,32}$'),
  places      integer not null default 10 check (places between 1 and 1000),
  expires_at  timestamptz not null,
  -- Who the code was handed to, for Leslie's own memory ("parents at St Paul's, WhatsApp"). Never shown to anyone.
  note        text check (char_length(note) <= 200),
  disabled    boolean not null default false,
  created_at  timestamptz not null default now()
);
comment on table public.invite_codes is 'Invite codes: each good for `places` devices until `expires_at`. Written by the team; read by the API.';
alter table public.invite_codes enable row level security;
grant select, insert, update on public.invite_codes to service_role;

create table public.invite_redemptions (
  code        text not null references public.invite_codes (code) on delete cascade,
  -- A random id the app makes once and keeps on the device. Not a person, not a phone number, not a sign-in.
  device      text not null check (char_length(device) between 8 and 64),
  redeemed_at timestamptz not null default now(),
  primary key (code, device)
);
comment on table public.invite_redemptions is 'Which device took one of an invite code''s places. Written by redeem_invite() only.';
alter table public.invite_redemptions enable row level security;
grant select on public.invite_redemptions to service_role;

-- Taking a place is one atomic step: the code row is locked, so ten places cannot become eleven when two families
-- enter the same code in the same second. A device that already has a place keeps it, whatever the date or count.
create or replace function public.redeem_invite(p_code text, p_device text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.invite_codes;
  used integer;
begin
  if p_device is null or char_length(p_device) not between 8 and 64 then
    raise exception 'bad device id' using errcode = '22023';
  end if;
  select * into c from public.invite_codes where code = upper(btrim(p_code)) for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  select count(*) into used from public.invite_redemptions where code = c.code;
  if exists (select 1 from public.invite_redemptions where code = c.code and device = p_device) then
    return jsonb_build_object('ok', true, 'reason', 'again', 'places', c.places, 'used', used, 'expires_at', c.expires_at);
  end if;
  if c.disabled then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;
  if c.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'expires_at', c.expires_at);
  end if;
  if used >= c.places then
    return jsonb_build_object('ok', false, 'reason', 'full', 'places', c.places, 'used', used);
  end if;
  insert into public.invite_redemptions (code, device) values (c.code, p_device);
  return jsonb_build_object('ok', true, 'reason', 'new', 'places', c.places, 'used', used + 1, 'expires_at', c.expires_at);
end;
$$;
revoke all on function public.redeem_invite(text, text) from public, anon, authenticated;
grant execute on function public.redeem_invite(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Contributed recordings
-- ---------------------------------------------------------------------------
create table public.contributions (
  id            uuid primary key default gen_random_uuid(),
  device        text not null check (char_length(device) between 8 and 64),
  locale        text not null check (locale in ('en-US', 'en-GB', 'zh-CN', 'fr-FR')),
  band          text check (band in ('little', 'junior', 'teen', 'adult')),
  home_language text check (char_length(home_language) <= 16),
  reference     text not null check (char_length(reference) <= 500),
  overall       integer check (overall between 0 and 100),
  -- The scorer's own answer for this recording, exactly as it came back: what accuracy work compares against.
  azure         jsonb,
  audio_path    text not null,
  app_version   text check (char_length(app_version) <= 40),
  created_at    timestamptz not null default now()
);
comment on table public.contributions is 'Practice recordings a learner chose to give back, with what was asked and how it scored. No name. Written by the API only.';
create index contributions_device on public.contributions (device);
alter table public.contributions enable row level security;
grant select, insert, delete on public.contributions to service_role;

-- The audio itself. Private: no policy is granted to any browser role, so only the secret key can read or write it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contributions', 'contributions', false, 5242880, array['audio/wav'])
on conflict (id) do nothing;
