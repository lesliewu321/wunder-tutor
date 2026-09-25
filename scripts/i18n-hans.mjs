// npm run i18n:hans — writes the 简体中文 App language (src/i18n/zh-Hans/) from the 繁體中文 one (Leslie, 2026-09-25: "app
// language should include traditional and simplified chinese"). The Traditional text is Hong Kong written Chinese, so
// besides the character conversion (OpenCC, hk → cn) a few Hong Kong words become the mainland ones (設定 → 设置,
// 電郵 → 邮箱 …). Run it again whenever the Traditional wording changes; never edit zh-Hans by hand.
// Needs i18n-source.json for the lesson guides (`npm run i18n:export` first).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { toSimplified as hans } from './i18n-hans-lib.mjs';

const convert = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? hans(v) : v]));
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const write = (f, obj) => writeFileSync(f, `${JSON.stringify(obj, null, 2)}\n`);

mkdirSync('src/i18n/zh-Hans', { recursive: true });
// The interface, file by file.
for (const f of readdirSync('src/i18n/zh-Hant').filter((f) => f.endsWith('.json') && !f.startsWith('content') && f !== 'meanings.json')) write(`src/i18n/zh-Hans/${f}`, convert(read(`src/i18n/zh-Hant/${f}`)));
// Wording that lives with data: the three Traditional sources in one file.
write('src/i18n/zh-Hans/content.json', convert({ ...read('src/i18n/zh-Hant/content.json'), ...read('src/i18n/zh-Hant/content-course.json'), ...read('astra-lessons/i18n/zh-Hant.json') }));
// Lesson guides and reading questions: keyed by their English, the Traditional comes from the course data.
if (!existsSync('i18n-source.json')) { console.error('i18n-source.json is missing: run `npm run i18n:export` first.'); process.exit(1); }
const cantonese = read('astra-lessons/i18n/cantonese.json')['zh-Hant'].lessons;
write('src/i18n/zh-Hans/lessons.json', Object.fromEntries(Object.entries(read('i18n-source.json').lessons).map(([key, value]) => [key, hans(value, { preserveQuotes: key in cantonese })])));
// What practice items mean.
if (existsSync('src/i18n/zh-Hant/meanings.json')) write('src/i18n/zh-Hans/meanings.json', convert(read('src/i18n/zh-Hant/meanings.json')));
// This is a practice-script example, not translated interface prose.
const setup = read('src/i18n/zh-Hans/onboarding.json');
setup['onboarding.script.hant.detail'] = setup['onboarding.script.hant.detail'].replace('苹果', '蘋果');
write('src/i18n/zh-Hans/onboarding.json', setup);
console.log('zh-Hans written from zh-Hant.');
