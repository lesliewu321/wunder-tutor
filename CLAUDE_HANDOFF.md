# Wunder Tutor — handoff (2026-09-19, evening)

Read this first in a new session. Then `README.md` for architecture, `server/README.md` for the API, `eval/README.md`
for how accuracy is measured.

## What this is

A pronunciation-first language tutor. Core loop:
**listen → speak → score → see the exact sound (or tone) that slipped → how to fix it → retry → before/after.**

- **Audience:** Hong Kong children and teens 5–17 first (Cantonese at home), learning **English** and **Mandarin (Putonghua)**.
  A **grown-up mode** (18+) so adults aren't put off and parents can learn too. **Tablets matter as much as phones**
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
- **Four bands:** little 5–7, junior 8–11, teen 12–17, **adult 18+** (teen widened to 17 at Leslie's request, 2026-09-19) (`contentBand()` maps adult→teen content;
  `isGrownUp()` = teen or adult). Adults: no mascot while speaking, no confetti, plain unit names, adult wording.
- **Tablet:** `src/styles/tablet.css` — side rail ≥740×600, two-column Home ≥1000 px, side-by-side speaking in
  landscape, sheets as centred dialogs. Checked at 820×1180, 1180×820, 744×1133, 375×812 and in dark mode.
- **Two modes on Home** (Leslie's design, 2026-09-19): **Course** (lessons + "Talk with Pip" card → `/speak`) and
  **My book**. The big centre button of the bottom bar is the **camera** (not a mic: nothing to speak into on Home;
  lessons and conversations keep their own mic). Mode per learner in localStorage (`src/features/say/page.ts`).
- **Say it right** (`src/features/say/`): camera (`CameraScreen.tsx`, full screen on every device via getUserMedia:
  shutter, gallery button inside, torch if the phone has one, photo = exactly what was on screen; blocked → "Use the
  camera app" (capture input) + gallery). Opened from anywhere with `openCamera()` → `CameraHost` (next to the
  toasts). A read page is saved per learner (`wunder-tutor/book/<id>`, erased with the learner/all data) and Home
  switches to My book; each sentence is `/say?s=N` (same speaking screen, `mode="free"`: "Next sentence" always
  offered, not added to the review schedule). `Permissions-Policy: camera=(self)` (was `camera=()`, which blocked
  it). Photos and Chinese text go to `POST /api/read` (`server/read.mjs`, Gemini 3.8 Flash, two steps: sentences, then
  per-character {t, s, py} in ≤ 6 parallel batches, checked by `checkChineseLine`).
  Measured: no wrong characters on photographed pages (clean / phone-like / harsh); pinyin 107/107 course lines, 100%
  of syllables on tricky 多音字 sentences (得 děi needed a line in the prompt). Every sentence carries its own `lang`
  (bilingual HK menus/signs keep both languages; French/Japanese lines are shown, not practised). English typed text
  is split on the device (works in practice mode). Unreadable files (HEIC on a computer) get their own message
  (decode falls back to an <img> for older iPhones/very large photos), transparent PNGs get a white background, the
  app waits 60 s (server budget 40 s). A failed read shows the server's code in brackets; the server logs
  `[read] <code> after N s` (tail it with wrangler). Leslie's first real phone photo failed with no code (before this
  logging); the most likely cause, a dense page's one-answer size/time, is fixed by the two-step read. A learner's own sentences are spoken with
  `ephemeral` (never in the shared TTS cache, 40 / 10 min per client) and left out of the recordings export.
- **Setup problems show before the photo** (2026-09-20, after six failed phone attempts that were all key/code
  problems): opening the camera asks `/api/health` fresh and `/api/status` (live key check); a missing/refused code or
  a refused Google key is shown in place of the shutter with a button to Settings (`/parents`, scrolls to **Beta
  access** or **Connections**). Settings → Connections shows ✓/✗ per service plus repair notes (`key N/M`). A failed
  read names whose fault it is (`readProblem`: key/region/model/quota are "not your photo"). Photos are real
  photographs where the browser can take one (`ImageCapture.takePhoto`, asked for ~2560 px, 4 s limit, falls back to
  the picture on screen), continuous focus, the camera restarts itself after another app took it, and "Blurry? Use
  the phone's camera instead" is always offered on touch devices.
