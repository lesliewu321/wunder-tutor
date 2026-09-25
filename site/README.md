# Wunder Tutor marketing website

Astro site for https://wundertutor.com, deployed to the **wundertutor-website** Pages project.
The app at app.wundertutor.com is a separate deployment. Run these commands from `site/`:

```sh
npm run dev
npm run content:sync   # update facts from the current app code, then review the copy
npm run build          # rejects stale facts; checks Astro and generates static HTML + sitemap
npm run deploy         # requires a clean Git tree; builds and deploys only the marketing site
```

Install dependencies at both the repository root and in `site/`. The facts script uses the root's
installed vite-node with file watching and dependency discovery disabled. No new app features,
lessons or translations are created by this site.

## Keep claims aligned with the app

- `src/lib/app-facts.json` is generated from the app's course registry, all four age paths,
  guided scenarios, interface languages and teacher voice defaults. Course lesson counts exclude
  seasonal bonuses and do not multiply the count by the number of age versions.
- `src/lib/content.ts` is the shared source for visible FAQ answers and FAQ structured data.
- Age groups: `../src/state/store.ts` (`bandForAge`).
- Course behaviour: `../src/content/course.ts`, `../src/features/lesson/`, `../src/features/lab/`.
- Reading limits: `../server/read.mjs`, `../src/features/say/`, `../src/speech/read.ts`.
- Voice choices: `../src/speech/teacherVoiceDefaults.ts`, `../src/features/profile/TeacherVoiceSelect.tsx`.
- Access: `../server/core.mjs`, `../src/speech/health.ts`, and the current access/onboarding screens.
  Access wording deliberately directs visitors to current in-app preview and authorization options.
- Privacy: `../src/state/store.ts`, `../src/features/profile/Profile.tsx`, `../src/account/`,
  `../server/invites.mjs`, `../server/read.mjs`, `../server/teacher-voices.mjs`, `../notifications/`.
  A passing count check does **not** verify prose: review FAQ and privacy copy when these change.

FAQ answers are native HTML details elements, usable without client JavaScript. Canonical URLs,
Open Graph/Twitter metadata, SoftwareApplication/Organization/WebSite/FAQPage data, robots.txt
and sitemap cover the static pages. No ratings, testimonials, prices or learning outcomes are invented.

## Capture screenshots

With the app already running on localhost:5173:

```sh
npm run screenshots
```

Use `PLAYWRIGHT_MODULE` to point to an installed Playwright package if necessary. The script launches
an isolated headless Edge context with a fictional learner, disables recording contributions and
score sharing, and captures the real UI. It does not use a personal browser, sign in, submit audio,
seed scores, alter the app DOM or start/stop the app server. Notebook uses original typed sample text.
An optional `APP_CAPTURE_URL` must be localhost or 127.0.0.1.

The captures are optimized to 390px and 780px WebP, with a provenance manifest beside them.
Review every captured screen, update the capture date on the homepage, and commit the assets.
The hero is eager-loaded; the rest have lazy loading, explicit dimensions, responsive sources and alt text.
Run `node scripts/og.mjs` after changing the social-preview wording.

Before release, check desktop/mobile layouts, FAQ pointer and keyboard operation with JavaScript
disabled, metadata/schema parity, every screenshot and link, privacy, robots and sitemap. Run the
repository's required tests and content/translation checks. Deploy from a clean checkout and record
the code commit and Pages deployment ID in HANDOFF.md. Never deploy unrelated uncommitted app work.
