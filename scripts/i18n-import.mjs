// npm run i18n:import -- <corrections> [--dry] [--force]
// Puts a checker's corrections into src/i18n/zh-Hant/*.json. <corrections> is any of:
//   * the text copied from the checking page ("Hand my changes over another way"): { corrections: [{ key, zh, was, note }] }
//   * a plain list: [{ key, zh }]
//   * a folder of documents saved from the page's database (one JSON file per corrected line)
//   * i18n-review.csv with its "correction" column filled in
// Each corrected line is checked before anything is written: the key exists, the {placeholders} and ** pairs of the
// line are all still there, no long dash (the headline font draws —— as 一一), not empty. `was` is the Chinese the
// checker was looking at: if the app's line has changed since, the correction is held back (--force applies it anyway).
// Only the corrected lines are rewritten, in place, so the files keep their order and their blank lines.
// Afterwards: npx vitest run, then npm run i18n:export and republish the page (its lines then say "In the app now").
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/i18n/zh-Hant';
const args = process.argv.slice(2), flags = new Set(args.filter((a) => a.startsWith('--'))), source = args.find((a) => !a.startsWith('--'));
if (!source || !existsSync(source)) { console.error('Usage: npm run i18n:import -- <corrections.json | folder | i18n-review.csv> [--dry] [--force]'); process.exit(1); }

/** A CSV as Excel and Google Sheets write it: quoted cells, "" for a quote, line breaks allowed inside quotes. */
const parseCsv = (text) => {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i += 1; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
};
/** A file's text without the mark Excel puts at the very start (code 0xFEFF). */
const readText = (file) => { const text = readFileSync(file, 'utf8'); return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; };
const readJson = (file) => JSON.parse(readText(file));
const filesUnder = (dir) => readdirSync(dir).flatMap((name) => { const p = join(dir, name); return statSync(p).isDirectory() ? filesUnder(p) : p.endsWith('.json') ? [p] : []; });

function corrections() {
  if (statSync(source).isDirectory()) return filesUnder(source).map(readJson).map((doc) => doc.data ?? doc.fields ?? doc);
  if (source.toLowerCase().endsWith('.csv')) {
    const [head, ...rows] = parseCsv(readText(source));
    const at = (name) => head.findIndex((h) => h.trim().toLowerCase() === name);
    const key = at('key'), zh = at('correction'), was = at('繁體中文'), note = at('comment');
    if (key < 0 || zh < 0) throw new Error('the CSV needs its "key" and "correction" columns');
    return rows.filter((r) => (r[zh] ?? '').trim() || (r[note] ?? '').trim()).map((r) => ({ key: r[key], zh: (r[zh] ?? '').trim() || r[was], was: r[was], note: r[note] }));
  }
  const data = readJson(source);
  return Array.isArray(data) ? data : data.corrections ?? [];
}

const catalogs = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((name) => { const path = join(DIR, name), text = readFileSync(path, 'utf8'); return { name, path, text, lines: JSON.parse(text) }; });
const holds = (key) => catalogs.find((c) => Object.hasOwn(c.lines, key));
const bits = (s, re) => (s.match(re) ?? []).slice().sort().join(' ');

const problems = (now, zh) => [
  !zh.trim() && 'empty',
  bits(now, /\{\w+\}/g) !== bits(zh, /\{\w+\}/g) && `placeholders differ: the line has ${bits(now, /\{\w+\}/g) || 'none'}, the correction has ${bits(zh, /\{\w+\}/g) || 'none'}`,
  (zh.match(/\*\*/g) ?? []).length !== (now.match(/\*\*/g) ?? []).length && 'the ** pairs differ',
  zh.includes('—') && 'a long dash (—), which the headline font draws as 一',
].filter(Boolean);

const done = [], held = [], notes = [];
for (const fix of corrections()) {
  const key = typeof fix?.key === 'string' ? fix.key : '', zh = typeof fix?.zh === 'string' ? fix.zh.replace(/\r\n?/g, '\n').trim() : '';
  const catalog = key && holds(key);
  if (fix?.note) notes.push(`${key}: ${fix.note}`);
  if (!catalog) { held.push(`${key || '(no key)'}: not a line of the Chinese catalogs`); continue; }
  const now = catalog.lines[key];
  if (zh === now || (!zh && fix?.note)) continue;                                   // already in, or a note with no change
  const wrong = problems(now, zh);
  if (wrong.length) { held.push(`${key}: ${wrong.join('; ')}`); continue; }
  if (typeof fix.was === 'string' && fix.was && fix.was !== now && !flags.has('--force')) { held.push(`${key}: the app's line changed after it was checked (checked 「${fix.was}」, now 「${now}」); --force applies it anyway`); continue; }
  // Rewrite that one line where it stands.
  const start = `${JSON.stringify(key)}:`, rows = catalog.text.split('\n');
  const at = rows.findIndex((line) => line.trimStart().startsWith(start));
  if (at < 0) { held.push(`${key}: its line could not be found in ${catalog.name}`); continue; }
  rows[at] = `${rows[at].slice(0, rows[at].length - rows[at].trimStart().length)}${start} ${JSON.stringify(zh)}${rows[at].trimEnd().endsWith(',') ? ',' : ''}`;
  const text = rows.join('\n'), after = JSON.parse(text);
  if (after[key] !== zh || Object.keys(after).length !== Object.keys(catalog.lines).length) { held.push(`${key}: rewriting ${catalog.name} went wrong, nothing changed`); continue; }
  done.push(`${catalog.name}  ${key}\n    - ${now}\n    + ${zh}`);
  Object.assign(catalog, { text, lines: after, touched: true });
}

if (!flags.has('--dry')) for (const c of catalogs) if (c.touched) writeFileSync(c.path, c.text);
console.log(`${flags.has('--dry') ? 'Would change' : 'Changed'} ${done.length} line${done.length === 1 ? '' : 's'}${done.length ? ':\n' + done.join('\n') : '.'}`);
if (held.length) console.log(`\nHeld back (${held.length}):\n  ${held.join('\n  ')}`);
if (notes.length) console.log(`\nNotes from the checker (${notes.length}):\n  ${notes.join('\n  ')}`);
if (done.length && !flags.has('--dry')) console.log('\nNext: npx vitest run, then npm run i18n:export and republish the checking page.');
process.exit(held.length ? 2 : 0);
