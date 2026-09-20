// npm run build:app — builds the web app for the PHONE APPS (Capacitor), then copies it into the native projects.
//
// The only difference from the website build: the API's real address is baked in (src/platform.ts explains why), so
// that calls made from inside the app's WebView, where the page's own address is localhost, still reach the API.
// Point it elsewhere for a test build:  WT_API_BASE=https://staging.example npm run build:app
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const API_BASE = process.env.WT_API_BASE || 'https://app.wundertutor.com';
const run = (command) => {
  const done = spawnSync(command, { stdio: 'inherit', shell: true, env: { ...process.env, WT_API_BASE: API_BASE } });
  if (done.status !== 0) process.exit(done.status ?? 1);
};

console.log(`Building the phone app's files. The API it will call: ${API_BASE}\n`);
run('npm run build');
// `cap sync` also refreshes the native plugins; it needs the platform to have been added first (npx cap add android).
if (existsSync('android') || existsSync('ios')) run('npx cap sync');
else console.log('\nNo phone project yet (android/ or ios/). Files built; add a platform with: npx cap add android');
