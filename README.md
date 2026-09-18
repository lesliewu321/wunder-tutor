# Wunder Tutor

A pronunciation-first English tutor for children aged 5–15, set up by a parent. Mobile-first PWA.

**Speak → see exactly which sound was off → learn how to fix it → retry → hear and see the improvement.**

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine, intelligence and speech-model unit tests
npm run build      # production build in dist/
```

No keys are needed: pronunciation scoring uses a built-in learner model and the conversation tutor is
scripted. On a device without a microphone, turn on **Parent Zone → Demo microphone** (or tap the link
on the "I can't hear you yet" screen).

## What's real and what's mocked

| Layer | Today | Going live |
| --- | --- | --- |
| Pronunciation scoring | `MockPronunciationProvider` — a learner model (home-language difficulty, retry and long-term improvement). Real signal checks: silence, noise, cut-off speech. | Put `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` in `.env`, run `npm run server`. The app detects it via `/api/health` and switches to `AzurePronunciationProvider`. **Verified live** (eastasia): word / syllable / IPA phoneme scores, omissions and prosody; real responses are test fixtures. |
| Reference ("teacher") voice | Device speech synthesis, by accent (US/UK), normal + slow | Put `GEMINI_API_KEY` in `.env`, run `npm run server`. `POST /api/tts` opens a **Gemini Live (native audio)** session per phrase (`gemini-3.1-flash-live-preview`), checks the model's own transcript so it can never ad-lib a reference pronunciation, and caches the WAV on the server disk and on the device. Falls back to the device voice on any failure. **Verified live**: ~1–2 s per new phrase, instant once cached. |
| Conversation tutor | `ScriptedTutor` (3 scenarios × 3 age bands) | `ANTHROPIC_API_KEY` in `.env` → `ClaudeTutor` through the same proxy, child-safe system prompt, scripted fallback |
| Persistence | On-device: state in localStorage, recordings in IndexedDB (kept apart on purpose) | `supabase/schema.sql` (RLS, parent-owned children, recordings separate from scores). Nothing is applied anywhere yet. |

Keys never reach the browser — see `server/README.md`.

## Where things live

- **Marketing site:** https://wundertutor.com (+ www) — Astro + Tailwind + shadcn/ui in `site/`, its own Pages project
  (`wundertutor-website`). `cd site && npm run dev` / `npm run deploy`. No analytics, no cookies.
- **Hosted beta app:** https://app.wundertutor.com (also https://wunder-tutor.pages.dev) — Cloudflare Pages. The static app comes from `dist/`; the API runs as a
  Pages Function (`functions/api/[[path]].js`) on the same origin. Deploy with `npm run deploy`.
- **The hosted API is locked.** It answers only requests carrying the beta access code (`BETA_ACCESS_CODE` secret), which
  a grown-up enters once in **Parent Zone → Beta access**. With no code set it fails closed. Without the code the app still
  works, in its built-in practice mode.
- **Secrets** live in Cloudflare (`npx wrangler pages secret put NAME`) and, for local dev, in a gitignored `.env`.
- **Teacher takes** are cached in the `TTS_CACHE` KV namespace (hosted), `server/.cache/tts` (local) and on each device.
- **Learner data** is still per-device: state in localStorage, recordings in IndexedDB. No accounts, no sync yet —
  `supabase/schema.sql` is a file, not a project.
- **Local dev:** `npm run dev` + `npm run server` (Node adapter, same core). `npm run cf:dev` runs the Pages Function
  locally in Cloudflare's runtime.

## Architecture

```
src/
  domain/         types shared by every layer (mirrors supabase/schema.sql)
  content/        phoneme catalogue (tips, mouth poses, L1 substitutions), lexicon, course, Lab ladders, scenarios
  speech/         PronunciationProvider interface · mock + Azure providers · recorder · reference voice
  tutor/          feedback (scores → child-sized corrections) · conversation tutor (scripted / Claude)
  intelligence/   persistent pronunciation profile: weak sounds, substitutions, mastery, trend
  engine/         mastery rules, spaced repetition, in-lesson adaptation, rewards
  data/ state/    repository seam + zustand store
  features/       onboarding · home · lesson · speak (the core loop) · lab · practice · progress · profile
  ui/             Pip the mascot, parametric mouth diagram, mic button, kit
server/           runtime-neutral API core (Azure scoring, Gemini Live voice, Claude tutor) + Node adapter for local dev
functions/        Cloudflare Pages Function adapter for the same core
site/             marketing website (Astro, Tailwind v4, shadcn/ui) — a separate package and deployment
supabase/         schema + RLS for the hosted backend
```

Nothing above `speech/` imports a vendor type; replacing Azure means writing one class.

## Age bands

Age sets a band — **Little (5–7)**, **Junior (8–11)**, **Teen (12–15)** — which changes content (words →
phrases → sentences), copy, type scale, mastery bar, and how feedback is delivered (Pip *says* the tip for
non-readers; teens see IPA and optional phonetic detail).

## Privacy (children's data)

- A grown-up does setup, consents to microphone use, and owns everything in the **Parent Zone** (behind a gate).
- Nicknames only. No email, no real name, no free-text chat.
- The mic is live only while the button is red; it releases after every take.
- Recordings stay on the device (newest 3 per phrase), stored separately from scores. They can be turned off,
  deleted alone, deleted with all pronunciation history, or wiped with the profile/account.

## Known limitations

- Azure scoring and the Gemini Live voice have been run against live keys, but only with synthetic audio as the "learner" — not yet with a real child's voice through a real microphone. The Claude tutor has not been run live.
- A Live model is conversational, not a TTS engine: takes are accepted only when their transcript matches, but *how* it pronounces an isolated syllable or a slow sentence needs a listening check once a key is in.
- Without a Gemini key, reference audio is device TTS — quality varies by device, and isolated syllables are approximations.
- The mock model's scores are simulated; with the demo microphone they are not related to real speech at all.
- One fully authored unit ("Yummy Food", 7 lessons × 3 bands), 8 Lab sounds, 3 conversation scenarios.
- PWA icons are SVG only; add PNG icons (180/192/512) before shipping to iOS home screens.
- The parental gate is a simple arithmetic check, not identity verification.
