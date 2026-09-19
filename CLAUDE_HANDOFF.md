# Wunder Tutor — handoff (2026-09-19, evening)

Read this first in a new session. Then `README.md` for architecture, `server/README.md` for the API, `eval/README.md`
for how accuracy is measured.

## What this is

A pronunciation-first language tutor. Core loop:
**listen → speak → score → see the exact sound (or tone) that slipped → how to fix it → retry → before/after.**

- **Audience:** Hong Kong children 5–15 first (Cantonese at home), learning **English** and **Mandarin (Putonghua)**.
  A **grown-up mode** (16+) so adults aren't put off and parents can learn too. **Tablets matter as much as phones**
  (a learning platform at home).
- **Leslie's primary goal: pronunciation feedback as accurate as possible.** Hence **US English is the default accent**
  (Azure is most detailed for en-US); British and Mandarin made as accurate as the scorer allows. Worked with the
  "gauntlet" loop from the brief: build → run → inspect → critique → fix → retest.
- **Long term:** a global Duolingo competitor, 1M users, web + iOS + Android.
- Original brief: `C:\_Cloud\Dropbox\AI\WunderTutor\Wunder_Tutor_Fable_Master_Prompt.md`.

## Where everything lives

| Thing | Where |
| --- | --- |
| Code | `C:\_Cloud\Dropbox\Dev\Apps\wunder-tutor` · GitHub **private** `lesliewu321/wunder-tutor` (`main`) — pushed 2026-09-19 at Leslie's request (push only when asked) |
| App (hosted) | https://app.wundertutor.com (= `wunder-tutor.pages.dev`) — Cloudflare Pages project `wunder-tutor`. Deployed 2026-09-19 with adult mode, tablet layout and the Mandarin course (`npm run deploy`; a GitHub push does NOT deploy) |
| Marketing site | https://wundertutor.com + www — Pages project `wundertutor-website`, source in `site/` |
| API | Pages Function `functions/api/[[path]].js` → `server/core.mjs` (same core runs locally via `server/index.mjs`) |
| Teacher-voice cache | KV namespace `wunder-tutor-tts-cache` (binding `TTS_CACHE`); locally `server/.cache/tts`; plus IndexedDB on each device |
| Learner data | **Per device only**: localStorage (state) + IndexedDB (recordings). No accounts, no sync. `supabase/schema.sql` is a file — no Supabase project exists |
| Accuracy test set | `eval/.cache` (gitignored, ~160 MB of cached Gemini takes + Azure responses) — reruns are free |
| Domain | `wundertutor.com`, registrar Namecheap, DNS on Cloudflare (`annabel`/`porter.ns.cloudflare.com`) |
| Azure | Speech resource `wunder-tutor-speech`, resource group `wunder-tutor`, region **eastasia**, tier S0 |
| Keys | Local: gitignored `.env`. Hosted: Cloudflare Pages secrets. Leslie uses a **separate** Gemini key for this app |

## Commands

```bash
npm run dev          # app (port from $PORT, default 5173 — other sessions often hold 5173)
npm run server       # local API proxy on :8787 (reads .env) — needed for real Azure/Gemini locally
npm test             # 59 tests (vitest)
npm run build        # typecheck + production build
npm run deploy       # build + deploy the app to Cloudflare Pages
npx vite-node eval/run-en.ts            # English accuracy report (cached, free)
npx vite-node eval/report-zh.ts --cv    # Mandarin accuracy report (cached, free)
cd site && npm run dev | npm run deploy # marketing site
```

Preview configs for the Browser pane: `.claude/launch.json` (`wunder-tutor` has `autoPort`, `wundertutor-website`).

## State of the product (all on `main`)

Onboarding (grown-up setup, or "Me — a grown-up") → languages (English / 普通話 Putonghua, either or both) → accent
(American default, British) → characters (Traditional default / Simplified) → speaking check → plan → Home (course
switcher) → lessons (speak, listen, minimal pairs, dialogue, adaptive drill) → retry with before/after → progress →
Pronunciation Lab (8 English + 9 Mandarin sounds, ladders) → scripted AI conversations (English only) → Parent Zone.

