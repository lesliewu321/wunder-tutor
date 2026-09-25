# Wunder Tutor — handoff (2026-09-25)

## 2026-09-25 (session 5) — the 1M-user plan, the relay only where Google refuses, English as a home language

### DEPLOYED 2026-09-25 ~02:45 UTC (Leslie: "upload to webapp for testing. do not make apk or ios") — commit a5591c4, Pages deployment 9c5fff03; then ~02:55 with the camera icon — commit c1badd6, deployment 6a7fff7a, bundle index-BgFNhFZf.js (live, checked)

- Everything since 9a05fb3 is now live on app.wundertutor.com: reinstall handling, the one-language setup and its
  pages, the relay rule, English at home, the Snap & say tab. **No APK / AAB / iOS build was made** — Leslie said not
  to until told otherwise; the phone app still runs the 1.0.7 (code 8) build from 2026-09-23.
- Live checks: `/api/status` ok ×3. **Finding:** the request entered at **TPE** (cf-ray …-TPE), and Google refused
  the DIRECT probe from there too — `egress: google-apac-a NRT (refused: direct TPE)` — so the relay carried on
  exactly as designed (the fallback is the point). On 2026-09-20 the same code and key had answered "ok" at TPE, so a
  Worker's outbound address at TPE is not reliably one Google serves (Cloudflare's egress addresses are shared and
  Google reads their location however it likes). So far "direct" has not been seen live from any location; the
  status line says per location what happened, and a relay is only ever a ~50 ms detour. Not pushed to GitHub.

Leslie asked for the current setup and a plan for 1M users — then said it is **paywalled, ~100% paying**. Given in chat
(not in this file): the architecture (static app + edge Function + Postgres + speech APIs) stays; what breaks first is
(1) the single Google relay Durable Object, (2) per-isolate rate limits, (3) one Azure S0 resource (~100 concurrent),
(4) the fail-open daily counter, (5) manual deploys with no CI/staging/error tracking. With paying users, payments
(RevenueCat + Stripe, server-authoritative `plans` via webhooks, 7-day trial, paywall in the invite code's slot of
setup) become Stage 0; the heavy-user trap is the paid plan's 600 billed scorings/day (~$19/mo at list) — a cap near
300 keeps every learner profitable. Not built: any of it.

- **Relay only from locations Google refuses (commit below, NOT deployed):** Leslie: "this should be a special case
  for hong kong and china … taiwan singapore etc, no need to route to japan". `functions/api/[[path]].js` now probes
  Google DIRECTLY first, once per isolate (= per Cloudflare location); only a refusal (400 "location is not supported")
  sends that location to the relays as before, and a hiccup on the direct probe also falls through so no location is
  left without a way out. The Gemini Live WebSocket follows the same choice. `/api/status` → `egress` now reads
  `direct TPE` or `google-apac-a NRT (refused: direct HKG)`. **Cannot be verified from here** (every request from
  Leslie's network enters at HKG): after a deploy, ask someone outside HK (or a VPN exit in TW/SG) to open
  `/api/status` and expect `direct <colo>`; from HK it must still say the Tokyo relay. wrangler.toml's comment updated.
- **English as a home language (commit below, NOT deployed):** Leslie: "english is not listed as home language. a
  major shortfall". `'en'` added to `HomeLanguage` (types.ts), second tile in `HOME_LANGUAGES` (after Cantonese;
  native = label, so the tile just says "English"; 繁中: 英文). Priors: Mandarin course got `en` boosts in
  `content/zh/sounds.ts` (tones +0.2/+0.25/+0.3/+0.2, ü +0.25, z c s +0.15, j q x +0.15, zh ch sh +0.1, n/l −0.1);
  French's `l1()` helper now includes `en` (its own comment already said English pushes French the same way as
  Cantonese); Japanese needs none (its difficulties are written for English speakers). English course: no priors, as
  for a native speaker. Nothing stops "English at home" + "learning English" (an adult polishing an accent is
  plausible); `translationFor` has no `en` entries so those exercises fall back to the picture prompt. Seen in the
  5199 copy in both interface languages. 261 tests, typecheck clean.
- **Snap & say is a tab (commit below, NOT deployed):** Leslie's screenshot drew Home's two mode cards onto the bottom
  bar: "course and snap&say seems duplicate on homepage. create a new icon". The Course card was the Learn tab twice
  over. Now: Home is the course only (the modes row, `.modes` CSS and `home.mode.*` texts are gone); the bar has
  FIVE tabs — Learn, Lab, **Snap & say** (`/book`, `BookTab.tsx` = `BookHome` on a screen of its own; 繁中
  拍照跟讀), Progress, Me — with the camera icon (a drawn "snap" icon lasted an hour: Leslie asked for the camera). The camera
  and /say come back to `/book`; Android Back treats it as a tab (back.ts). The stored Home mode
  (`wunder-tutor/home-mode/<id>`) is no longer read or written; forgetBook still removes the old key. Seen in the
  5199 copy at phone width (a seeded learner via `__store`): Home without the cards, the tab, a typed page on it,
  Start reading → Back to the page lands on /book; and the tablet rail with five items. 261 tests, typecheck clean.
  At 320 px "Snap & say" wrapped onto two lines: `.nav__label` is now nowrap and the bar's font is 0.66rem under
  361 px (measured: every label one line, the long one 56 of 61 px).
- Preview note: the app's browser-pane `preview_start` was bound to another project's launch.json this session
  (the session started in wunder-delivery and moved here); the 5199 server was started with plain `npx vite --port
  5199 --strictPort` and opened by URL instead. Nothing was deployed or pushed.


## DEPLOYED 2026-09-23 ~03:15 UTC (Leslie: "deploy") — commit 9a05fb3, Pages deployment 9da0fa77, bundle index-DPoItKK_.js

- Live checks after: `/api/status` ok ×3 (egress google-apac-a NRT); phone preflight 204; the setup preview line plays
  WITHOUT a code (200, teacher) and any other line without a code is 401; with the invite code (header only), all 9 hard
  zh/fr lines have a voice — 四是四, 我喜欢, 妈妈骑马 and Voilà ! Bon appétit ! by the backup (8–14 s the first time).
- Database: `20260922090000_one_learner_per_account` applied; rls.sql then showed 1 FAILED — "B cannot add a learner
  to A's family" got 54000 (the limit trigger fired before the row policy, telling a stranger whether an account has a
  learner). Fixed with `20260923031500_learner_limit_own_account.sql` (the limit judges only `new.parent_id =
  auth.uid()` inserts; the policy refuses the rest as before), applied; **rls.sql: 40 checks, ALL OK**.
- **The voice-cache copy did NOT reach the live server.** `warm-voice.mjs --push` wrote 998 teacher takes (+2 test keys)
  into KV namespace `wunder-tutor-tts-cache` 138ec3dd…, the one wrangler.toml AND `wrangler pages download config`
  (production) bind as TTS_CACHE — yet the live Function neither reads it (a key put there via the API is a `miss` live,
  even 90 s later; 吃葡萄 live serves its own morning take, not the pushed one, on app.wundertutor.com and pages.dev
  alike) nor writes to it (lines the live server made today never appear in its listing; it had 0 keys before the push
  although the live app has had cache hits for days). The other namespace (wunder-driver…) has no tts keys either.
  One account only (whoami). So the deployed Function's TTS_CACHE is some store the API doesn't show under that id.
  Unresolved. **Next:** open the Pages project in the dashboard → Settings → Bindings (Functions) and see which KV
  namespace production really uses; if it is another id, `--push` there (change `KV` in the script). Or warm through
  the live server instead: `WUNDER_CODE=… node scripts/warm-voice.mjs --server=https://app.wundertutor.com` (paced,
  ~120 new takes per 10 min → 1.5 h; costs the Gemini takes again). The 1,000 keys in 138ec3dd… are harmless.
  Also learned: on Windows the local server's `<key>:backup.wav` is an NTFS alternate data stream (readdir does not
  list it; readFile by name works) — the push script now reads it by name and never pushes a marker without its take.