- **Camera review (2026-09-20, independent reviewer, all fixed):** closing the camera cancels everything (one
  AbortController per opening; nothing is sent after close, a late answer never replaces the saved page); the camera
  is a history entry (`location.state.camera` via `CameraHost`) so Android Back closes it, and Home *replaces* it after
  a read; camera starts are numbered (`run.newest`) so overlapping starts can't leave the camera on; a lens that won't
  open is skipped and the last good one comes back, the auto-picked main lens is remembered; torch/zoom/focus are read
  after the picture is live (+500 ms); the camera is off while a setup problem is shown; the dialog makes `#app-frame`
  `inert`; words over the picture sit on dark pills (the picture is a white page). The preflight blocks only on
  definite faults (`not_set`, `key_refused`, `region`, `model_missing`) — never on a timeout/5xx/quota — and the server
  keeps a hiccup for 5 s, a definite answer 60 s, one check shared by concurrent askers. The access code is normalised
  on both sides (`normalCode`: invisible characters, NBSP, line breaks) and sent URI-encoded; `/api/health` says
  `codeSet`. Only "no words found" gives photo advice; our-side failures say so; Google 401/403 → `read_key`;
  `read_quota` is "busy"; `finish` (RECITATION…) reaches the app; a platform 503 is not "not switched on".
  **Needs a real phone to confirm:** `takePhoto` still vs preview shape (guarded by `sameShape`), capabilities timing,
  revive after the phone's camera app, iOS mute/unmute.
- **Cheaper scoring:** takes are trimmed to speech ± margin before upload (`speechWindow`, ~42% less audio, no word
  cut in 2,541 test takes); phrases/sentences check likely mistakes on each word's clip in a second parallel round
  (`CLIP_CHECKS`: Mandarin sound slips named 27% → 58%, British swaps 0% → 88%, ~35% cheaper checks). Roughly half the
  earlier cost overall.

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

### Second pass: Say it right + cost fix (2026-09-19)

A third review (reading, privacy, scoring changes) — all fixed, then re-measured:
- Reading: 嗯 "n2" crashed a line (now "can't check"); lines with kana or Latin never get pinyin; per-sentence
  `lang` (a page-wide label sent a bilingual page back as "other"); 得 děi prompt line; typed line breaks kept.
- Scoring: a failed or out-of-context base clip no longer counts as 0 (a clean base must fit the label, else the
  whole-take score stands); unknown English words get a syllable guess for the recording time limit.
- Privacy: a learner's own sentences are spoken with `ephemeral` (never in the shared TTS cache), capped per client,
  and left out of the recordings export; the screen says plainly that Google may keep text briefly under its terms.
- App: back button returns to the sentence list; practice-mode banner when scores are simulated; camera button only
  on touch devices; clear messages for unreadable files and slow reads; a failed API check isn't remembered; scores
  line up with the words as written even when the scorer hears an extra word (`writtenWords`); an error screen
  instead of a blank page (`ErrorBoundary`); the service worker never caches HTML as a script.

## Verified live

- Azure en-US / en-GB / zh-CN (eastasia) and Gemini Live teacher voice (English + Mandarin), from Node and Workers.
- Leslie used the (older, English-only) app with a real mic in Chrome: "seems working fine".

### Not verified
- A real **child** (or any real human) on the Mandarin course or the new accuracy features. Most important next test.
- iPhone/iPad Safari. The Claude tutor (no key). Supabase. Teacher-take quality thresholds for Mandarin
  (`TEACHER_MIN_ACCURACY` 85 / `TEACHER_MIN_SYLLABLE` 70 in `server/core.mjs`) are uncalibrated.

## Open items

1. **Cost at scale:** halved on 2026-09-19 (trimming + word clips, see above); a take still costs up to ~2–4× its
   trimmed length. Next levers: Azure commitment tiers (~60% off at volume); skip checks for sounds a learner has
   mastered.
