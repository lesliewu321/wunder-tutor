# Wunder Tutor — handoff to astra (2026-09-25)

Written by Claude at the end of session 5 for astra, the agent continuing the work. Start here; the full history, with
every decision's reasoning, is in `CLAUDE_HANDOFF.md` (long; search it rather than read it end to end).

## What the product is

A pronunciation tutor PWA for children (age bands little 5–7, junior 8–11, teen) and adults, paywalled, Hong Kong
first but global. Courses: English, Putonghua, Japanese, Korean, French, Spanish (in that order everywhere). A learner
speaks; Azure scores it (per sound / tone / syllable); Gemini voices the teacher, with Azure TTS as backup.

- Live: https://app.wundertutor.com (Cloudflare Pages project `wunder-tutor`). Marketing site: `site/`.
- API: Pages Function `functions/api/[[path]].js` → `server/core.mjs` (runs locally via `npm run server`).
- Data: Supabase project `xzghsihffoliduqkjvck` (Singapore); migrations in `supabase/migrations/`.
- Recordings (with consent): R2 bucket `wunder-tutor-recordings`. Teacher-voice cache: KV `wunder-tutor-tts-cache`.
- Google refuses Hong Kong/China: `/api` probes Google directly and only relays through the Tokyo Durable Object
  (`egress/`) where refused. `/api/status` says which (`egress: …`).

## State right now

- **Live = commit `1bf66fb`** (Pages deployment `0fcf2047`), plus handoff-only commits after it (`d9f4e98`).
- **GitHub** (private `lesliewu321/wunder-tutor`): `main` pushed 2026-09-25 at Leslie's request, up to `a2cbb8a`
  (113 commits since 2026-09-20). Push again only when Leslie asks. The uncommitted work below is NOT on GitHub.
- **Phone apps:** Android 1.0.7 (code 8) from 2026-09-23. **No APK / AAB / iOS build until Leslie says so** — web only.
- **Your own uncommitted work is in the checkout:** the "communication" lesson packs (`astra-lessons/*communication*`,
  `astra-lessons/courses/*-communication.json`, `astra-lessons/i18n/communication.json`) and edits to
  `src/content/*/course.ts`, `src/content/course.ts`, `src/content/fr/lexicon.ts`, `src/engine/learning.ts`,
  `src/i18n/index.ts`, `scripts/i18n-check.mjs`, three tests and `package.json`. When last run, 5 tests failed
  (es/ko "7 lessons" counts, fr lexicon missing ~120 words, two astra-lessons progression tests). Claude did not touch
  or commit any of it, and deployed from a clean worktree so it would not ship half-done.

## Built in session 5 (all live)

| Area | What | Where |
| --- | --- | --- |
| App language | 7 languages: English, 繁體中文, 简体中文, 日本語, 한국어, Français, Español. En + 繁 bundled, others fetched on demand | `src/i18n/` (README there) |
| 简体中文 | Generated from 繁體中文 (OpenCC hk→cn + HK→mainland words). Never edit zh-Hans by hand | `npm run i18n:hans` |
| Translations | ja/ko/fr/es are **machine drafts, not native-checked** — incl. consent/privacy text | `src/i18n/<lang>/` |
| Lesson guides | Keyed by the English line: `tl(english, hant)` | `<lang>/lessons.json` |
| Item meanings | The grey line under a word, in the App language, for lessons AND conversations; hidden where the App language is the course's own | `<lang>/meanings.json`, `tm()` |
| Checker | Keys, placeholders, bold, missing meanings | `npm run i18n:export` then `npm run i18n:check` |
| Home languages | Hindi and Arabic removed completely (old learners → "Another language") | `src/content/translations.ts` |
| Profile tab | "Me" renamed Profile; Course dropdown at the very top with "Add or remove courses…"; no My progress row | `src/features/profile/Profile.tsx` |
| Settings | No Courses row. English accent only if learning English; Chinese characters only for Putonghua learners in HK/TW/MO | `src/engine/region.ts` |
| Putonghua script | **Simplified by default everywhere**; Traditional offered only in HK/TW/MO | setup + store v4 |
| Lesson map | Scenic map per age band (meadow / mountain trail / contour map), Map/List switch | `src/features/home/LessonMap.tsx` |
| Lab | Conversation practice moved here from Home | `src/features/lab/Lab.tsx` |
| Tongue twisters | Off Home; a **bonus round** after finishing a unit; row on Profile for the boards | `bonusTwister()` in `src/content/twisters.ts` |
| Seasonal lessons | Festival bonus lessons with a Home card showing date + language | `content/seasonal/` (below) |