- **Mandarin course:** unit "Yummy Food 好吃的" (grown-ups see "Food & Drink 飲食"), 7 lessons × 3 bands, a first-time
  Mandarin speaking check (`/check/zh`), tone pictures (Chao contours), per-character feedback ("Your 麵 (miàn)
  sounded like tone 1. It needs tone 4…"). Items carry Simplified (sent to Azure) and Traditional (shown).
- **Four bands:** little 5–7, junior 8–11, teen 12–15, **adult 16+** (`contentBand()` maps adult→teen content;
  `isGrownUp()` = teen or adult). Adults: no mascot while speaking, no confetti, plain unit names, adult wording.
- **Tablet:** `src/styles/tablet.css` — side rail ≥760 px, two-column Home ≥1000 px, side-by-side speaking in
  landscape, sheets as centred dialogs. Checked at 820×1180, 1180×820, 375×812 and in dark mode.

## Accuracy (synthetic labelled set — `eval/README.md`)

| | False alarms | Mistakes caught | Right sound named |
| --- | --- | --- | --- |
| US English | 2.3% (was 2.5%) | 87.6% (was 48.9%) | 80.1% |
| British English | 3.3% (was 37.5%) | 85.7% | 73.4% |
| Mandarin (6 voices, held-out) | 6.7% (was 38.6%) | 75.4%; tones 83.6% | tones named right 91.1%; "sounded like" 100% |

How: US = Azure phonemes + NBest "heard" + likely-mistake re-scoring (`src/content/alternatives-en.ts`). British =
word scores from phoneme means + US-scorer evidence on shared sounds only. Mandarin = Azure per-character pinyin/tone
+ own pitch tracker (`src/speech/pitch.ts`) + learned tone model (`src/speech/zh/toneModel.ts`, generated by
`eval/train-tone.ts --write`) + sandhi rules + likely-mistake re-scoring (`src/content/zh/alternatives.ts`).

A brand-new learner's first 3 takes: 5.9% false alarms, 72.5% of tone errors caught (stricter until the voice is
known). Weak spots: Mandarin sound errors only 64.7% (ü/i swaps deliberately never named — `SWAP_TRUST`) (Azure is deaf to some pairs, e.g. 村/春 both 100 → try **SpeechSuper**,
needs Leslie to sign up); Mandarin tone errors inside phrases only 46% caught (single characters 88%); British at
fast pace; everything measured on synthetic adult voices, **never a real child**. Mandarin thresholds were last set
with `eval/sweep-zh.ts` (phrases now trust Azure a little more: phrase false alarms 13% → 8.7%).

## Review pass (2026-09-19)

Two independent reviews (scoring code; screens/grown-up/tablet) — all findings fixed and re-verified:
- Server: the "Success without scores" retry never ran (unquoted `Success`); a failed US scoring failed British
  takes; likely-mistake texts must now be one word/character away from the reference and each scoring counts
  toward the rate limit.
- Mandarin: new learners' first takes (no voice profile yet) got many false "wrong tone" flags → stricter checks
  until 3 takes (`cold` in `DEFAULT_TONE_PARAMS`); the voice range no longer comes from one-syllable takes;
  light-tone and "scorer read it differently" syllables no longer count against sounds or block mastery; crash on
  an omitted neighbour fixed; the tone model is now trained on the app's own voice profile (`nextVoice`, moved to
  `src/speech/pitch.ts`); 一 before 个, counting 一, 小姐/哪里 tone changes.
- English: respellings only where learners really swap (n/l, v/w at syllable starts; "have" → "haf"; "cat" →
  "ket"; banana override; words with the sound twice are skipped); British/US alignment ignores inserted words.
- App: phones held sideways no longer get the tablet rail (tablet = ≥ 740 × 600); Listen in the help sheet sends
  the Simplified character to the voice; grown-ups never see Pip, get "Settings & privacy", ticks instead of stars;
  the Mandarin unit badge exists; dialogs keep focus, trap Tab and have a Close button; recorder can't hang.

## Verified live

- Azure en-US / en-GB / zh-CN (eastasia) and Gemini Live teacher voice (English + Mandarin), from Node and Workers.
- Leslie used the (older, English-only) app with a real mic in Chrome: "seems working fine".

### Not verified
- A real **child** (or any real human) on the Mandarin course or the new accuracy features. Most important next test.
- iPhone/iPad Safari. The Claude tutor (no key). Supabase. Teacher-take quality thresholds for Mandarin
  (`TEACHER_MIN_ACCURACY` 85 / `TEACHER_MIN_SYLLABLE` 70 in `server/core.mjs`) are uncalibrated.

## Open items

1. **Cost at scale:** each take is scored 1–6× (likely-mistake checks + British dual scoring) → ~10 s of billed Azure
   audio per 2.5 s take. Scoring only the checked word for the extra scorings would roughly halve it. Decide before
   scale; Azure commitment tiers help too.
2. **Volunteers** (Leslie is recruiting children; trying adult mode first): parents use Share recordings for testing →
   files go in `eval/volunteers/` (gitignored) → `npx vite-node eval/volunteers.ts` → label `manifest.csv` → measure.
   Real scoring on the hosted app needs the right beta access code (item 3).
3. **`BETA_ACCESS_CODE` on Cloudflare may be wrong** (masked value ~84 chars ≈ the Azure key length). Until a known
   passphrase is set and entered in Parent Zone → Beta access, the hosted app runs in practice mode.
4. `hello@wundertutor.com` printed on the site but no mailbox (suggest Cloudflare Email Routing).
5. Privacy notice is a plain-language draft; law of record includes HK **PDPO**. Adult learners share the
   parent-oriented Parent Zone/consent flow.
