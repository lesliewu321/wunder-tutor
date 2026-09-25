// npm run i18n:check [-- <lang> [interface|content|lessons]] — checks a translation of the App language against the
// English source (i18n-source.json, written by `npm run i18n:export`): the same keys, every {placeholder} and **bold**
// mark kept, nothing empty. Chinese (zh-Hant) keeps its lesson wording in the course data, so it has no lessons.json.
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const [lang, only] = process.argv.slice(2);
const langs = lang ? [lang] : readdirSync('src/i18n', { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'en').map((d) => d.name);
if (!existsSync('i18n-source.json')) { console.error('i18n-source.json is missing: run `npm run i18n:export` first.'); process.exit(1); }
const source = JSON.parse(readFileSync('i18n-source.json', 'utf8'));
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
const bolds = (s) => (s.match(/\*\*/g) ?? []).length;
/** Languages without a singular form of their own: a count reads its "other" line for one as well. */
const NO_ONE = new Set(['zh-Hant', 'zh-Hans', 'ja', 'ko']);
const INTERFACE_FILES = readdirSync('src/i18n/en').filter((f) => f.endsWith('.json'));

let problems = 0;
const say = (l, part, msg, keys) => { if (!keys.length) return; problems += keys.length; console.log(`${l} ${part}: ${msg} (${keys.length}): ${keys.slice(0, 12).join(' | ')}${keys.length > 12 ? ' …' : ''}`); };

function compare(l, part, en, tr, { optionalOne = false } = {}) {
  const need = Object.keys(en).filter((k) => !(optionalOne && k.endsWith('.one')));
  say(l, part, 'missing', need.filter((k) => tr[k] == null));
  say(l, part, 'not in the English', Object.keys(tr).filter((k) => !(k in en)));
  say(l, part, 'empty', Object.entries(tr).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k));
  say(l, part, 'placeholders differ', Object.keys(tr).filter((k) => k in en && typeof tr[k] === 'string' && en[k] && holes(tr[k]) !== holes(en[k])));
  say(l, part, 'bold marks differ', Object.keys(tr).filter((k) => k in en && typeof tr[k] === 'string' && en[k] && (bolds(tr[k]) !== bolds(en[k]) || bolds(tr[k]) % 2)));
}

for (const l of langs) {
  if (!only || only === 'interface') {
    for (const f of INTERFACE_FILES) {
      const file = `src/i18n/${l}/${f}`;
      if (!existsSync(file)) { say(l, f, 'file missing', [file]); continue; }
      try { compare(l, f, read(`src/i18n/en/${f}`), read(file), { optionalOne: NO_ONE.has(l) }); } catch (e) { say(l, f, 'not valid JSON', [String(e.message)]); }
    }
  }
  if ((!only || only === 'content') && l !== 'zh-Hant') {
    const file = `src/i18n/${l}/content.json`;
    if (!existsSync(file)) say(l, 'content.json', 'file missing', [file]);
    else try { compare(l, 'content.json', source.content, read(file)); } catch (e) { say(l, 'content.json', 'not valid JSON', [String(e.message)]); }
  }
  if ((!only || only === 'lessons') && l !== 'zh-Hant') {
    const file = `src/i18n/${l}/lessons.json`;
    const en = Object.fromEntries(Object.keys(source.lessons).map((k) => [k, k]));
    if (!existsSync(file)) say(l, 'lessons.json', 'file missing', [file]);
    else try { compare(l, 'lessons.json', en, read(file)); } catch (e) { say(l, 'lessons.json', 'not valid JSON', [String(e.message)]); }
  }
}
console.log(problems ? `${problems} problem(s).` : `OK: ${langs.join(', ')}${only ? ` (${only})` : ''}.`);
process.exit(problems ? 1 : 0);
