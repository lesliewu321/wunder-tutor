# Wunder Tutor

A pronunciation-first tutor for **English** (American by default, British optional) and **Mandarin (Putonghua)**.
Built first for Hong Kong children and teens aged 5–17 (Cantonese at home), with a grown-up mode so parents can learn too.
A PWA for phones, and a home learning platform on tablets.

**Speak → see exactly which sound (or tone) was off → learn how to fix it → retry → hear and see the improvement.**

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine, intelligence, speech-model, Mandarin and API unit tests
npm run build      # production build in dist/
```

No keys are needed: pronunciation scoring uses a built-in learner model and the conversation tutor is
scripted. On a device without a microphone, turn on **Parent Zone → Demo microphone** (or tap the link
on the "I can't hear you yet" screen).

## What's real and what's mocked

| Layer | Today | Going live |
| --- | --- | --- |
| Pronunciation scoring | `MockPronunciationProvider` — a learner model (home-language difficulty, Cantonese tone slips, retry and long-term improvement). Real signal checks: silence, noise, cut-off speech. | Put `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` in `.env`, run `npm run server`. The app detects it via `/api/health` and switches to `AzurePronunciationProvider`. **Verified live** (eastasia) for en-US, en-GB and zh-CN — see *Accuracy* below. |
| Reference ("teacher") voice | Device speech synthesis, by accent (US/UK) and for Mandarin, normal + slow | Put `GEMINI_API_KEY` in `.env`, run `npm run server`. `POST /api/tts` opens a **Gemini Live (native audio)** session per phrase (`gemini-3.1-flash-live-preview`), checks the model's own transcript so it can never ad-lib a reference pronunciation (Mandarin takes are also scored by Azure before they are kept), and caches the WAV on the server and on the device. Falls back to the device voice on any failure. |
| Conversation tutor | `ScriptedTutor` (3 scenarios × age bands, English only) | `ANTHROPIC_API_KEY` in `.env` → `ClaudeTutor` through the same proxy, child-safe system prompt, scripted fallback |
| Persistence | On-device: state in localStorage, recordings in IndexedDB (kept apart on purpose) | `supabase/schema.sql` (RLS, parent-owned children, recordings separate from scores). Nothing is applied anywhere yet. |

Keys never reach the browser — see `server/README.md`.

## Accuracy

Accuracy of the feedback is the product's first goal: never tell a learner a correct sound was wrong, and when
something was wrong, say exactly what came out. How it works:

- **US English** (default): Azure's phoneme scores plus its own "what was heard" candidates, and a **likely-mistake
  check** — the same audio is also scored against the mistake a Cantonese speaker tends to make ("fank you", "wery");
  if that fits clearly better, the app says so ("your *th* sounded like *f*").
- **British English**: Azure's en-GB scorer is harsh on single words and cannot name sounds, so British word scores
  come from its sound scores, and the same audio is also scored as US English — evidence is borrowed only for sounds
  the two accents share (never R or the vowels that differ).
- **Mandarin**: per-character pinyin + tone from Azure zh-CN, plus the app's own **tone check**: a pitch tracker
  (YIN + Viterbi) and a small learned tone model, normalised to the learner's voice, with tone-change rules (3-3, 一,
  不, neutral tones). Likely mistakes (是 shì → 四 sì, 你 nǐ → 李 lǐ, -ng → -n) are re-scored as for English.

Measured on a labelled synthetic set (`eval/README.md`, 2026-09-19):

| | False alarms | Mistakes caught | Right sound named |
| --- | --- | --- | --- |
| US English | 2.3% | 87.6% | 80.1% |
| British English | 3.3% | 85.7% | 73.4% |
| Mandarin | 6.7% | 75.4% (tones 83.6%) | tones 91.1%; "sounded like" never wrong on the set |

Mandarin is measured on six voices with tone models that never heard the voice under test. A brand-new learner's
first takes (before the app knows their voice) are checked more carefully: 5.9% false alarms, 72.5% of tone errors
caught, until three takes are in. Synthetic adult voices, not children — a real child's voice has not been measured yet.

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
  content/        sound catalogue (tips, mouth poses, Cantonese substitutions), lexicon, courses, Lab ladders, scenarios,
                  likely English mistakes (alternatives-en.ts)
  content/zh/     Mandarin: course (Simplified + Traditional), pinyin + tone-change rules, sound guides, likely mistakes,
                  display script
  speech/         PronunciationProvider interface · mock + Azure providers · recorder · pitch tracker · reference voice
  speech/zh/      Mandarin scoring: per-character assessment, tone reading (toneModel.ts is generated by eval/)
  tutor/          feedback (scores → learner-sized corrections) · conversation tutor (scripted / Claude)
  intelligence/   persistent pronunciation profile: weak sounds, substitutions, mastery, trend
  engine/         mastery rules, spaced repetition, in-lesson adaptation, rewards
  data/ state/    repository seam + zustand store
  features/       onboarding · home · lesson · speak (the core loop) · lab · practice · progress · profile
  ui/             Pip the mascot, parametric mouth diagram, tone picture, mic button, kit
  styles/         tokens, screens, speaking screen, tablet.css (tablet layouts)
server/           runtime-neutral API core (Azure scoring, Gemini Live voice, Claude tutor) + Node adapter for local dev
functions/        Cloudflare Pages Function adapter for the same core
eval/             accuracy gauntlet: labelled synthetic takes, reports, tone-model training
site/             marketing website (Astro, Tailwind v4, shadcn/ui) — a separate package and deployment
supabase/         schema + RLS for the hosted backend
```