6. PWA icons are SVG only (iOS wants PNGs). The beta code is a shared passphrase, not real auth.
7. Speak/Practice conversations are English only (the screen tells Mandarin learners so). Putonghua scenarios are to do.
8. **Teacher takes can't be tone-checked yet.** The server gate (transcript + Azure ≥ 85 / syllable ≥ 70) is lenient on
   tones, so a Gemini take of 麻 said as 马 could be cached. Fix idea: run the app's pitch tracker + tone model on the
   teacher audio in the browser (the teacher voice is one known Gemini voice, so its pitch profile is fixed) and fall
   back to the device voice on a confident mismatch.

## Waiting on Leslie

- Create the Wunder Tutor **Supabase** project ($10/month on org `lesliewu321`) — accounts + sync. Not approved yet.
- **Native apps** via Capacitor (Leslie has a Mac + iPhone, Apple Developer and Google Play accounts).
- **"Say it right"** companion (type or photograph any text → hear it → say it → corrected; no translation for now).
- SpeechSuper trial for Mandarin sounds. Mandarin: pinyin always shown or fading? First cohort beginners or school
  learners?
- Suggested stack for 1M users (discussed, nothing bought): Capacitor, RevenueCat + Stripe, FCM push, Cloudflare R2,
  Sentry, PostHog, Resend, Crowdin, a privacy lawyer.

## What Azure really returns per language (live-probed)

- **en-US**: everything (IPA names, NBest "heard", syllables, prosody). **en-GB**: unnamed phoneme scores, harsh
  single-word scores (a correct "they" ≈ 60), rates respellings like "fank" 99 on a correct "Thank you".
- **zh-CN**: one unit per character = pinyin + tone number, Offset/Duration. Lenient on some tones and sh→s; its own
  polyphone readings (好 in 好吃 → hao4, 雨 alone → yu4); **Traditional reference text scores badly — always send
  Simplified**; sometimes returns Success without scores (server retries once).
- **zh-HK**: word-level only — too coarse to teach Cantonese. ja/ko/fr/es: scores without names.

## Gotchas (each cost real time)

- **Never handle key values.** Leslie pastes keys into `.env` / wrangler prompts themself. Checking `.env` = names and
  lengths only. `AZURE_SPEECH_REGION` is not a secret. Don't set `AZURE_SPEECH_ENDPOINT`.
- **The Bash tool eats backslashes** in inline scripts (`node -e`, heredocs): `/\s+/` became `/s+/` twice and shipped.
  Write code containing regexes with the Edit/Write tools. A scan for such regexes found none left.
- **Browser pane:** blocks the microphone (use Parent Zone → Demo microphone). Screenshots time out or come back
  cropped while the pane is hidden — retry, or verify with `javascript_tool` measurements.
- **Leslie's network intercepts/caches DNS** — verify with DNS-over-HTTPS and `curl --resolve`, not nslookup.
- **Wrangler**: Pages/KV write, no DNS write. Local workerd needs `compatibility_date` ≤ 2026-08-08 (we use 2026-06-01).
- Azure word scores are lenient ("tree" for "three" → word 80, phoneme 25) → `WRONG_SOUND_BELOW` in
  `src/engine/learning.ts`. Single-word overall uses AccuracyScore, not PronScore.
- Mandarin display text follows the learner's script through `src/content/zh/script.ts` (the store keeps the display
  script in step); `phonemeInfo()` returns Traditional guides for 'hant'. A test fails if a new guide character has
  no Traditional mapping.
- Gemini sometimes returns glitched takes (5 ms, or 30 s) — the eval excludes them.
- `node_modules` lives inside Dropbox (slow sync) — suggested excluding it; not done.

## How Leslie works

Short messages and screenshots; not a terminal native. Walk through consoles step by step, say exactly where to type,
and verify from outside afterwards. Prefers a recommendation over open-ended questions. Local commits at milestones;
push only when asked.

## Key files

- Core loop UI: `src/features/speak/SpeakExercise.tsx`, `useSpeechTake.ts`, `WordSheet.tsx`
- Speech: `src/speech/{azureProvider,mockProvider,recorder,pitch,voice}.ts`, `src/speech/zh/{assess,tone,toneModel}.ts`
- Teaching: `src/tutor/feedback.ts` · Sounds: `src/content/phonemes.ts`, `src/content/zh/sounds.ts` · Words: `src/content/lexicon.ts`
- Mandarin content: `src/content/zh/{course,pinyin,alternatives,script}.ts`
- Engine: `src/engine/learning.ts` · Profile memory: `src/intelligence/profile.ts` · Store: `src/state/store.ts`
- API: `server/core.mjs`, `server/tts.mjs`, `server/tutor.mjs` · Eval: `eval/`