- Not pushed to GitHub (Leslie did not ask).
- **Reinstall with the same email (2026-09-23, commit b24e29b, NOT deployed to the web; phone build 2026-09-23b.apk,
  Play 1.0.5 code 6 UNSIGNED):** Leslie: "everytime I reinstall, I use the same email … how is already registered user
  handled now and how it should be handled". Was: after sign-in in setup the account's learner quietly took the device
  (sync adopts it) while setup carried on under the just-typed name — the check's results went to the old learner and
  the plan showed the old name. Now: Next waits for the first sync after sign-in (`settled`: `savedAt` ≥ the moment of
  sign-in, or sync failed/offline); if the active learner is not the one setup made (`madeId`), the step becomes
  "Welcome back! This account already has a learner: Tiger, age 7" with **Continue as Tiger** (the typed learner is
  dropped from `profiles`, `returning` makes `next()` go Home after the code step — no second check) or **Start over
  with Mia** (confirmation sheet → `eraseAccountLearners()` in account.ts calls `delete_learner` for every live head →
  the adopted learner is removed locally with `heardFromAccount: true` → activeId = the new one → setup goes on; the
  queued sync inserts the new learner within seconds). Both acted out in the 5199 copy with a pretend Supabase (the
  account's learner state cloned from the fresh profile). "I already have an account" on the welcome screen is the
  other reinstall path and is unchanged (restores the learner, straight to Home). Leslie's own account still holds 4–5
  learners from the family days: "continue" takes the most recently edited, "start over" erases them all. A reinstall
  also loses the device's invite code and device id: the code page shows "accepted" through the account's token if
  the account has the beta plan (granted the first time a request carried both the code and the token); otherwise
  re-entering the code takes one more of the invite's places (Leslie's screenshot: 7 of 10 used on WUNDER-HD2X8,
  most of them reinstalls; `npm run codes:new` makes another).
