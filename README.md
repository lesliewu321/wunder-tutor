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
| Pronunciation scoring | `MockPronunciationProvider` — a learner model (home-language difficulty, retry and long-term improvement). Real signal checks: silence, noise, cut-off speech. | Put `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` in `.env`, run `npm run server`. The app detects it via `/api/health` and switches to `AzurePronunciationProvider`. **Not yet exercised against a live key.** |
| Reference ("teacher") voice | Device speech synthesis, by accent (US/UK), normal + slow | Swap the `ReferenceVoice` implementation in `src/speech/voice.ts` for recorded or neural audio |
| Conversation tutor | `ScriptedTutor` (3 scenarios × 3 age bands) | `ANTHROPIC_API_KEY` in `.env` → `ClaudeTutor` through the same proxy, child-safe system prompt, scripted fallback |
| Persistence | On-device: state in localStorage, recordings in IndexedDB (kept apart on purpose) | `supabase/schema.sql` (RLS, parent-owned children, recordings separate from scores). Nothing is applied anywhere yet. |

Keys never reach the browser — see `server/README.md`.

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
server/           zero-dependency API proxy (Azure Speech, Claude)
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

- Azure and Claude adapters follow the documented contracts but have not been run against live services.
- Reference audio is device TTS — quality varies by device, and isolated syllables are approximations.
- The mock model's scores are simulated; with the demo microphone they are not related to real speech at all.
- One fully authored unit ("Yummy Food", 7 lessons × 3 bands), 8 Lab sounds, 3 conversation scenarios.
- PWA icons are SVG only; add PNG icons (180/192/512) before shipping to iOS home screens.
- The parental gate is a simple arithmetic check, not identity verification.
