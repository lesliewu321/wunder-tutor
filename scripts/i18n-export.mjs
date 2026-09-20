// npm run i18n:export — writes i18n-review.json / .csv (every line of wording, English next to 繁體中文) and i18n-review.html.
// The work is done by scripts/i18n-export.test.ts, run through vitest because it needs the app's TypeScript modules
// (plain vite-node hangs on this machine). The flag keeps it out of the normal `npm test`.
import { spawnSync } from 'node:child_process';

const run = spawnSync('npx vitest run scripts/i18n-export.test.ts', { stdio: 'inherit', shell: true, env: { ...process.env, I18N_EXPORT: '1' } });
if (run.status !== 0) process.exit(run.status ?? 1);
await import('./i18n-review-page.mjs'); // the same list as a page to check it on