- **Setup pages, and where the paywall goes (2026-09-23, Leslie's question; adult intro page added, commit after
  b24e29b; phone build 2026-09-23c.apk, Play 1.0.6 code 7 UNSIGNED, NOT deployed to the web):** the check ("thirsty",
  1/3) came right after the invite code for adults with nothing to say why; children had the handover page. Adults now
  get 'ready' ("Say three words for Tutu" — what it listens for, not a test, skippable: I'm ready / Skip for now).
  The full order is Welcome → Which languages? → Who's learning? → About {name} → [English accent] → [繁/简 script] →
  Voice & privacy → Your (child's) account → Invite code (when the server needs one) → handover (child) / ready (adult)
  → Speaking check (✕ skips) → Plan → Home. Recommended to Leslie: the paywall takes the invite code's slot (after
  the account, before the handover — everything needing a grown-up before the child takes over; the payment is the
  parent's consent; a free trial keeps it light; "Have an invite code?" stays on it for beta/school pilots). Not built.
  Seen on the way: an adult's default name is "Me", so the account step says "Me's progress is saved" — awkward.
- **Setup simplified (2026-09-23, Leslie: "5 and 6 should be one step … relevant to the language chosen", "10 should
  be generic for all age groups", "onboarding should allow only 1 language to learn"):** "Which language?" takes ONE
  course (`pickCourse`), hint "More can be added later in Settings"; one `course` page about it (English → accent,
  Putonghua → script; French/Japanese skip it); one `ready` page for every age before the check ("Say three words for
  Tutu", buddy on it, I'm ready / Skip for now; a child's text starts "Pass the device to {name}"). The `handover`
  step and `onboarding.handover.*` texts are gone. Order now: Welcome → Which language? → Who's learning? → About
  {name} → [accent | script] → Voice & privacy → Account → [Invite code] → Ready → Check → Plan → Home. Acted out in
  the 5199 copy (English → accent page, Putonghua → characters page, French → none; a child's ready page). Phone
  build 2026-09-23d.apk, Play 1.0.7 code 8 (UNSIGNED), NOT deployed to the web.

## Earlier that evening: 2026-09-22 — the voice gauntlet (commits 614239b, 79fb505; phone build 22i; Play 1.0.3 code 4)

Leslie: "review code. the main problem is no teacher sound. we added azure backup sound. make sure tongue twisters and
other difficult words always has teacher sound when invite code is active. from onboarding till lessons, snap to say,
all have teacher sound on phones, tablets and webapp. use gauntlet". Done as build → run → inspect → critique → fix →
retest, on a phone's terms (no device voice to fall back on). **NOT deployed: everything below waits for Leslie's
"deploy" (with the DB migration, see the one-learner section).** The live server (b61fdc81, 2026-09-21) still has no
backup voice at all: 7 of 170 French lines and several Mandarin ones are silent there.

- **Found and fixed (server, `server/tts.mjs` + `core.mjs`):**
  - The backup's Mandarin take was refused by the same scorer gate as the teacher's: 妈妈骑马，马慢，妈妈骂马。 was
    still silent with the backup. The scorer can't align a tongue twister (it heard "妈妈，妈妈" and marked 骂马 missing
    — from Azure's own reading voice; alone, 骂马 scores 79). Now the backup's take is always served; the disagreement is
    logged `[tts] backup take served although the scorer disagrees: <line>` (course lines only, never a learner's text).
  - A teacher time budget (`TEACHER_BUDGET_MS` 24 s) before the backup: one hung try (25 s) used to outlast the app.
  - Glitches/timeouts no longer count as "the teacher can't say it": `gemini_unstable` (504) → backup served, NOT
    cached; only three heard-and-refused takes (`tts_mismatch`) keep the backup's take + the KV marker.
  - `{ backup: true }` in the request = the backup voice by name (kept under `<key>:backup`, teacher's take untouched).
  - The backup gets one retry. `PREVIEW_LINES` (the setup accent line) are served WITHOUT a code (isPreview in
    core.mjs). `allowTts` 120 → 400 per 5 min per address. `deps.ttsGenerationsPerWindow` for the warm script.
- **Found and fixed (app, `src/speech/voice.ts`, `health.ts`, `types.ts`):**
  - One shared `<audio>` element, unlocked with 0.05 s of silence on the first pointerdown/touchend/keydown (iOS
    Safari plays only in answer to a tap; a take arrives seconds later). Verified in Chrome: full-length plays,
    rapid-fire not cut short (the stale 'pause' event is ignored via `el.paused`), stop() immediate. NOT verified on a
    real iPhone (none here).
  - Client tone rejection (Kore-trained model) → re-request with `backup: true` instead of silence for the session.
  - Fetch: 40 s wait (was 30), one retry on a network TypeError (700 ms), the server's error code travels in
    `VoiceError.code` → `soundProblem` says `common.noSound.dayUsed` (daily_limit) / `common.noSound.busy`
    (rate_limited, tts_budget_exceeded) instead of "can't say this one".
  - `voice.available()` = true until the server has said no (`knownHealth()?.gemini !== false`); SpeakExercise no
    longer asks it before speak().
  - Prefetch everywhere: setup's check items from the 'account' step on (deps [step, checkIndex, services], so the code
    being accepted re-fetches), the check's next item; LessonPlayer prefetches whatever the next exercise is (speak,
    choose-heard answer, minimal-pair answer, dialogue tutor line); SayIt prefetches the next sentence (ephemeral).
  - Setup's accent 🔈 uses `ACCENT_PREVIEW_LINE` with `preview: true` (was silent on phones: no code yet).
- **Tests:** server/tts.test.mjs (+5), core.test.mjs (+1: preview without a code; other lines/ephemeral/backup → 401),
  src/__tests__/voice.test.ts (new, 5). Suite: 261 pass. `PREVIEW_LINES` must match the app's constant (a test reads
  voice.ts).
- **Live, local server (`wunder-api` on 8787, real Gemini + Azure from this machine — Gemini works from here):**
  - 16 hard lines in 4 languages: 15/16 before the fix (妈妈骑马 silent), 16/16 after; first-time cost 7–14 s for a
    line that needs the backup (3 teacher tries first), cached after. Slow Mandarin lines mostly go to the backup.
  - `scripts/warm-voice.mjs` (in-process API, keys from .env, takes into `server/.cache/tts`): **zh-CN 194/194 with a
    voice (185 teacher, 9 backup, 0 silent, 87 s)**; **en-US/en-GB/fr-FR/ja-JP 797/797 (773 teacher, 24 backup, 0 silent, 561 s)**. So all 991 lines have a voice, 33 by the backup (which ones: eval/.cache/warm-voice-result.json is the last run only; the logs are in the session scratchpad). Slowest first-time take 24.8 s (a Japanese line: the teacher used its whole budget, then the backup) — inside the app's 40 s. The takes (1,021 files) sit in server/.cache/tts, ready for --push after the deploy.
  - Browser (5199 test copy → local API, Supabase stubbed, no device voice): setup accent preview plays (unlock silence
    first, then the take); the check's first two takes fetched during the account step; check auto-play + Slow +
    Listen; lesson food-1: 'cheese' prefetched during 'water', 'chicken' prefetched during the choose-heard, which
    auto-played, no "skip this one" line; Say it right with three typed tongue twisters: auto-play and Slow generated
    (ephemeral, 2–4 s), next sentence prefetched.
- **Tooling:** `npx vite-node eval/voice-lines.ts` → `eval/.cache/voice-lines.json`: every line the app can ask for
  (991: en-US 212, en-GB 212, zh-CN 194, fr-FR 164, ja-JP 209; ×2 with slow). `node scripts/warm-voice.mjs
  [--slow] [--only=zh-CN,fr-FR] [--server=URL]` makes each once and lists SILENT lines. `--push` copies
  `server/.cache/tts/*.wav` into the live KV `wunder-tutor-tts-cache` (id 138ec3dd…, via `wrangler kv bulk put`) —
  same keys (sha1 of model|voice|accent|speed|kind|text; live ttsVersion = local). **Run --push only with Leslie's
  OK, after the deploy** (the marker+backup pairs need the new server to be read right; the old server reads a marker
  as a WAV — so push only after deploy).
- **Still open:** slow takes not warmed (991 more); no iPhone check of the unlock; the global generation guard (120
  new takes per 10 min) has no backup — `busy` message; the daily voice limit counts requests, cache hits included;
  tongue twisters are also mis-scored for LEARNERS (same scorer weakness) — nothing done about that; Mandarin backup
  could pass the item's pinyin as `<phoneme alphabet="sapi">` to pin polyphones (not done).
- **Tester, 2026-09-23: "there is not invite code page with chinese onboarding" (commit a85c962).** Two ways: the
  device already had the code from an earlier setup (the step was skipped as needless — reads as missing), or the
  phone could not reach the server at the start of setup, got "no code needed" (NONE) and never asked again. Now
  `ApiHealth.reached` says whether the server answered; setup shows the invite-code step whenever `needsCode`,
  pre-filled and "accepted" when the device has one (Next enabled); the decision waits for a real answer (re-asked at
  the consent and account steps) and is refreshed after sign-in (an account may unlock the services). Both cases acted
  out in Chinese in the 5199 copy. **Testing trap:** after an HMR edit, `import('/src/speech/health.ts')` from the
  browser console is NOT the app's module instance (Vite serves the app `…?t=<stamp>`) — stubbing it changes nothing
  the app sees. Restart the dev server first, then the instances are the same.
- **Builds:** phone `wunder-tutor-2026-09-23a.apk` (Dropbox folder) and Play `wunder-tutor-1.0.4-code5.aab` (UNSIGNED,
  code 5) carry all of this, the 22i / 1.0.3 pair is superseded; they talk to the live server, which lacks the server
  half until deployed.

## Earlier: 2026-09-21 afternoon — Japanese, and conversations in every course (DEPLOYED 14:32, not pushed)

Built at Leslie's request ("add japanese lessons for 5-adult … conversation need to follow language selected — eng,
chinese, french and japanese"). All in phone build `C:/_Cloud/Dropbox/AI/WunderTutor/wunder-tutor-2026-09-21h.apk`.
**Deployed at Leslie's OK, 2026-09-21 14:32** (Pages deployment 717e8c93): app.wundertutor.com serves index-CHaFx5l2.js
(contains the Japanese course), /api/status ok ×3, phone preflight 204. Before it, the phone showed "The teacher can't
say this one" on every Japanese line — the old server refused Japanese text (invalid_text) and locale ja-JP. Japanese
spoken and scored on a real phone NOT yet seen: that is the first thing to check. **Checked live with Leslie's invite
code (14:35, no /api/redeem, so no place taken):** Japanese voice ok (ぎょうざ was already cached — the phone had made
it), Japanese scoring ok (切手 96, 水をください 94 via /api/assess ja-JP), Mandarin and French conversation lines ok —
except "Bonjour ! Tu as faim ?", refused twice: the voice GLITCHES now and then (locally a 19.6 s take whose
transcript stopped at "Bonjour ! Tu"), and the server waited each glitch out and gave up after two takes. Fixed and
**deployed 14:41** (deployment 7ad44a55, commit 23f55d2): a take running longer than the line could is cut off, and a
glitch gets another take, up to three (server/tts.mjs, tested with a fake voice). The line then played live.

- **Locked lessons (16:40, commit 62e17df, phone build 2026-09-21j, NOT deployed):** Leslie asked "WHY SOME ARE
  LOCKED" and chose: children keep the lessons in order ("Finish X first"); grown-ups (band `adult`) may open any lesson,
  "Up next" still marks the first unfinished one. The unwritten future units lost their padlock and say "Coming soon" /
  即將推出 (`.unit-soon` in Home.tsx). Checked in a separate preview: child vs grown-up, phone size, dark, 繁體中文.
- **Settings order (17:40, commit 318b4a3, phone build 2026-09-21k, NOT deployed):** Leslie's order — Learners, Family
  account, Invite code, Appearance, "{name}'s learning", Voice & privacy, then Connections and Demo as before.
- **Math question removed (2026-09-22 08:07, commit 68cbe8e, phone build 2026-09-22a, NOT deployed):** Leslie: "remove
  math challenge". Settings / Parent Zone now open straight from Me (chevron, no padlock). Children can reach the delete
  buttons, the "Help improve" recordings switch and account sign-in; if Apple's Kids category is ever the plan, it needs a
  grown-up check before links out of the app or purchases — the old Gate is in git (Profile.tsx before 68cbe8e).
- **Setup languages (2026-09-22, commit 00f9eaf, phone build 2026-09-22b, NOT deployed):** "Which languages?" lists the
  four courses first, then Spanish, German and Korean (한국어 Korean / 韓文, new) as coming soon. Hint "one or both" →
  "one or more". The Android build sometimes fails with EBUSY (Dropbox lock on android/…/build): just run it again.
- **Tester report (WhatsApp, 2026-09-21 22:55–23:00), fixed 2026-09-22 in phone build 2026-09-22c, NOT deployed:**
  "System back doesn't go back" → `@capacitor/app` + `src/back.ts` (sheet → the page's own choice → history; another
  tab → Learn; Learn → leave; lessons and started conversations ask first, setup steps back like its ←; tested with
  `pressBack` in the page, the native event itself only on a phone). "Back button missing" → the Putonghua level check
  had none (close added); tabs have none by design. "Centre the buddy icons" → `.avatar-pick` grid. "Always getting
  sound isn't working on this device" + "can't hear different accents" → the voice, scoring and tutor were chosen once
  at app start, so a code entered in Settings changed nothing until the app was closed; now `fromHealth()`
  (src/speech/health.ts, tests in health.test.ts). Accents: the server keeps en-US/en-GB takes apart — ask the tester
  to try again on 22c. Maths check (22a) and soon-languages-last (22b) were already done.
- **One learner per account (2026-09-22, commits 8015940 + 875c4a7, phone build 2026-09-22d, NOT deployed, migration
  NOT applied):** Leslie: "Lose the family account. only one user per account. account should belong to the child but
  require parent consent. rename grown-up to adult"; answers: the child's own email is preferred, consent is needed
  under 18, accounts will be gated by payment.
  - App: no learner list or switcher. Settings shows "Account" (the learner's email). Under 18, a parent-consent switch
    must be on before a code is sent, and its words are recorded (`CONSENT_VERSION` 2026-09-22).
  - Sign-in: "I already have an account" on the first screen leads to `/signin`, which only signs in to existing
    accounts (`shouldCreateUser: false`, error `unknown`).
  - Sync: `syncAccount` in sync.ts (deletions first, then the device's learner or the account's).
  - Adult: "Grown-up" becomes "Adult" in the adult labels. Kid-facing "ask a grown-up" copy stays.
  - **At the next deploy:** `apply_migration` with `supabase/migrations/20260922090000_one_learner_per_account.sql` (limit
    8 → 1), then run `supabase/tests/rls.sql` and expect ALL OK. Today it gives 39 ok and 1 expected FAILED. The live
    app and builds up to 22c still offer family learners.
  - Leslie's own account has 4–5 learners from the family days. The app now syncs only the one used last.
  - **Next:** payments. The parent's payment is the consent for under-18s. Suggested but unconfirmed: $9.99/mo,
    $79.99/yr, a 7-day trial, 60 scored recordings a day and 10 free. The server still says "family" (plan
    names, `server/family.mjs`), and the daily limit still counts requests, not recordings.
- **Backup voice (2026-09-22, commit e6ea2f4, phone build 2026-09-22e, NOT deployed):** Leslie: "add azure backup voice".
  - After the Gemini teacher's three tries fail, `server/azure-tts.mjs` (Azure neural voices, same key and region as
    scoring) reads the line. A refused line is kept as the backup's, via a marker under its KV key.
  - The response carries `X-Tts-Voice: backup`, exposed for CORS. The app skips its Kore-trained tone model for those
    takes.
  - Mandarin backup takes pass a lighter gate (`reader`: syllable floor only).
  - Live test with the real Azure voice and the teacher switched off: 14/14 hard lines, scored 83–100.
  - **French live check (170 lines):** 163 played at first; 5 more played on retry. "Voilà ! Bon appétit !" is refused
    every time (`tts_mismatch`), which the backup fixes once deployed.
  - Cloudflare replaces the API's JSON 502 with its own HTML "502: Bad gateway" page. The app only checks `res.ok`, so
    that's harmless, but don't be fooled when debugging: `wrangler pages deployment tail <id>` shows the real
    `[tts] tts_mismatch`.
  - Scoring works live: fromage 95, croissant 97.
- **Google Play (2026-09-22):** the app was created in Play Console (org account Wunder AI Limited, package
  `com.wundertutor.app`, default listing en-GB, Free).
  - Release bundle: `npm run app:aab` gives an UNSIGNED `.aab`. Leslie signs it with jarsigner, typing the password
    themselves (never in a file or a script).
  - Upload key: `C:\_Cloud\Dropbox\AI\WunderTutor\_wunder-upload-key.jks` (renamed with the `_` at Leslie's request;
    the name doesn't matter to Google), alias `upload`, CN=Wunder AI Limited,
    SHA-256 `0D:70:DD:49:F9:F1:67:E0:31:83:90:B2:74:76:61:3D:AD:2E:6C:BE:8B:F1:44:5A:CB:9A:F4:2B:2C:E0:C2:29`. The
    first key was deleted because its password was typed into the chat; this one replaced it before any upload.
  - Builds (bundles and phone APKs) sit in `C:\_Cloud\Dropbox\AI\WunderTutor\` beside the key (Leslie tried an
    `APK\` subfolder and moved everything back, 16:38). 1.0 (code 1) and 1.0.1 (code 2) are signed (META-INF/UPLOAD.*).
  - Internal testing: 1.0 went out first; 1.0.1 was uploaded (added from the library after the draft lost it) and
    Leslie was at "Save and publish". A manual (debug-key) APK can't replace the Play install or be updated by Play:
    uninstall first.
  - **1.0.2 (code 3), UNSIGNED, in the Dropbox folder:** the voice fix fcb0a26 (below) + the Settings text fix 88dae74.
    Phone build `wunder-tutor-2026-09-22h.apk` = the same code. Next: Leslie signs it and uploads a new internal
    testing release.
  - After building, copy the file only if the build succeeded: a failed `app:aab` (Dropbox lock, "Cannot snapshot …
    not a regular file") leaves the previous bundle in the output folder. Retrying the build works.
- **Setup's speaking check was silent on phones after the invite code (2026-09-22, fcb0a26):** "Sound isn't working
  on this device right now". `voice.available()` read the server answer the voice had last fetched (from before the
  code); a phone has no device voice. It now reads `knownHealth()` (newest answer) and SpeakExercise no longer checks
  it before `speak()`. Test in `health.test.ts`; acted out in the 5199 copy with no device voice and stubbed
  API/Supabase (account → code → handover → check: `/api/tts` fetched and played, no message).
  - Next: Internal testing (a tester list, Google-generated app signing key, upload, rollout). Every upload needs a
    higher versionCode (android/app/build.gradle).
- **Setup asks for the email and the invite code (2026-09-22, commit 6d47048, Play 1.0.1 code 2):**
  - Leslie hit the speaking check on the Play build with a silent teacher (no code) and no way out.
  - Now: consent → "Your account" (SignInForm, Next only once signed in; no skip, since Leslie connected Resend) →
    "Invite code" (InviteCodeForm, shared with Settings, shown when the server needs a code and the device has none).
    There's no back arrow once the learner is made. The check has Skip, and the plan then says "based on the home
    language".
  - Resend: DNS for wundertutor.com has `resend._domainkey` and the `send.` SPF and MX records. Supabase's SMTP
    setting can't be read from here: the proof is the sender of the next code email.
- **Mascot:** Tutu since 2026-09-22 (was Pip).
- **Mascot name:** Leslie asked for alternatives to "Pip" (Pip is already a TV bunny: Pip and Posy). Suggested Hoku / Koa
  (no language app found with either); Tomo, Oto, Kiku, Maru, Mimi, Tiko are taken by language apps, Tutu = 大耳朵图图.
  Nothing renamed yet; ~40 text lines (en + zh-Hant) + site mention "Pip".
- **French "would not proceed even at 88%"** (fromage 78 → 88): the retry fixed the r, the screen said "You fixed it!",
  and Continue opened a workout for that same r — the drill was picked from the FIRST take. Now `soundToDrill`
  (tutor/feedback.ts, tested) picks from the last take. The demo microphone also scored French with the English
  lexicon; fixed.
- **Home course switcher → dropdown** (`.course-pick` in Home.tsx), like the settings rows. Later (14:45, commit 81ae290,
  phone build 2026-09-21i, deployed 14:48 as b61fdc81 — index-B89G6MeO, /api/status ok ×3, preflight 204): it lists only the learner's own courses (chosen in Settings) and
  disappears when there is one — Leslie: "even if I select only 2 languages in settings, all 4 appear in front page".
- **Conversations follow the course** (`scenariosFor(p.course)`): three scenes per course, lines are speakable items in
  the course's language (voice, scorer, pinyin/furigana all follow). zh/scenarios.ts (小文), fr/scenarios.ts (Léo, 40
  words added to the French lexicon), ja/scenarios.ts (ゆい). The live Claude tutor stays English-only. Mandarin lines
  were run through the real teacher-voice gate: 95/98 passed; 我喜欢！ and 你好，小文！ are refused every time and were
  replaced; 你看，那边有什么？ passed only on a retry (flaky — rephrase if a phone shows it silent).
- **Japanese course** (src/content/ja/): kana.ts (beats, romaji with macrons, sounds per beat, `{漢字|かな}` markup with
  spaces marking words for the romaji only; `writtenKana` for display — は, never the わ it is said as), sounds.ts (nine:
  ja:long, ja:Q, ja:N, ja:r, ja:ts, ja:f, ja:z, ja:voiced, ja:y), course.ts (unit "Yummy Food おいしい", 7 lessons × 3
  bands, ladders, check items), speech/ja/assess.ts (lines Azure's unnamed ja-JP scores up with our beats: by sound if
  exactly one variant fits, else by syllable, else no names). UI: `ItemText`/`JaText` (furigana, kana-only for 5–7,
  romaji) and `JaBeats` (results coloured per beat). Azure probe (scratchpad, 2026-09-21): it names nothing, splits
  words its own way, catches a shortened おばあさん (42) and a missing っ (51), but NOT voicing (が→か 84) or every long
  vowel (ビル for ビール 96). Teacher voice: 39/40 sampled Japanese lines voiced locally; the 40th hit **Google's quota
  ("Resource has been exhausted") — this session made many Gemini calls on the key the live app also uses**.
- Fixed for every course on the way: Review/"due" count and the course check/setup plan split items and sounds into
  "Mandarin / everything else" (a French review could serve English words) → `itemCourse`, `unitCourse`, `inCourse`;
  Lab and drill intro spoke French examples in the English voice → `soundLocale`; unit badges for fr-cafe and ja-food.
- Open: French already has unit 1 for every age — Leslie also said "add 5-adult lessons for french too"; ask whether
  that means a second unit (the locked ones are Out and About, People, At Work). French course/lesson/sound names have
  no Traditional Chinese yet (Japanese has all of it). The new zh-Hant lines are drafts, not on the Chinese check page.

## Earlier today: Leslie's two requests from the Parent Zone

Asked while looking at the Parent Zone on the phone (screenshot showed "Bro's learning"). **#1 is done (local commit,
not deployed; in phone build 2026-09-21f); #2 is not started.**

1. ~~"courses use dropdown."~~ **Done 2026-09-21** (Leslie asked again: "courses in dropdown like age"). `CoursePicker`
   in src/features/profile/Profile.tsx: a button styled exactly like the other dropdowns ("English · 普通話 · Français
   ⌄") that opens a `Sheet` with a tick per course — still multi-select, changes apply as ticked, the last course
   cannot be unticked (the hint turns into a red "At least one course has to stay"). Every `.select-row select` now
   draws the same arrow (`appearance: none` + `--chevron` in tokens.css, one per theme) so the button can match it on
   every platform; a name never breaks inside itself when three wrap on a phone. "American (most detailed feedback)"
   still does not fit a phone, but now ends in "…" instead of being cut mid-word. Three new lines in 繁體中文 are drafts
   (`settings.learning.courses.title/hint/keep`) — not yet on the Chinese check page.
2. **"help improve wunder tutor always enabled."** Leslie's phone shows the switch OFF, because a profile set up before
   the box existed is deliberately NOT opted in (they agreed to "recordings stay on this device"). **Ambiguous, and the
   two readings differ in consent, so ask before building:** (a) turn it on for existing users too, still switchable;
   or (b) always on, no switch — beta participation means recordings are kept. If (b): replace the checkbox and the
   Parent Zone switch with a plain statement of it, keep deletion-on-request, and note that the few existing testers
   agreed to different words (before 2026-09-21 only the master code existed, so that is mostly Leslie).

Other open design questions, raised with Leslie and not decided:
- **Signing in to a different family's account carries this device's learners into it** (src/account/sync.ts,
  `syncOnce`: a new account resets the bookkeeping and step 3 inserts every local learner). Right for a second parent,
  wrong for a device changing hands. Suggested: ask "add these learners / start fresh" when an unseen account signs in
  with learners already here.
- **Tongue-twister game + leaderboard** — shape agreed (English first, each twister measured first, pass/fail + speed),
  child-safety call on a public board of children still Leslie's. See "Asked for, not built" below.

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
| Code | `C:\_Cloud\Dropbox\Dev\Apps\wunder-tutor` · GitHub **private** `lesliewu321/wunder-tutor` (`main`) — last pushed 2026-09-20 at Leslie's request; **15 commits since are local only** at the end of 2026-09-21 (the last one, the Courses dropdown, is not live either) (push only when asked) |
| App (hosted) | https://app.wundertutor.com (= `wunder-tutor.pages.dev`) — Cloudflare Pages project `wunder-tutor`. **Live = main as of 2026-09-21 14:48** (commit f562955, deployment b61fdc81, verified by bundle hash, `/api/status` ok ×3 and the phone preflight). `npm run deploy`; a GitHub push does NOT deploy. Phone build: `C:/_Cloud/Dropbox/AI/WunderTutor/wunder-tutor-2026-09-21h.apk` (= main with Japanese and course-aware conversations, built 13:38 — Japanese needs a deploy to work; `npm run app:apk`, then copy `android/app/build/outputs/apk/debug/app-debug.apk` there with the next letter) |
| Marketing site | https://wundertutor.com + www — Pages project `wundertutor-website`, source in `site/` |
| API | Pages Function `functions/api/[[path]].js` → `server/core.mjs` (same core runs locally via `server/index.mjs`) |
| Teacher-voice cache | KV namespace `wunder-tutor-tts-cache` (binding `TTS_CACHE`); locally `server/.cache/tts`; plus IndexedDB on each device |
| Learner data | On the device: localStorage (state) + IndexedDB (recordings). A recording goes to the server to be scored and, **only with the learner's consent**, is kept there with no name (see Invite codes and recordings below). Learners and My book pages also sync through a family account — Supabase project `xzghsihffoliduqkjvck`, live (first real sign-ins 2026-09-21; see Family accounts below, and `supabase/README.md`) |
| Accuracy test set | `eval/.cache` (gitignored, ~160 MB of cached Gemini takes + Azure responses) — reruns are free |
| Domain | `wundertutor.com`, registrar Namecheap, DNS on Cloudflare (`annabel`/`porter.ns.cloudflare.com`) |
| Azure | Speech resource `wunder-tutor-speech`, resource group `wunder-tutor`, region **eastasia**, tier S0 |
| Keys | Local: gitignored `.env`. Hosted: Cloudflare Pages secrets. Leslie uses a **separate** Gemini key for this app |

## Commands

```bash
npm run dev          # app (port from $PORT, default 5173 — other sessions often hold 5173)
npm run server       # local API proxy on :8787 (reads .env) — needed for real Azure/Gemini locally
npm test             # 197 tests (vitest)
npm run build        # typecheck + production build
npm run deploy       # build + deploy the app to Cloudflare Pages
npx vite-node eval/run-en.ts            # English accuracy report (cached, free)
npx vite-node eval/report-zh.ts --cv    # Mandarin accuracy report (cached, free)
cd site && npm run dev | npm run deploy # marketing site
npm run app:apk      # the Android app as a file to install on a phone (no Android Studio needed)
npm run app:ios      # sync, then open the iOS project in Xcode — ON A MAC; it cannot be built on Windows
```

Preview configs for the Browser pane: `.claude/launch.json` (`wunder-tutor` has `autoPort`, `wundertutor-website`).

## State of the product (all on `main`)

Onboarding ("Who's learning?" — **four age ranges, 5–7 / 8–11 / 12–17 / 18+**, one screen, no "for you or your child" question; the age decides the rest. Was a 5–17 grid with "My child" preselected and a parent-shaped adult path, so an adult learning for themselves appeared nowhere — Leslie, 2026-09-20/21) → languages (English / 普通話 Putonghua, either or both) → accent
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
  **Snap & say** (renamed from "My book" on 2026-09-21: an adult photographs a menu or a sign, rarely a book; code identifiers still say `book`). The bottom bar is **four plain tabs** (Learn, Lab, Progress, Me). It had a big centre camera button
  (2026-09-19, replacing the old Speak/mic tab); Leslie, 2026-09-20, from screenshots: out of place beside the course,
  and a duplicate of "New photo" in My book — so the camera is My book's own button only ("Take a photo" big and coral
  before the first page, "New photo" small once there is a page to practise). Mode per learner in localStorage (`src/features/say/page.ts`).
- **Say it right** (`src/features/say/`): camera (`CameraScreen.tsx`, full screen on every device via getUserMedia:
  shutter, gallery button inside, torch if the phone has one, photo = exactly what was on screen; blocked → "Use the
  camera app" (capture input) + gallery). Opened from anywhere with `openCamera()` → `CameraHost` (next to the
  toasts). **My book keeps every page** (Leslie, 2026-09-20: "scanned items cannot be saved" — it used to hold one page, and
  each new photo replaced it): `src/features/say/page.ts` is a shelf per learner in localStorage
  (`wunder-tutor/pages/<id>`: `{ pages: [{ id, reading, best, at, changed }], open }`, newest first, 30 pages, the
  oldest makes room and the learner is told; the old single `wunder-tutor/book/<id>` becomes the first page; a browser
  that stores nothing keeps the book for the visit). Home shows the open page in full, the others under "My other
  pages" (tap = open), "Delete this page" with a confirm. Erased with the learner/all data; "Delete pronunciation
  history" erases the pages' scores only (`forgetScores`). On this device only for now: `id` + `changed` are there so
  pages can sync with the learner once accounts exist. A new page is added and Home
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
- **App language** (2026-09-20, Leslie's call: the user CHOOSES it — it is NOT tied to the home language): English or
  繁體中文 (Hong Kong), chosen on the first screen and in Settings → Appearance, switches live (no reload). Only the
  app's own wording changes — never the words being learned, the teacher's voice or pinyin; what the app SAYS ALOUD
  (Pip's tips for 5–7s) stays English (`inEnglish()`), agreed with Leslie. `src/i18n/`: typed keys in
  `en/<area>.json`, translations in `zh-Hant/<area>.json` (728 lines), plus `zh-Hant/content*.json` (516 lines) for
  wording that lives with its data — sound names/tips, lesson/unit titles, badges, goals, scenarios — read through
  `tc(key, english)` in accessors (`phonemeInfo`, `tipFor`, `lessonTitle`, `badgeName`, `goalLabel`, `scenarioTitle`…).
  Rules, style guide and glossary: `src/i18n/README.md` (no wording in module-level constants; one sentence = one key;
  **no —— in Chinese**: the headline font draws it as 一一). `src/__tests__/i18n.test.ts` guards coverage, placeholders
  and bold marks. **The Chinese is a DRAFT: Leslie checks it** (they are the native reader). Until then a Chinese phone
  still STARTS in English (`STARTS_IN` in `src/i18n/index.ts` — add `'zh-Hant'` once checked). Open wording questions
  for Leslie: a Chinese name for "Say it right" (kept in English), 字 vs 字詞 for an English word, 家長 vs 成人,
  badge/goal names, tone descriptions (低低轉彎…), "Buzzy/Quiet" sounds (震動的/無聲的). Bundle grew 428 → 536 kB
  (both languages ship to everyone): load the Chinese catalogs on demand when it matters.
- **Family accounts (2026-09-20, built). LIVE: Supabase's auth logs show real code sign-ins from app.wundertutor.com
  on 2026-09-21 (leslie@… at 02:49 UTC, a second test address dev1@… at 00:39), and sessions refreshing since.** On
  2026-09-22 "Email me a code" showed "That didn't work" in the dev preview only because I had stopped the dev server
  (the sign-in code is lazy-loaded). Weak spot, not fixed: `load()` in account.ts caches a failed import, and the live
  site answers a missing old chunk with index.html (200), so a tab left open across a deploy fails the same way until
  it's reloaded. Everything is in
  `supabase/README.md`: the database is applied to project `xzghsihffoliduqkjvck` (2 migrations; `supabase/tests/rls.sql`
  = 39 access checks, ALL OK; advisors clean except the two erasure functions parents are meant to call), the app has
  Parent Zone → Family account (email → a code, 8 digits as the project is set, any of 6-10 accepted; `src/account/`, libraries lazy-loaded, 31 kB gz), learners and
  My book pages sync (merge rules + engine tested with pretend devices), the API recognises a signed-in family
  (`server/family.mjs`: ES256 token check against the public keys, plan, daily limits; `beta` plan granted when the
  access code arrives with a sign-in). Leslie's decisions: **email code/link sign-in; recordings never leave the
  device.** WAITING ON LESLIE (dashboard, by hand): Site URL + redirect URLs, the two email templates with
  `{{ .Token }}`, the secret key into `.env` → `npm run keys:push` → deploy. Until the secret key is there the API
  still verifies tokens but knows no plans: only the access code unlocks it, as before. First real test = Leslie
  signs in on the phone and a second device; watch `[account] sync` warnings in the console.
- **The phone app (Android), 2026-09-20 — it builds, and nothing has run it yet.** Capacitor carries the very same
  web files on the device (`capacitor.config.ts`, `android/`). Build it with **`npm run app:apk`**
  (`scripts/build-apk.mjs`): that builds the web files with the API's real address baked in (`src/platform.ts` —
  inside the app the page's own address is localhost, so `/api/read` would ask the phone), syncs them into `android/`,
  and runs Gradle. The file lands at `android/app/build/outputs/apk/debug/app-debug.apk` (4.4 MB). It is a **debug**
  build, signed with Android's throwaway debug key: installable on a phone you own, not a Play Store upload.
  - **The toolchain on this machine:** Java 21 at `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`, Android SDK at
    `C:\Android\sdk` (command-line tools 23.0, `platform-tools`, `platforms/android-36`, `build-tools/36.0.0`,
    installed 2026-09-20 — Google's licences accepted on this machine in the process). No Android Studio, and none
    needed. `android/local.properties` points Gradle at the SDK and is gitignored; `npm run app:apk` rewrites it, and
    finds the SDK on a fresh machine from `ANDROID_HOME` or the usual places. The new `sdkmanager` is a wrapper around
    "Android CLI" and wants **slashes**, not semicolons: `platforms/android-36`, not `platforms;android-36`.
  - **Icon and launch screen are the app's own** (they were Capacitor's blue logo): Pip, hand-converted from
    `public/icon.svg` into Android vector art — `res/drawable/pip.xml`, framed for Android's 108-unit icon canvas so
    ears and chin land at 24 and 87, inside the 18–90 every launcher is guaranteed to show. One drawing serves the
    adaptive icon (`mipmap-anydpi-v26/`), the Android 7 icon (`mipmap/`, on a cream plate) and the launch screen
    (`drawable/splash.xml`, cream, and `values-night/` dark so a dark phone gets no bright flash). All vector: sharp at
    any size, no PNG per density. Checked by re-rendering the very same paths and transforms as SVG in the browser and
    measuring the bounds, not by eye. **Google Play will still want a 512×512 PNG for the listing.**
  - **iOS (2026-09-20): the project exists and is dressed, but has never been built** — building it needs a Mac with
    Xcode, and this machine is Windows. `ios/` is a real Xcode project (`npx cap add ios`), bundle id
    `com.wundertutor.app` like Android, deployment target iOS 15, portrait and landscape on both phone and iPad.
    Capacitor 8 uses **Swift Package Manager, not CocoaPods**, so there is no `pod install` step: on the Mac it should
    be `npm run app:ios` (syncs the web files, opens Xcode), pick a team for signing, and run.
    - The **three usage strings are in `Info.plist`** (microphone, camera, photo library) and they are not optional:
      iOS does not refuse an app that asks for the microphone without a reason to show, it **kills the app**. They are
      English only for now — iOS localises them through `InfoPlist.strings`, which the app's own i18n does not cover;
      worth doing for 繁體中文 once Leslie has checked the wording.
    - Icon and launch images are Pip, rasterised from the same drawing: `AppIcon-512@2x.png` at 1024×1024, and the
      launch image at 2732×2732 with a **dark variant** (`Splash.imageset`, `luminosity/dark`). All written **without
      an alpha channel** — Apple rejects an app icon that has one, and a browser canvas only makes RGBA, so they were
      re-encoded as plain opaque PNGs. The launch storyboard is Capacitor's, untouched on purpose: it is known-good
      and nothing here could compile it to check.
    - The API already answers `capacitor://localhost`, which is the origin iOS uses (`APP_ORIGINS` in `server/core.mjs`).
  - **Edge to edge:** Android 15+ draws apps behind the status and navigation bars and there is no opting out. The app
    already copes (`viewport-fit=cover` in `index.html`, `env(safe-area-inset-*)` in `src/styles/tokens.css`), and
    `SystemBars: { initialViewportFitValueHint: 'cover' }` in `capacitor.config.ts` tells Capacitor so before it reads
    the page, so the first screen does not jump. There is no splash-screen plugin and none is needed — the old
    `plugins.SplashScreen` block was dead config (the plugin was never installed) and is gone.
- **Checking the Chinese** (2026-09-20): Leslie checks it on a private Artifact page, **Wunder Tutor Chinese Check**
  (https://claude.ai/artifact/QThnysyrfPbFeSeyUq4Ejp) — all 1,240 lines by section, English | 繁體中文, Change → type →
  Save per line, "mark section as checked", and 8 open wording questions to answer first. Everything is saved in the
  artifact's database: read it with the ArtifactData tool (`list` on `corrections`, `answers`, `sections`; add
  `out_dir` to save the documents), then `npm run i18n:import -- <folder or file>` (guards placeholders, ** pairs,
  the long dash, stale lines; `--dry` first), `npx vitest run`, `npm run i18n:export`, and republish
  `i18n-review.html` to the same URL so corrected lines show "In the app now". Workflow: `src/i18n/README.md`.
  Once Leslie says it is checked: add `'zh-Hant'` to `STARTS_IN`.
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
- **The Android app has never been run.** It builds and the file is correct inside (label, icon, microphone and camera
  permissions, the web files, the API's address baked in) — but no device or emulator has opened it. First run should
  check, in this order: it opens at all; the app's own icon and launch screen; the microphone prompt appears on the
  first speaking take and scoring comes back; the camera opens for "Say it right" and reads a page; Android's Back
  button closes the camera rather than the app; the layout clears the status and navigation bars top and bottom.
- iPhone/iPad Safari — and the **iOS app has never been compiled**: the project is prepared but only a Mac can build
  it. Nothing about it is proven beyond the files being well-formed (plist parses, asset catalogs parse, images are
  the right size and carry no alpha).
- The Claude tutor (no key). Supabase. Teacher-take quality thresholds for Mandarin
  (`TEACHER_MIN_ACCURACY` 85 / `TEACHER_MIN_SYLLABLE` 70 in `server/core.mjs`) are uncalibrated.

## French (2026-09-21): the foundation, no lessons

Leslie asked for French lessons; we agreed to build the part that is the same whoever learns first, and pick the
audience when the first unit is written. **Then built the same day, for every age** (Leslie: "why not kids to adult??"): `src/content/fr/course.ts`, unit "At the Café", 7 lessons × 3 bands — little ones name colours and animals from pictures, juniors ask for a croissant, teens and adults order and ask for the bill. `CourseId` gained 'fr'; French is selectable in setup and the Parent Zone. A test refuses any course word the lexicon cannot name the sounds of. Underneath it:

- **`src/content/fr/sounds.ts`** — nine sounds, chosen because an English or Cantonese speaker gets them wrong:
  y (tu), ʁ (rouge), the three nasals ɑ̃ ɛ̃ ɔ̃, ø (deux), œ (sœur), ʒ (je), ɲ (montagne). Same `PhonemeInfo` shape as
  English and Mandarin, so the Lab, drills and progress would work unchanged. Ids are plain IPA and collide with
  nothing (a test enforces that).
- **`src/content/fr/lexicon.ts`** — ~115 words as `syl.la.bles|ph ph . ph ph`. **This file is why French feedback is
  worth having.** Azure scores French per phoneme and names none of them, exactly as for en-GB, so the names come
  from lining the scores up against this sequence. Conventions that matter: silent final consonants are not written,
  liaison is not written, r is always ʁ, "un" is ɛ̃. A word the lexicon does not know returns NO candidates, so it is
  practised but never coached per sound — a guess from French spelling would put a confident wrong name on a sound.
- **Wiring**: `Locale` gained 'fr-FR' (nothing broke — it widened cleanly); `namePhonemes`/`mapWords`/`mapAzure` now
  take the locale rather than the accent and pick the French lexicon for it; the server's `LOCALES` allow-list
  accepts fr-FR; the teacher voice has a French instruction (nasals kept apart, uvular r, silent finals left silent).
- `src/__tests__/fr.test.ts` — 12 tests on the lexicon's shape and the sounds' integrity.

**Never run against live Azure fr-FR.** The whole design rests on French behaving like en-GB — scores in order, names
empty, one score per phoneme in our sequence. If Azure's French phoneme count for a word differs from the lexicon's,
the alignment finds no fit and the sounds stay **unnamed**, which is the safe failure: the learner gets a word-level
score and no wrong diagnosis. First real step: score a French take and compare Azure's phoneme count per word with
`frAlignmentCandidates`, the way en-GB was measured (93% direct match).

## The teacher's voice on the phone (2026-09-21)

Three separate faults all showed Leslie the same toast, "Sound isn't working on this device" — which is why it kept
looking like "the problem is back":

1. **The API was never deployed** with the cross-origin support the app needs (commit ee1fd66 was pushed, not
   deployed). Every call from the phone was blocked. Fixed by `npm run deploy`. See Gotchas.
2. **A fresh install has no invite code**, and a phone app has no browser voice to fall back on (Android's WebView has
   no `speechSynthesis`), so the Gemini voice is the ONLY voice.
3. **The server refuses a teacher take that does not score as its own text** (`verifyTake`, server/core.mjs) — right,
   because a wrong model teaches a wrong sound — and some lines never pass.

What was done, all measured from cached takes with **`node eval/teacher-gate.mjs`** (free; `--sweep` for thresholds):

- The voice now says WHICH half failed (`VoiceError('take' | 'playback')`, src/speech/types.ts) and the app says the
  matching thing: "The teacher can't say this one clearly enough… try the next one" vs the device message.
  `soundProblem()` in src/speech/health.ts names the invite code, the connection, the line or the device.
- The gate was calibrated against 107 course lines AND 456 takes saying the right syllable with the WRONG tone (the
  transcript check before it already catches wrong words): neutral-tone syllables ignored, Azure's Mispronunciation/
  Insertion labels ignored on synthetic speech, Omission still fatal, syllable floor 70 → 55, **accuracy floor kept
  at 85**. Lines with a voice 98 → 101; wrong tones refused 342 → 341. Rejected after measuring: trusting Azure's
  recognised text (catches 38–171 of 456 — its language model "corrects" a wrong tone), judging single characters
  by the syllable floor (341 → 155), accuracy 83 to rescue 十 (341 → 321).
- **四是四，十是十。 is out of every lesson.** Said alone 四 scores 95 and 是 90; in that sequence 四 drops to 56 and
  all six Gemini voices score 28–82. The scorer cannot mark the sequence — so a learner saying it right would be
  marked wrong. Replacements chosen by score: 诗/丝, 電視, 請給我一杯水。, 獅子. The teen speaking check had held 十 and
  the twister: two of its three items were silent. The item stays in zh/course.ts, unused, with the numbers.
- **Still silent (5): 十, 八, 大, 吃鱼, 喝牛奶.** None is in a lesson any more (十 was also in lesson 4's teen listening
  pair — missed the first time, swapped for 诗/丝 before this handoff). The other four are **Pronunciation Lab ladders
  only**: 八 (zh:t1 syllables), 大 (zh:t4 syllables), 吃鱼 (zh:t2 and zh:ü phrases), 喝牛奶 (zh:n phrases), in
  `ZH_LADDERS`. A learner meets them as a Lab rung that will not play. Swap them for passing items the same way, or
  record those few by hand.

## Invite codes and recordings that come back (2026-09-21, built)

**The phone's speaking loop works end to end** — Leslie, 2026-09-21: "I can already say words and it gives a score".
First real speaking take scored on the device; it confirms the MODIFY_AUDIO_SETTINGS fix that was made blind.

Built so volunteer families can be recruited and their children's voices measured — the one claim nothing has
checked (every accuracy number is from synthetic adult voices). Two migrations, both applied to
`xzghsihffoliduqkjvck`: `20260921100000_invites_and_contributions.sql`, `20260921103000_invite_disabled_means_everyone.sql`.

- **Invite codes** (`invite_codes`, `invite_redemptions`, `redeem_invite()`). Each good for **10 devices, 14 days**
  (Leslie's choices). A device takes a place by REDEEMING (`POST /api/redeem`, the one POST needing no code); the app
  keeps a code only once accepted. Expiry and a full code stop only NEW joiners. **Switching a code off stops
  everyone using it** — it is the lever against a leaked code (the first version let a joined device keep going;
  caught before any code was handed out). The master `BETA_ACCESS_CODE` still works and takes no place.
  Per request the API asks "is this one of ours and not off?", cached 60 s (`server/invites.mjs`). Accepted for a
  beta: a code copied into browser storage by hand, never redeemed, is not counted against its places.
  **`npm run codes:new -- 5 "note"` / `codes:list` / `codes:off -- CODE`** (Leslie runs them; they read the secret
  key from `.env` and never print it). First batch of 5 made 2026-09-21, closing 5 Oct: WUNDER-HD2X8, -DGCKM, -P44UC,
  -BE374, -VKHPP.
- **Contributions** (`contributions` table + private Storage bucket `contributions`). A recording already goes to
  the server to be scored; with consent the server KEEPS that copy instead of discarding it, so nothing new leaves
  the device. Only the main take, never a word's clip check. Stored with no name: device id, band, home language,
  locale, what was asked, the scorer's raw answer, app version. Kept after the score has gone back (`waitUntil`), so
  a failure costs a recording, never a lesson. Silent takes are not kept. Files land at
  `contributions/<locale>/<day>/<id>.wav`; query them with SQL on `public.contributions` / `storage.objects`.
- **Consent.** Setup shows "Help improve Wunder Tutor", **ticked by default for everyone** (Leslie's decision, made
  after being told a pre-ticked box for a child's voice is consent a regulator discounts). Changeable in the Parent
  Zone. **People who agreed before the box existed are NOT opted in** — a missing setting means no, because they
  agreed to "recordings stay on this device". Three promises that became false were rewritten: "Recordings stay on
  this device" → "are kept on", the Parent Zone line now changes with the switch, and the account blurb says
  recordings are never saved *to the account*. The required "I agree" switch moved ABOVE the two preferences: last,
  it fell below the fold behind the button it unlocks. **Known limit:** on a small screen (375×812) the pre-ticked
  box itself sits partly below the fold — fine on Leslie's taller phone, but a hidden pre-ticked box is the weakest
  form of consent there is. Revisit before real families.
- **Deletion is manual**: the consent says "ask us"; delete by device id (`delete from public.contributions where
  device = …` plus the files). No in-app button yet.

## Asked for on 2026-09-20/21, not built yet

Items 1 and 2 of this list (recordings that come back, invite codes) were built on 2026-09-21 — see the section above.

3. **A bonus game: tongue twisters**, said aloud and scored, with **a central leaderboard** of the highest scorers.
   Agreed shape (2026-09-21): **English first** (its scorer names each sound, the strongest of the three), each
   twister **measured through the scorer before it goes in** — 四是四，十是十。 proved a scorer can fail a whole
   sequence while marking every syllable in it perfectly — and ranked on **"said it right" (pass/fail) plus speed**
   rather than the fine score, which is both fairer and what a tongue-twister contest is. **A public board of children
   ranked by nickname is a child-safety decision** still waiting on Leslie before the board is built.

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
- **Install the Android app on the phone and open it** (`npm run app:apk`, copy the file across, tap it) — the first
  time any of this has run on a device.
- **Build the iOS app on the Mac** (`npm run app:ios`, choose a signing team in Xcode, run on the iPhone). Everything
  is prepared; only a Mac can do it.
- A Play Store upload needs a signing key of Leslie's own plus a 512×512 icon for the listing (the App Store takes
  its icon from the build, so iOS needs no separate file).
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
- **The phone app needs the API DEPLOYED, not just committed.** The app is a different origin from the API
  (`https://localhost` → `app.wundertutor.com`), so every call is cross-origin and the browser asks permission first.
  That permission was written in `ee1fd66` and pushed to GitHub — and a GitHub push does not deploy. On the phone,
  every single call (voice, scoring, reading, health) was blocked before it left the device, and the only thing the
  learner saw was "Sound isn't working on this device right now". Check it from anywhere with:
  `curl -X OPTIONS -H "Origin: https://localhost" -H "Access-Control-Request-Method: POST" -D - https://app.wundertutor.com/api/tts`
  — it must answer 204 with `Access-Control-Allow-Origin`, not 405.
- **A phone app has no second voice.** Android's WebView has no `speechSynthesis` at all, so `WebSpeechVoice` is dead
  inside the app and the Gemini teacher voice is the ONLY voice. On the web a failure quietly fell back to the phone's
  own voice; in the app it is silence. Anything that stops the API stops sound outright — including a fresh install,
  which has no invite code until a grown-up enters one.
- **The phone app's microphone hangs on a permission nobody asks about.** When the page calls for the microphone,
  Capacitor asks Android for `RECORD_AUDIO` **and `MODIFY_AUDIO_SETTINGS` together**, and counts the answer as yes
  only if every one came back yes (`BridgeWebChromeClient.onPermissionRequest`). Android always answers no to a
  permission the manifest never declared — so without that second line in `AndroidManifest.xml` the app refuses the
  microphone to every learner, silently, with no dialog to explain it. It is declared now. The same all-or-nothing
  rule will apply to anything else added to a `getUserMedia` call later.
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
  keeps the first one Google accepts: **`google-apac-a` (Tokyo, NRT, ~50 ms from HK)**, `google-apac-c` (Osaka, KIX),
  then `google-oc` (Auckland) and `google-wnam` (Dallas). A relay lives where it is FIRST used from; `apac`-hinted ones
  first used by HKG-entering requests landed in HKG (refused). The Japan ones were first used from the Auckland relay
  via the relay's own `/spawn` (egress/src/index.mjs): six tries gave NRT, KIX, KIX, HKG, HKG(from Dallas) — never
  Singapore, which Leslie asked for; Japan is ~15 ms slower, irrelevant next to model time. To make another: add a
  temporary guarded route in `functions/api/[[path]].js` that calls `relay('google-oc').fetch('https://egress.internal/spawn?name=…&hint=apac')`,
  read `livesAt`, list it if it isn't HKG, remove the route (see commit history, 2026-09-20). Sending a first request
  from the Supabase database in Singapore (pg_net) was blocked by the permission classifier — don't retry that. `/api/status` shows `egress` ("google-oc AKL"). The same block
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
on Home — follow the curriculum, or take a photo from a book", "the centre button should be a camera" (later: "out of place" in Course mode, "duplicate" in My book → removed),
"choose a photo = a gallery icon inside the camera". UI work is also done "with the gauntlet method" (build, run, screenshot,
critique, fix, retest).

## Key files

- Core loop UI: `src/features/speak/SpeakExercise.tsx`, `useSpeechTake.ts`, `WordSheet.tsx`
- Speech: `src/speech/{azureProvider,mockProvider,recorder,pitch,voice}.ts`, `src/speech/zh/{assess,tone,toneModel}.ts`
- Teaching: `src/tutor/feedback.ts` · Sounds: `src/content/phonemes.ts`, `src/content/zh/sounds.ts` · Words: `src/content/lexicon.ts`
- Mandarin content: `src/content/zh/{course,pinyin,alternatives,script}.ts`
- Engine: `src/engine/learning.ts` · Profile memory: `src/intelligence/profile.ts` · Store: `src/state/store.ts`
- API: `server/core.mjs`, `server/tts.mjs`, `server/tutor.mjs` · Eval: `eval/`
