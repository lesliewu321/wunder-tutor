// Capture actual localhost screens in a fresh browser profile. No account, photos or recordings are used.
// PLAYWRIGHT_MODULE can point to a local Playwright package when it is not installed in this project.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sharp = require('sharp');
const base = process.env.APP_CAPTURE_URL || 'http://localhost:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Capture must use a local app server.');
const output = fileURLToPath(new URL('../public/screenshots/', import.meta.url));
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const captures = [];
async function navigate(path) {
  await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path);
}
async function capture(id, path, selector, prepare) {
  await navigate(path);
  await page.locator(selector).first().waitFor();
  if (prepare) await prepare();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const buffer = await page.screenshot();
  await sharp(buffer).webp({ quality: 88 }).toFile(`${output}/${id}.webp`);
  await sharp(buffer).resize({ width: 390 }).webp({ quality: 86 }).toFile(`${output}/${id}-390.webp`);
  captures.push({ id, route: path, width: 780, height: 1688 });
  console.log(`Captured ${id}`);
}
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__store);
  await page.evaluate(() => {
    const state = window.__store.getState();
    state.createProfile({ name: 'Alex', age: 10, avatar: '🦊', homeLanguage: 'en', accent: 'en-US', level: 'new', goal: 'everyday', learning: ['en', 'zh', 'yue', 'ja', 'ko', 'fr', 'es'] });
    state.setSettings({ language: 'en', storeRecordings: false, contributeRecordings: false, shareScores: false, theme: 'light' });
    state.setCourse('en');
  });
  await capture('learn', '/', '.home .path');
  const lessonId = await page.evaluate(async () => (await import('/src/content/course.ts')).lessonsOf('en', 'junior')[0].id);
  await capture('english-lesson', `/lesson/${lessonId}`, '.lesson-guide', async () => {
    await page.getByRole('button', { name: 'Start lesson', exact: true }).click();
    await page.locator('.prompt').waitFor();
  });
  await capture('lab', '/lab', '.sound-list');
  await capture('conversations', '/speak', '.scenario-list');
  await capture('notebook', '/book', '.book__start', async () => {
    await page.locator('.book__type').first().click();
    await page.locator('#say-text').fill('The little fox sits under a tree. Three green leaves fall to the ground.');
    await page.locator('.type-sheet button').last().click();
    await page.locator('.book__page').waitFor();
  });
  await page.evaluate(() => window.__store.getState().setCourse('yue'));
  await capture('cantonese-lesson', '/lesson/yue-greetings-2', '.lesson-guide', async () => {
    await page.getByRole('button', { name: 'Start lesson', exact: true }).click();
    await page.locator('.prompt .yue-text').first().waitFor();
  });
  await capture('cantonese-tones', '/lab/yue%3Atones', '[data-cantonese-tones]');
  await capture('reminders', '/notifications', '.screen');
  if (errors.length) throw new Error(errors.join('\n'));
  await fs.writeFile(`${output}/manifest.json`, JSON.stringify({ capturedAt: new Date().toISOString(), source: base, appCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), profile: 'Fictional local learner; no scores or recordings seeded. Notebook contains original typed sample text.', captures }, null, 2) + '\n');
} finally {
  await browser.close();
}
