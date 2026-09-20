// Builds i18n-review.html: the checking page for the translation — every line, English next to 繁體中文, with a box for
// a correction or a note on each. It is published privately as a Claude Artifact (corrections are saved in the artifact's
// own database, which Claude reads back; `npm run i18n:import` then puts them into src/i18n/zh-Hant/*.json).
// Part of `npm run i18n:export`; on its own: node scripts/i18n-review-page.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const LIST = 'i18n-review.json', PAGE = 'i18n-review.html';
if (!existsSync(LIST)) { console.error(`${LIST} is missing: run "npm run i18n:export" first.`); process.exit(1); }

const rows = JSON.parse(readFileSync(LIST, 'utf8')).map(({ key, area, en, zh }) => ({ key, area, en, zh }));
const untidy = rows.filter((r) => r.zh !== r.zh.trim()).map((r) => r.key);
if (untidy.length) console.warn(`Chinese lines with spaces at an end (the page trims what is typed): ${untidy.join(', ')}`);

// Inside a <script> block: no "<" (so no "</script>", no "<!--"), and the two line separators JSON allows but scripts don't.
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029), BACK = String.fromCharCode(92);
const json = JSON.stringify(rows).split('<').join(BACK + 'u003c').split(LS).join(BACK + 'u2028').split(PS).join(BACK + 'u2029');
const template = readFileSync(new URL('./i18n-review-page.html', import.meta.url), 'utf8');
for (const mark of ['/*ROWS*/', '/*BUILT*/']) if (!template.includes(mark)) throw new Error(`the template has lost its ${mark} mark`);

const page = template.replace('/*ROWS*/', () => json).replace('/*BUILT*/', () => new Date().toISOString().slice(0, 10));
writeFileSync(PAGE, page);
console.log(`${PAGE}: ${rows.length} lines, ${Math.round(page.length / 1024)} KB`);