2. **Volunteers** (Leslie is recruiting children; trying adult mode first): parents use Share recordings for testing →
   files go in `eval/volunteers/` (gitignored) → `npx vite-node eval/volunteers.ts` → label `manifest.csv` → measure.
   Real scoring on the hosted app needs the right beta access code (item 3).
3. **`BETA_ACCESS_CODE`**: Leslie set a new passphrase on 2026-09-19 (`wrangler pages secret put`, run twice — the
   second value is live). Enter it in Parent Zone / Settings & privacy → Beta access; without it the hosted app runs
   in practice mode and can't read photos. Never ask Leslie to type it in chat.
4. `hello@wundertutor.com` printed on the site but no mailbox (suggest Cloudflare Email Routing).
5. Privacy notice is a plain-language draft; law of record includes HK **PDPO**. Adult learners share the
   parent-oriented Parent Zone/consent flow.
6. PWA icons are SVG only (iOS wants PNGs). The beta code is a shared passphrase, not real auth.
7. Speak/Practice conversations are English only (the screen tells Mandarin learners so). Putonghua scenarios are to do.
8. **Teacher takes:** single characters are tone-checked in the browser (`src/speech/zh/teacherCheck.ts`, Kore voice
   profile); phrases are not — the server gate (transcript + Azure ≥ 85 / syllable ≥ 70) is lenient on tones.
9. **Cloudflare Web Analytics** injects its beacon (`static.cloudflareinsights.com`) into the hosted app — cookieless,
   but the privacy notice says nothing about it. Mention it or switch it off in the Pages project settings.

## Waiting on Leslie

- Create the Wunder Tutor **Supabase** project ($10/month on org `lesliewu321`) — accounts + sync. Not approved yet.
- **Native apps** via Capacitor (Leslie has a Mac + iPhone, Apple Developer and Google Play accounts).
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
- **Service keys go up with `npm run keys:push`** (Leslie runs it — never me: it transmits key values). It reads the
  three keys from `.env`, asks Microsoft and Google whether each works, uploads only working ones through wrangler's
  stdin (`pages secret bulk`), and prints names/lengths/✓✗ only. `npm run keys:check` uploads nothing. On 2026-09-20
  `/api/status` showed the live app with `scoring: key_refused, reading/voice: not_set` — i.e. real scoring, reading
  and the Gemini voice had never worked on the live app; `.env` keys were verified good (Azure 84 chars, region 8,
  Gemini 53). **Leslie ran it on 2026-09-20; after the redeploy `/api/status` said `ok` for scoring, reading and
  voice — the first time the live app's services worked.** Still to see on a real phone: a photo read end to end.
