# Wunder Tutor — handoff (2026-09-19)

Read this first in a new session. Then `README.md` for architecture, `server/README.md` for the API.

## What this is

A pronunciation-first language tutor for **children 5–15**, set up by a parent. Core loop:
**listen → speak → score → see the exact sound that slipped → how to fix it → retry → before/after.**

**Launch audience (Leslie, 2026-09-19): Hong Kong children learning English — preferably British — and Mandarin.**
Home language is mostly Cantonese. Original brief: `C:\_Cloud\Dropbox\AI\WunderTutor\Wunder_Tutor_Fable_Master_Prompt.md`
(its adult "not childish" tone was overridden by the children audience).

## Where everything lives

| Thing | Where |
| --- | --- |
| Code | `C:\_Cloud\Dropbox\Dev\Apps\wunder-tutor` · GitHub **private** `lesliewu321/wunder-tutor` (`main`) — **4 commits not pushed yet** |
| App (hosted) | https://app.wundertutor.com (= `wunder-tutor.pages.dev`) — Cloudflare Pages project `wunder-tutor` |
| Marketing site | https://wundertutor.com + www — Pages project `wundertutor-website`, source in `site/` |
| API | Pages Function `functions/api/[[path]].js` → `server/core.mjs` (same core runs locally via `server/index.mjs`) |
| Teacher-voice cache | KV namespace `wunder-tutor-tts-cache` (binding `TTS_CACHE`); locally `server/.cache/tts`; plus IndexedDB on each device |
| Learner data | **Per device only**: localStorage (state) + IndexedDB (recordings). No accounts, no sync. `supabase/schema.sql` is a file — no Supabase project exists |
| Domain | `wundertutor.com`, registrar Namecheap, DNS on Cloudflare (`annabel`/`porter.ns.cloudflare.com`) |
| Azure | Speech resource `wunder-tutor-speech`, resource group `wunder-tutor`, region **eastasia**, tier S0 |
| Keys | Local: gitignored `.env`. Hosted: Cloudflare Pages secrets. Leslie uses a **separate** Gemini key for this app (not wunder-manager's) |

## Commands

```bash
npm run dev          # app on http://localhost:5173
npm run server       # local API proxy on :8787 (reads .env) — needed for real Azure/Gemini locally
npm test             # 37 tests (vitest) — engine, intelligence, mock scorer, Azure fixtures, TTS, API access control
npm run build        # typecheck + production build
npm run deploy       # build + deploy the app to Cloudflare Pages
npm run cf:dev       # run the Pages Function locally in workerd (port 8788)
cd site && npm run dev | npm run deploy    # marketing site (Astro 7, Tailwind v4, shadcn/ui, React 19)
```

Preview configs for the Browser pane are in `.claude/launch.json` (`wunder-tutor`, `wundertutor-website`).

## State of the product

Built and working end to end: onboarding (parent) → speaking check → personalised plan → home → lessons (speak, listen,
minimal pairs, dialogue, adaptive drill) → retry with before/after → lesson complete → progress → Pronunciation Lab
(8 sounds, ladders) → scripted AI conversations + summary → Parent Zone (privacy, deletion, learners, diagnostics).
Three age bands (Little 5–7, Junior 8–11, Teen 12–15), dark mode, small phones, error states.

Content: **one** authored unit ("Yummy Food", 7 lessons × 3 bands); other units shown locked.

### Verified live (real keys)
- **Azure en-US**: full detail (IPA phonemes, syllables, prosody). Fixtures in `src/__tests__/fixtures/`.
- **Azure en-GB**: scores every sound but returns **no phoneme names** → `namePhonemes` (`src/speech/azureProvider.ts`)
  aligns them to our lexicon via `alignmentCandidates()` (`src/content/lexicon.ts`). 93% direct match on lesson words;
  the rest are silent-R slots, which are dropped so a British learner is never coached on them.
- **Gemini 3.1 Flash Live** (`gemini-3.1-flash-live-preview`, voice Kore) as the teacher voice, from Node and from the
  Workers runtime (fetch-upgrade WebSocket). Transcript-verified so it can't ad-lib; cached.
- Leslie tried the app with a **real microphone** in Chrome on localhost: "seems working fine" (no detailed notes).

### Not verified
- A real **child** has never used it. This is the most important missing test.
- Claude conversation tutor (`/api/tutor`) — no Anthropic key set; conversations are scripted.
- Supabase schema on a real project. iOS Safari behaviour. App-store wrapping.
- How Gemini pronounces isolated Lab syllables ("rah", "thee") and the Slow takes — needs a human ear.

## Open items / loose ends

1. **`BETA_ACCESS_CODE` on Cloudflare may be wrong.** When Leslie set it, the masked value was ~84 chars — the same
   length as the Azure key, so it was probably pasted from the clipboard. Leslie asked how to change a secret but has
   not confirmed it was redone. Until a known passphrase is set **and entered in Parent Zone → Beta access**, the hosted
   app runs in practice mode (simulated scores; Home shows a yellow notice). All four secrets exist by name:
   `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` (=eastasia, set by Claude — not secret), `GEMINI_API_KEY`, `BETA_ACCESS_CODE`.
   Secrets apply only after a redeploy.
2. **`hello@wundertutor.com`** is printed on the site (one constant: `site/src/lib/site.ts`) but the mailbox does not
   exist. Suggest Cloudflare Email Routing → Leslie's inbox.
3. **Privacy notice** (`site/src/pages/privacy.astro`) is an accurate plain-language draft, not legally reviewed.
   Relevant law is now HK **PDPO** as well as COPPA/GDPR-K.
4. `git push` — 4 commits ahead of origin.
5. PWA icons are SVG only (iOS wants PNGs). The beta code is a shared passphrase, not real auth.

## What Leslie was asked last (unanswered)

Before building the **Mandarin (Putonghua) course**:
- Show **Traditional** characters + pinyin to the child while sending **Simplified** to Azure `zh-CN`? (needs a test that
  this round-trips; consider keeping both forms in content)
- First cohort: complete beginners, or kids already learning Putonghua at school who need better pronunciation?
- Pinyin always visible, or fading as they improve?

Proposed order after that: (1) Mandarin course incl. a **tone-contour visual** from on-device pitch tracking (Azure can't
say whether tone or consonant was wrong), (2) Traditional-Chinese UI for parents (onboarding, Parent Zone, privacy,
marketing site), (3) HK-flavoured English content + more units, (4) accounts + sync (Supabase).

## What Azure really returns per language (live-probed — do not trust the locale list alone)

- **en-US**: everything. **en-GB**: unnamed phonemes (solved by alignment).
- **zh-CN**: one unit per character = pinyin + tone number (`shui 3: 88`), Omission/Mispronunciation flags. Good.
- **zh-HK (Cantonese)**: word-level only, unnamed, words merged — too coarse to *teach* Cantonese.
- **ja-JP, ko-KR, fr-FR, es-ES**: word + syllable + phoneme *scores*, names empty (alignable: Korean jamo and Spanish
  cleanly; Japanese by mora; French hardest). "What was said instead" exists only for en-US.
- The reusable probe pattern: generate a take with Gemini Live → resample 24k→16k → POST to
  `https://{region}.stt.speech.microsoft.com/...?language={locale}` with the `Pronunciation-Assessment` header.

## Gotchas (each cost real time)

- **Never handle key values.** Leslie pastes keys into `.env` / wrangler prompts themself. Checking `.env` = names and
  lengths only. `AZURE_SPEECH_REGION` is not a secret.
- **Do not set `AZURE_SPEECH_ENDPOINT`** to the portal's `*.api.cognitive.microsoft.com` URL — wrong host for STT. Region alone works.
- **Leslie's network intercepts/caches DNS.** `nslookup` lies (even against gTLD servers). Verify with DNS-over-HTTPS
  (`cloudflare-dns.com/dns-query`) and `curl --resolve`.
- **Wrangler**: logged in as leslie@lesliewu.com with Pages/KV write but **no DNS write** and no custom-domain command —
  custom domains were added through Leslie's Chrome (Cloudflare dashboard) at their explicit request.
  Local workerd supports `compatibility_date` ≤ 2026-08-08 (we use 2026-06-01). `wrangler pages dev` reads `.env`.
- **The Claude Browser pane blocks the microphone** → use Parent Zone → Demo microphone there (simulated scores).
  Real-mic testing must happen in Leslie's own Chrome. Flag emoji don't render on Windows.
- `.env` loader: an empty `KEY=` placeholder no longer shadows a filled value lower in the file (fixed; keep it that way).
- shadcn CLI wrote `from "cn"` imports in `site/` — fixed by hand; re-check after adding components.
- Azure is lenient at word level ("tree" for "three" → word 80, phoneme 25) → `WRONG_SOUND_BELOW` in
  `src/engine/learning.ts`. Single-word overall uses AccuracyScore, not PronScore (one-word prosody is noise).
- A dev-only `window.__store` (zustand) exists for poking state while testing.
- `node_modules` lives inside Dropbox (slow sync) — suggested excluding it; not done.

## How Leslie works

Short messages and screenshots; not a terminal native (typed a value at the PowerShell prompt instead of wrangler's
prompt; misread the gate's "×" as "+"). Walk through consoles step by step, say exactly where to type, and verify the
result from outside afterwards. Prefers decisions made with a recommendation over open-ended questions. Owns many
`wunder*.com` sites on Cloudflare Pages; `wunder-manager` has a verified Gemini Live voice bridge worth borrowing from
(`voice-bridge/lib/gemini.js`).

## Key files

- Core loop UI: `src/features/speak/SpeakExercise.tsx`, `useSpeechTake.ts`, `WordSheet.tsx`
- Speech layer: `src/speech/{types,recorder,voice,health,mockProvider,azureProvider}.ts`
- Teaching: `src/tutor/feedback.ts` · Sounds: `src/content/phonemes.ts` (incl. `CANTONESE` priors) · Words: `src/content/lexicon.ts`
- Engine: `src/engine/learning.ts`, `rewards.ts` · Memory of weak sounds: `src/intelligence/profile.ts` · Store: `src/state/store.ts`
- API: `server/core.mjs`, `server/tts.mjs`, `server/tutor.mjs`, `functions/api/[[path]].js`
- Site: `site/src/pages/index.astro`, `site/src/components/{PhoneDemo,AgeTabs,Faq}.tsx`