Nothing above `speech/` imports a vendor type; replacing Azure means writing one class.

## Learners

Age sets a band — **Little (5–7)**, **Junior (8–11)**, **Teen (12–17)**, **Grown-up (18+)** — which changes content
(words → phrases → sentences), copy, type scale, mastery bar, and how feedback is delivered (Pip *says* the tip for
non-readers; teens and grown-ups see phonetic symbols and optional detail). Grown-ups get teen content with a plainer
look: no mascot while speaking, no confetti, plain unit names ("Food & Drink"), and adult wording in setup.

Each learner picks courses (English, 普通話 Putonghua or both), an English accent (American default: the most detailed
feedback), and for Mandarin, Traditional (default) or Simplified characters. Azure is always sent Simplified.

## Two ways to learn: the course, or a page from a book ("Say it right")

Home has two modes: **Course** (the lessons, plus conversations with Pip) and **My book**. The big button in the middle
of the bottom bar is the camera: point it at a page (a school book, a menu, a sign), take the photo — or pick one from
the gallery inside the camera — and the page's sentences appear under My book. Tap one to hear it, say it and get the
same feedback as a lesson. The camera is the same on phones, tablets and computers (shown inside the app, with a torch
where the phone has one; if the browser blocks it, the phone's own camera app and the gallery still work). Typing is
the quiet alternative. English typed text is split on the device; photos and Chinese text go to `POST /api/read`, where
Gemini first finds the sentences, then gives the Chinese ones each character in both scripts with its pinyin as read in
context (a few sentences per request, side by side), which the server checks before it is used. Measured
(`eval/README.md`): printed pages read with no wrong characters, clean or photographed at an angle in poor light;
Chinese pinyin right for 107/107 course lines and all syllables in tricky sentences (多音字 like 還 hái/huán, 得 děi);
bilingual pages (a Hong Kong menu or sign) keep both languages, and lines in other languages are shown but not
practised. A dense Chinese page takes about 6–8 s. Needs the API (beta access code). Wunder Tutor keeps neither the
photo nor the text on its servers; the page's sentences stay on the device (per learner) until a new photo, and are
erased with the learner's data. Not added to the review schedule.

## Tablets

From 760 px wide the app becomes a home learning screen: a side navigation rail, wider screens, grids for sounds,
progress and badges, and sheets that open as centred dialogs. From 1000 px Home shows two columns (today | the lesson
path), and in landscape the speaking screen sits side by side (what to say and the feedback | the microphone).

## Privacy (children's data)

- A grown-up does setup, consents to microphone use, and owns everything in the **Parent Zone** (behind a gate).
- Nicknames only. No email, no real name, no free-text chat.
- The mic is live only while the button is red; it releases after every take.
- Recordings stay on the device (newest 3 per phrase), stored separately from scores. They can be turned off,
  deleted alone, deleted with all pronunciation history, or wiped with the profile/account.
- **Share recordings for testing** (Parent Zone / Settings & privacy): after a consent tick, a grown-up can save the
  learner's recordings, the text and the app's scores to one file — no name, a learner code instead — and choose to
  send it to the Wunder Tutor team. Nothing is uploaded by the app. `eval/volunteers.ts` unpacks such files.

## Known limitations

- Accuracy is measured on synthetic adult voices; no real child's voice through a real microphone has been measured.
  The Claude tutor has not been run live.
- Azure cannot hear some Mandarin confusions at all (村 cūn / 春 chūn both score 100); Mandarin sound errors are
  caught 65% of the time, and ü/i swaps are never named because Azure can't tell them apart. A second scorer (e.g.
  SpeechSuper) is the next step.
- A Live model is conversational, not a TTS engine: takes are accepted only when their transcript matches, but *how* it
  pronounces an isolated syllable or a slow sentence needs a listening check.
- Without a Gemini key, reference audio is device TTS — quality varies by device, and isolated syllables are approximations.
- The mock model's scores are simulated; with the demo microphone they are not related to real speech at all.
- One fully authored unit per course (7 lessons × 3 bands each), 8 English + 9 Mandarin Lab sounds, 3 English
  conversation scenarios.
- PWA icons are SVG only; add PNG icons (180/192/512) before shipping to iOS home screens.
- The parental gate is a simple arithmetic check, not identity verification.