- **Google's Gemini API refuses requests that leave from Hong Kong** ("User location is not supported") — and a Pages
  Function runs at the Cloudflare location nearest the learner, which for the launch market IS Hong Kong. Found
  2026-09-20 once the keys worked: the same code and key said `reading: ok` when a request entered at TPE and
  `region` at HKG (Leslie's phone). Cloudflare `[placement]` (smart or `region = "gcp:asia-east1"`) is only a hint: every
  HKG-entering request still ran at HKG. Fix: **all Google calls (read, status check, the Live voice WebSocket) leave
  through a Durable Object relay** — Worker `wunder-egress` (`egress/`, `npm run deploy:egress`, no public address),
  bound to the Pages project as `EGRESS`; `functions/api/[[path]].js` probes relays in order (free `models` call) and
  keeps the first one Google accepts: `google-oc` (landed in **Auckland**, ~0.15 s from HK) then `google-wnam` (Dallas).
  Relays with hint `apac` landed in HKG every time (first used by HKG-entering requests) and are refused — to get one in
  Taiwan/Singapore/Japan it must be FIRST used by a request entering outside HK (idea: create only when
  `request.cf.colo !== 'HKG'`, publish the name via KV). `/api/status` shows `egress` ("google-oc AKL"). The same block
  will hit any provider that geo-blocks Hong Kong (OpenAI and Anthropic do too) — route them through the relay as well
  (its allow-list is one hostname). The voice WebSocket through the relay was NOT yet seen working end to end (no
  access code on my side): check that the KV cache gains `tts:` keys after Leslie uses Listen on the live app.
- **Secrets need a deploy, and a check:** after Leslie runs `wrangler pages secret put …`, run `npm run deploy`, then
  `curl https://app.wundertutor.com/api/status` — `reading`/`voice`/`scoring` must say `ok`. A pasted key can be
  present and wrong: on 2026-09-19/20 the live Gemini key was first invalid (Google 400 in 0.1 s), then held a line
  break (the request never left the Worker), then invisible characters. Cloudflare also replaces a Function's 502/504
  body with its own page — upstream failures answer 424 so the app can read the reason.
- **`wrangler pages deployment tail`** goes quiet after ~2 minutes and exits when stdin closes: loop it
  (`sleep 140 | timeout 145 node <wrangler.js> pages deployment tail <deployment-url> --format json`), and even then it
  misses events — prefer `/api/status` and the code shown in the app's message.
- **Checking a deploy:** first wait until `https://app.wundertutor.com/` serves the new `index.html` (new
  `assets/index-*.js` name), only then fetch the new asset. Fetching it earlier gets the old deployment's SPA fallback
  (HTML) cached at the edge under the asset URL for a year (`/assets/*` is immutable) → blank app on that edge. Happened
  once (2026-09-19); fixed by redeploying with a new hash. Settings → Demo & diagnostics shows the app version.
- Azure word scores are lenient ("tree" for "three" → word 80, phoneme 25) → `WRONG_SOUND_BELOW` in
  `src/engine/learning.ts`. Single-word overall uses AccuracyScore, not PronScore.
- Mandarin display text follows the learner's script through `src/content/zh/script.ts` (the store keeps the display
  script in step); `phonemeInfo()` returns Traditional guides for 'hant'. A test fails if a new guide character has
  no Traditional mapping.
- Gemini sometimes returns glitched takes (5 ms, or 30 s) — the eval excludes them.
- `node_modules` lives inside Dropbox (slow sync) — suggested excluding it; not done. `eval/.cache` (~250 MB of
  thousands of small files, regenerable for a few dollars) too: while evals write it, Dropbox syncing slows the dev
  server to a crawl. Suggest Leslie excludes both from Dropbox sync.
- **vite-node stalls on repeated outbound connections on this machine** (plain Node doesn't): Gemini/Azure-heavy eval
  scripts run as plain Node `.mjs`, or plan their calls (`--plan`) and hand them to `node eval/run-jobs.mjs`.
- The app's API check (`apiHealth`) waits up to 8 s: shorter, a slow phone silently fell into simulated scores.

## How Leslie works

Short messages and screenshots; not a terminal native. Walk through consoles step by step, say exactly where to type,
and verify from outside afterwards. Prefers a recommendation over open-ended questions. Local commits at milestones;
push only when asked. Tests on an Android phone (Chrome, large system font) and designs by screenshot: e.g. "two modes
on Home — follow the curriculum, or take a photo from a book", "the centre button should be a camera", "choose a photo
= a gallery icon inside the camera". UI work is also done "with the gauntlet method" (build, run, screenshot,
critique, fix, retest).

## Key files

- Core loop UI: `src/features/speak/SpeakExercise.tsx`, `useSpeechTake.ts`, `WordSheet.tsx`
- Speech: `src/speech/{azureProvider,mockProvider,recorder,pitch,voice}.ts`, `src/speech/zh/{assess,tone,toneModel}.ts`
- Teaching: `src/tutor/feedback.ts` · Sounds: `src/content/phonemes.ts`, `src/content/zh/sounds.ts` · Words: `src/content/lexicon.ts`
- Mandarin content: `src/content/zh/{course,pinyin,alternatives,script}.ts`
- Engine: `src/engine/learning.ts` · Profile memory: `src/intelligence/profile.ts` · Store: `src/state/store.ts`
- API: `server/core.mjs`, `server/tts.mjs`, `server/tutor.mjs` · Eval: `eval/`