## Seasonal lessons — how to add one

- Lessons: `content/seasonal/<course>.json` (same format and loader as a course; `npm run content:check` checks it).
- Calendar: `content/seasonal/events.json`. Each festival has `courses` (which languages it is for), a date —
  `days` (moving festivals: write every year's date out, never compute) or `every` (`MM-DD`, fixed) — a window
  (`before` / `after` days) and `lessons` per course.
- Mid-Autumn: Putonghua only, live now. **Christmas: all six courses, every 12-25, NO lessons yet** — Leslie said
  "don't write xmas lessons yet". A course without a lesson shows nothing.
- Add a festival's title/blurb to each `src/i18n/<lang>/content.json` (`season.<id>.title`, `.blurb`).

## Leslie's standing rules

- **Deploy to the web only** (`npm run deploy`). No phone builds until told.
- **Deploy from a clean tree.** If the checkout has anything uncommitted that isn't ready, deploy from a clean
  `git worktree` of the commit (link `node_modules`; remove the link with `rmdir`, never a recursive delete).
- **Never print or ask for secret values** (keys, `BETA_ACCESS_CODE`). Leslie runs `npm run keys:push`.
- **Don't push to GitHub** unless asked. Don't start/stop Leslie's own dev server on 5173.
- **Wrangler KV / R2 commands need `--remote`** (wrangler 4 defaults to a local simulation).
- **Children's voices** (`eval/volunteers`, `eval/contributions`) stay gitignored, never committed.
- **Leaderboards** show only avatar + random handle ("Brave Otter 42") + two-letter region. Nothing else.
- **No gates except the paywall** (no grown-ups' gate on course changes).
- Write for Leslie plainly: what changed, what Leslie will see, what is left. Put commit + deployment id in the handoff.

## Commands

```bash
npm test                         # vitest (342 tests when clean)
npm run typecheck
npm run content:check            # every course + seasonal file
npm run i18n:export              # writes i18n-source.json (gitignored) — the translators' source
npm run i18n:check               # every App language against it
npm run i18n:hans                # regenerate 简体中文 from 繁體中文
npm run lessons:build            # rebuild astra-lessons/courses/*.json from the authoring data
npm run dev                      # app; npm run server for the local API on :8787
npm run deploy                   # build + deploy to Cloudflare Pages (web only)
```

## Known gotchas

- **Dropbox + Vite:** two quick writes to one file can leave the dev server serving the first ("X is not defined").
  Re-save the file. Production builds are unaffected.
- **Git Bash heredocs** mangle backticks and `${}`; write scripts to files (or use an editor) instead.
- **Windows HK time zone** reports `Asia/Shanghai` on desktops; the HK/TW/MO rule also checks device languages.
- The course schema rejects a `"_"` comment field in course files (calendar files may have one).

## Open / next

1. Your communication packs: finish, get the 5 failing tests green, `npm run content:check`, commit, deploy.
2. Native-speaker review of ja/ko/fr/es (consent/privacy text first). `npm run i18n:export` makes the review list.
3. Japanese, Korean, French, Spanish courses: 1 open unit each (7 lessons) vs 16 units / 112 lessons for English
   and Putonghua. The `astra-lessons/library` sources are reference only: only French (CC BY 4.0) may be adapted.
4. Push notifications: not built. Plan in `docs/NOTIFICATIONS-PLAN.md`; `content/seasonal/events.json` is meant
   to feed festival announcements. Web push first (needs a signing key pair as a secret — Leslie sets it).
5. Ideas given to Leslie for Snap & say: school dictation (默書) lists, textbook read-aloud, snapped words into
   review, a weekly parent page, a daily snap challenge. Not built.
6. Christmas lessons for all six courses — only when Leslie asks.


## 2026-09-25 — Astra communication packs released

This update supersedes the communication-pack status and old lesson counts above.

- Deployed content commit: e7c5d23e758da614710a918b2c53d2310d17fdc8.
- Cloudflare Pages production deployment: 1a4d32c8-1275-40e5-999e-bde5d2382a83.
- Live: https://app.wundertutor.com ; deployment: https://1a4d32c8.wunder-tutor.pages.dev.
- Added 162 lessons: Getting Around, People & Small Talk, and Work & Professional Communication in English,
  Putonghua, Japanese, Korean, French and Spanish. Each language has 27 lessons with three age-band versions;
  children use school/teamwork situations. Books, sources and answer keys are in astra-lessons; start at
  astra-lessons/COMMUNICATION-MAP.md. English/Putonghua now have 139 playable lessons each; the other four have 34 each.
- The five failures recorded above are resolved: updated progression/count expectations and added French
  pronunciation entries. The full suite passes 356 tests; one optional export test is skipped there and passes
  separately via npm run i18n:export. npm run typecheck, npm run content:check and npm run i18n:check all pass.
- npm run deploy built and published from the clean detached worktree .wrangler/communication-release at the
  deployed commit. Git status was empty before and after deployment. The deploy script now records commit-dirty=false.
  Both deployment and custom-domain HTML return HTTP 200 and reference the exact built JavaScript bundle;
  downloaded bundle bytes match the local build (SHA256 e1f4e6e201db8f7dbad4e36db2c56178071550fd91826af422e3e5912dffde36).
- Existing unused Mandarin item warnings and Vite's large-bundle warning remain non-blocking. Independent
  language-teacher review remains pending; these original materials are not institutionally accredited.
- Main checkout retains unrelated source-library files, shared README changes, the notification plan and the
  pre-existing Vite timestamp file. They were preserved and excluded from deployment. No GitHub push or mobile build.
- This release record and the published flag are committed after deployment; the deployed application commit is
  the one above, not the later documentation-only commit.


## 2026-09-25 — Correct-answer sound released

- Deployed commit: a620025. Pages production deployment: 039d9b40-ac7e-4b9f-84e5-24c9f839e1a2
  (https://039d9b40.wunder-tutor.pages.dev), live at https://app.wundertutor.com.
- Correct listening choices, minimal pairs and reading choices now play an original 0.34-second two-note chime,
  in practice and test modes across all courses. Wrong answers and repeated taps after answering do not chime.
- The sound is generated locally with Web Audio, requires no API/download, follows device volume and fails quietly
  if audio is unavailable. There is currently no separate sound-effects setting.
- npm test: 356 passed, 1 optional export test skipped in the clean release checkout. npm run typecheck,
  npm run content:check and npm run i18n:check passed. Production build passed with the existing chunk-size warning.
- Headless Edge verified all three choice types in both modes, correct/incorrect clicks and duplicate-answer taps,
  with no page errors. Actual sound output has not been auditioned on a physical phone.
- Deployed from a clean detached worktree; production HTML and JavaScript match the built bundle.
  Unrelated local files preserved; no GitHub push or mobile build.


## 2026-09-25 — Unified curriculum, teacher voices and settings restored

- Deployed application commit: 7cdee3b (Unify age-based courses and add selectable teacher voices).
- Cloudflare Pages production deployment: d0a71ce4-275b-4fab-898a-e6f8799d0a05.
  Live: https://app.wundertutor.com ; release: https://d0a71ce4.wunder-tutor.pages.dev.
- Original and Astra lessons now form 24 topic/difficulty paths across six languages and Little, Junior, Teen and
  Adult. All 414 lesson IDs remain: English/Putonghua 139 each, Japanese/Korean/French/Spanish 34 each. Completed
  lessons remain accessible. Adult plans add a foundation warm-up; teen work lessons use school/teamwork content.
  Foundation review carryover follows the new order. See astra-lessons/CURRICULUM-MAP.md and curriculum-manifest.json.
- App-language coverage includes every course item and tutor prompt, including older English items without meaning
  fields. Little learners now see meanings too. Translation prompts follow the app language. Seven app languages
  pass coverage checks. Reading/arrange meanings appear after solving, and test translation hints are hidden.
  Translation coverage is not native-teacher approval; independent review remains pending.
- Settings → Teacher voice now offers Automatic, Azure Neural, Qwen, Google Chirp 3 HD, Gemini and device speech,
  with device-local persistence and a course-language preview. Explicit providers never silently switch on failure.
  Provider/voice/accent/speed/text caches stay separate; existing Gemini cache keys are preserved. Qwen uses one
  audio take for normal and pitch-preserving slow playback, so repeated Listen/Slow taps add no paid generation.
- New server adapters preserve authentication, rate limits, generation budgets and private-text cache exclusions.
  Azure is directly selectable without Gemini. Production has Azure/Gemini secrets; Qwen and Google Cloud TTS keys
  are NOT configured, and those dropdown options remain unavailable. Leslie runs npm run keys:push after setting
  the optional keys and Qwen region, then deploys. See server/TEACHER-VOICES.md and .env.example. No secrets uploaded.
- Help improve Wunder Tutor no longer disappears when Azure health is unavailable. Onboarding shows the same
  control as a visible card. Existing preferences and the previously requested defaults are preserved. The profile
  settings cog is now symmetric with a larger, accessible button background.
- Pronunciation scoring stays Azure. SpeechSuper (all six course languages) and Speechace (English/French/Spanish)
  were suggested as separately evaluated alternatives, not integrated or benchmarked in this update.
- Verification: npm test 369 passed, 2 optional exporter tests skipped in the normal suite; both exporters passed
  separately. npm run typecheck, npm run content:check and npm run i18n:check passed. New regression tests cover all
  24 paths, translated course text, progress, provider selection, cache isolation, rapid taps and API access control.
  Edge browser QA passed consent toggling/persistence while disconnected, three mocked provider previews,
  mobile layout, cog navigation and Chinese meanings in all four age groups. Profile screenshot visually checked.
- npm run deploy built/published from the clean detached .wrangler/merged-release checkout. Tree clean before and
  after. Production and deployment HTML return 200; JavaScript bytes match the build. SHA256:
  022d85100d686e934be254ab47ebef435e52caa037178a35b55f859e8dd45a50.
  Both APIs expose the new provider metadata. Live paid synthesis was not attempted: no local production access
  code was present. Qwen/Chirp were validated against provider docs and mocked responses, not real credentials.
- Existing unused Mandarin item and bundle-size warnings remain. Shared README/source-library/notification files
  are preserved and excluded from the release. No GitHub push or mobile build. The temporary release checkout is
  removed after verification to avoid duplicate Vitest discovery; Leslie's port 5173 server is untouched.


## 2026-09-25 — Gentle reminders and weekly rewards released

- Final deployed application commit: 8ee3733 (implementation bac16a8; versioned-worker cache correction 8ee3733).
- Pages production deployment: d404fa95-2332-4c3a-b806-db3e17a2fe28.
  Live: https://app.wundertutor.com ; release: https://d404fa95.wunder-tutor.pages.dev.
- Private scheduler Worker: wunder-reminders, version bfe14595-a836-4165-83e7-f28b24620e3b, deployed from bac16a8
  (scheduler code unchanged in final commit). No public route. Pages accesses ReminderRecipient through REMINDERS.
- Home bell, Profile and Settings open Reminders & rewards. A single optional inline offer appears after the first
  lesson; no permission prompt at launch or onboarding. Reminders start OFF and need an explicit Enable action.
- Default Monday/Wednesday/Friday 18:00, quiet hours 20:00–08:00, editable days/time/timezone/course scope. At most
  one proactive attempt per recipient/day across courses, and at least 20 hours across timezone changes. Due review
  replaces ordinary practice; optional Sunday summary replaces that day's reminder and requires activity that week.
- Completed lesson/test/conversation or daily XP goal suppresses that day's reminder. Foreground activity suppresses
  delivery. Skip today, pause seven days, resume and turn off controls; reminders stop after seven days away. Stale
  queued pushes expire after five minutes. Registrations/signing keys are removed after 30 days without contact.
- In-app three-day weekly challenge, calendar stamps, weekly saved XP and recent earned badges. No loss threats,
  rank pressure, repeated inactivity nags or push achievement spam. A bounded completion log preserves repeat-session
  practice dates across account merges. Legacy XP dates retain their original device calendar date.
- All seven app languages include UI and generic push copy. No names, scores or audio on lock screens. The settings
  explain server storage of push subscription, schedule, course choices and recent practice dates. Native review of
  translations is still pending. Signed-in accounts designate one device; a secondary signed-in device can suppress
  reminders with its activity. Offline cross-device activity cannot suppress delivery until it contacts the service.
- Signing keys are generated once inside the recipient's private SQLite-backed Durable Object, never sent to the
  browser except for the public key. No new secret upload is required. No Supabase schema change, email service,
  mobile plugin/build or GitHub push. Existing account lifecycle reused, reviewed against Supabase sign-out guidance.
- Server access checks, endpoint allowlist, encrypted Web Push, short TTL, persistent deduplication before delivery,
  no same-day retries after ambiguous failures, automatic removal on 404/410. Sign-out/profile deletion unsubscribe
  this browser; account deletion also requests recipient removal. Already in-flight delivery can race an opt-out.
- Production's custom domain overrides Cache-Control for static workers to max-age=14400. The final correction
  versions both worker and push-script URLs with the app build and sets updateViaCache=none; live browser verified.
- Verification: npm test 402 passed, two optional exporters skipped in normal suite; i18n exporter ran separately.
  npm run typecheck, content:check, i18n:export and i18n:check passed in the clean final release checkout. Edge QA
  passed opt-in-only setup, schedule validation, enable/skip/pause/resume/disable, permission-denied state, completed
  day stamps, all seven languages, 390px layout and safe push click destinations. Real IndexedDB tests confirmed
  duplicate/stale/disabled suppression. Local Cloudflare runtime verified SQLite, alarm scheduling, key generation,
  VAPID signing and encrypted payload generation (local compatibility override 2026-08-08 for installed workerd).
- Live/deployment HTML, JS and both worker files match the built release. API rejects unauthenticated notification
  requests. Live mobile UI and versioned worker registration passed. Main JS SHA256:
  9de0c0616c0cecdf2633c3a950ffadf365b4998453ebd52059a3b93d5162c1ea.
- Real external push delivery on physical iPhone/Android/desktop devices is NOT proven by these checks. Browser
  subscription was mocked in UI QA; crypto/runtime were tested separately. iPhone/iPad require Home Screen install.
  Production authenticated registration was not exercised because no local production access code was present.
- Deployment ran from clean detached .wrangler/notification-release. Existing unused Mandarin item / large-bundle
  warnings remain; dynamic/static import warning is benign (intentional lifecycle imports, not intended splitting).
  Existing React Router audit advisories are unchanged; the new Web Push dependency has no production audit findings.
- Temporary QA servers/checkouts cleaned up; Leslie's 5173 server untouched. Unrelated lesson library, README and
  docs/NOTIFICATIONS-PLAN.md changes remain untouched. Implementation details: notifications/README.md. This note
  is committed after deployment and does not change the deployed application commit.
