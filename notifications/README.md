# Wunder Tutor reminders

Web-only release. Entry points: Home bell, Profile → Reminders & rewards, Settings, and one optional inline offer after a learner's first lesson. No notification permission request on launch or onboarding.

## Learning behaviour

- Off until the person explicitly enables browser notifications after choosing a schedule.
- Suggested Monday/Wednesday/Friday at 18:00, quiet hours 20:00–08:00. All courses/profiles on a device share the slot.
- One proactive attempt per recipient per local day; also at least 20 hours between attempts after timezone changes.
- Due review takes the usual slot when available; otherwise the next unlocked lesson. Taps open the reminder centre, which resolves current profile, enrolled courses and unlock state before offering a lesson.
- Optional Sunday summary replaces the practice reminder. No summary without activity that calendar week.
- Completed lessons, tests, conversations or the daily XP goal suppress further reminders that day. A visible app suppresses reminders. Legacy XP dates keep their original device calendar date.
- Skip today, pause seven days, resume, editable days/time/quiet hours/course scope, follow-device or fixed IANA timezone, and turn off.
- No loss threats, rank pressure, marketing, inactivity escalation, or achievement push spam. Three practice days in a calendar week earn an in-app celebration; stamps and real saved XP are shown without treating XP as pronunciation accuracy.
- Notification copy and settings follow all seven app languages. Translation is a draft pending native review.
- Automatic sending ends seven days after last app contact. Returning with the same subscription renews it. Registrations and signing keys are deleted after 30 days without contact; after that, explicitly enable again.
- Fixed lesson content, seasonal lessons and new achievements already appear inside the app. No broadcast notifications for downloaded reference material.

## Storage, identity and delivery

Pages authenticates /api/notifications through the existing code/account layer. A verified account id determines the recipient; a beta learner without an account uses a random private installation id. No client-supplied account id is trusted. Accounts designate one reminder device; enabling another replaces it. Signed-in secondary devices contribute suppression dates but cannot change the primary schedule by heartbeat.

The private wunder-reminders Worker has no public route. One SQLite-backed ReminderRecipient Durable Object stores each recipient's subscription, preferences, recent activity dates, active timestamp and send ledger. No names, scores, audio or lesson text. VAPID keys are generated once inside that object's runtime and never returned except for the public key; no manual secret upload or external notification vendor is needed. Removing a subscription retains only signing key + send ledger for up to 30 days to prevent off/on duplicate sends.

A Cloudflare alarm wakes only for the next eligible slot or eventual cleanup. Before contacting the browser push provider, it persists the daily ledger. Ambiguous failures are not retried that day. 404/410 retires the subscription. The push request uses encrypted aes128gcm payloads, a five-minute TTL, low urgency, no redirects, an allowlist of browser push endpoints and a ten-second timeout.

Worker registration and its push-script import use the application build version in their URLs, with updateViaCache set to none. This avoids stale browser imports even when the custom domain overrides Cache-Control headers.

The service worker independently suppresses expired/duplicate/quiet-hour/paused/disabled messages, completed days and foreground windows. It uses persistent IndexedDB state and fixed same-origin navigation. Displayed notifications are silent, replace the previous learning reminder, and contain generic wording only.

Sign-out and profile deletion remove this browser's subscription. Account deletion requests removal for the account's primary recipient too. Offline local opt-out is saved to the service worker; browser unsubscribe is attempted even when the API is unavailable. Cross-device suppression depends on app contact/sync, and a delivery already in flight can race an opt-out. Browser/OS display is not guaranteed by provider acceptance.

## Deployment

1. Required checks in AGENTS.md, commit all release files.
2. From a clean checkout: npm run deploy:notifications, then npm run deploy.
3. Record Worker version, Pages deployment and application commit in HANDOFF.md.
4. Never expose the local QA harness or deploy .wrangler files.

No Supabase schema change, email service, native mobile plugin/build or GitHub push. iPhone/iPad users must add the web app to the Home Screen and enable notifications there. Unsupported browsers retain the in-app progress view.

## Verification

- Vitest: scheduling, quiet hours, cap, cross-course suppression, DST gaps/folds, non-hour offsets, pauses, staleness, account merge, safe course selection, recipient ownership, retries, cleanup, SSRF rejection, Web Push decryption and API access.
- Edge QA: opt-in only, save without permission, enable/skip/pause/resume/disable, daily stamp, all seven languages, mobile layout, actual browser IndexedDB duplicate/stale/disabled checks and safe clicks.
- Local workerd: SQLite persistence, VAPID generation and alarms. Installed workerd supports compatibility date 2026-08-08; local QA uses that override, production config remains 2026-09-25.
- Real Apple/Google/Microsoft push delivery on physical devices remains a release smoke check, not something proven by mocked browser subscriptions.
