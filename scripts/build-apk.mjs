#!/usr/bin/env node
// Build the Android app into an .apk file — the file you copy to a phone and tap to install.
//
//   npm run app:apk        build the web files, then the app   (this script does the second half)
//   node scripts/build-apk.mjs
//
// Android Studio is not needed. What IS needed, once per machine: a Java 21 runtime, and Google's Android SDK with
// the platform and build tools for the API level in android/variables.gradle. This script finds both, says plainly
// which one is missing if it cannot, and writes android/local.properties (the SDK's whereabouts, one machine's own
// business — gitignored) so that Android Studio would find it too.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
const windows = process.platform === 'win32';

/** Somewhere that looks like an Android SDK: it has the tools a build actually reaches for. */
const looksLikeSdk = (dir) => Boolean(dir) && existsSync(join(dir, 'platforms')) && existsSync(join(dir, 'build-tools'));

function findSdk() {
  const guesses = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    // Where a local.properties from an earlier build already points.
    readSdkFromLocalProperties(),
    windows ? 'C:\\Android\\sdk' : null,
    windows ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk') : null,
    process.platform === 'darwin' ? join(homedir(), 'Library', 'Android', 'sdk') : null,
    join(homedir(), 'Android', 'Sdk'),
  ];
  return guesses.find(looksLikeSdk) || null;
}

function readSdkFromLocalProperties() {
  const file = join(android, 'local.properties');
  if (!existsSync(file)) return null;
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.trim().startsWith('sdk.dir='));
  // Java properties escape the ':' and the '\' of a Windows path: C\:\\Android\\sdk
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/\\(.)/g, '$1') : null;
}

/** local.properties, written the way Java reads it back: every ':' and '\' escaped. */
function writeLocalProperties(sdk) {
  const escaped = sdk.replace(/([\\:])/g, '\\$1');
  writeFileSync(
    join(android, 'local.properties'),
    `## This file is generated and must *not* go into git (android/.gitignore) — it is one machine's own SDK path.\nsdk.dir=${escaped}\n`,
  );
}

const sdk = findSdk();
if (!sdk) {
  console.error(
    [
      'No Android SDK found.',
      '',
      'Install one without Android Studio: download "command line tools only" from',
      'https://developer.android.com/studio, unzip it so that the tools sit in',
      '  <sdk>/cmdline-tools/latest/bin,',
      'then from that bin folder run:',
      '  sdkmanager "platform-tools" "platforms/android-36" "build-tools/36.0.0"',
      '',
      'Then either set ANDROID_HOME to <sdk>, or put it in android/local.properties as sdk.dir.',
    ].join('\n'),
  );
  process.exit(1);
}
writeLocalProperties(sdk);

if (!process.env.JAVA_HOME) {
  const java = spawnSync(windows ? 'where' : 'which', ['java'], { encoding: 'utf8' });
  if (java.status !== 0) {
    console.error('No Java found. Android needs a Java 21 runtime (a JDK, not just a browser plug-in):\n  https://adoptium.net');
    process.exit(1);
  }
}

console.log(`Android SDK: ${sdk}`);
console.log('Building the app. The first time on a machine this fetches Gradle and the Android plugin (a few minutes).\n');

// Gradle's own launcher. On Windows it is a .bat, which Node will only start through cmd — named here rather than
// with `shell: true`, so nothing in a path has to be escaped.
const gradlew = join(android, windows ? 'gradlew.bat' : 'gradlew');
const [command, args] = windows
  ? ['cmd.exe', ['/c', gradlew, '-p', android, 'assembleDebug']]
  : [gradlew, ['-p', android, 'assembleDebug']];
const build = spawnSync(command, args, {
  stdio: 'inherit',
  env: { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const apk = join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(apk)) {
  console.error(`\nGradle finished but there is no file at ${apk}.`);
  process.exit(1);
}
console.log(
  [
    '',
    `Built: ${apk}`,
    `       ${(statSync(apk).size / 1e6).toFixed(1)} MB`,
    '',
    'To put it on a phone: copy the file across (cable, or send it to yourself), tap it, and allow the phone to',
    'install apps from wherever you copied it. It is a TEST build, signed with a throwaway key — fine for a phone',
    'you own, and not the file that would go to Google Play.',
  ].join('\n'),
);
