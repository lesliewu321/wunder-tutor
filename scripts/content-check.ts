// The content linter: every course data file against its schema and through the loader — the same checks the app
// makes when it starts, run before a publish so a broken file is a message here and never a blank screen there.
//   npm run content:check            all of content/courses/*.json
//   npx vite-node scripts/content-check.ts content/courses/en.json
// Exit code 1 when anything is wrong. The schema check is a small validator of the JSON Schema features the schema
// uses (type, required, properties, additionalProperties, items, enum, const, pattern, minItems, maxItems,
// minLength, oneOf, $ref within the file): no dependency, and enough to say WHERE a file is wrong.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCourse, type CourseFile } from '../src/content/load';

type Schema = Record<string, unknown> & { $ref?: string };
const root = JSON.parse(readFileSync('content/schema/course.schema.json', 'utf8')) as Schema;

const deref = (s: Schema): Schema => (s.$ref ? deref(s.$ref.replace('#/', '').split('/').reduce<Schema>((o, k) => o[k] as Schema, root)) : s);

function validate(value: unknown, schema: Schema, path: string, out: string[]): void {
  const s = deref(schema);
  const type = s.type as string | undefined;
  const is = (t: string) => (t === 'array' ? Array.isArray(value) : t === 'integer' ? Number.isInteger(value) : t === 'object' ? typeof value === 'object' && value !== null && !Array.isArray(value) : typeof value === t);
  if (type && !is(type)) { out.push(`${path}: should be ${type}`); return; }
  if ('const' in s && value !== s.const) { out.push(`${path}: should be ${JSON.stringify(s.const)}`); return; }
  if (s.enum && !(s.enum as unknown[]).includes(value)) { out.push(`${path}: should be one of ${(s.enum as unknown[]).join(', ')}`); return; }
  if (typeof value === 'string') {
    if (s.pattern && !new RegExp(s.pattern as string).test(value)) out.push(`${path}: "${value}" does not match ${s.pattern}`);
    if (typeof s.minLength === 'number' && value.length < s.minLength) out.push(`${path}: is empty`);
  }
  if (Array.isArray(value)) {
    if (typeof s.minItems === 'number' && value.length < s.minItems) out.push(`${path}: needs at least ${s.minItems}`);
    if (typeof s.maxItems === 'number' && value.length > s.maxItems) out.push(`${path}: at most ${s.maxItems}`);
    if (s.items) value.forEach((v, i) => validate(v, s.items as Schema, `${path}[${i}]`, out));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const k of (s.required as string[] | undefined) ?? []) if (!(k in obj)) out.push(`${path}: missing ${k}`);
    const props = (s.properties as Record<string, Schema> | undefined) ?? {};
    for (const [k, v] of Object.entries(obj)) {
      if (props[k]) validate(v, props[k], `${path}.${k}`, out);
      else if (s.additionalProperties === false) out.push(`${path}: unknown field ${k}`);
      else if (s.additionalProperties && typeof s.additionalProperties === 'object') validate(v, s.additionalProperties as Schema, `${path}.${k}`, out);
    }
  }
  if (s.oneOf) {
    const tries = (s.oneOf as Schema[]).map((alt) => { const errs: string[] = []; validate(value, alt, path, errs); return errs; });
    if (!tries.some((e) => e.length === 0)) {
      // Say what the closest alternative complained about (the one with the fewest errors).
      const best = tries.reduce((a, b) => (b.length < a.length ? b : a));
      out.push(...best);
    }
  }
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : ['content/courses', 'astra-lessons/courses', 'content/seasonal'].flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'events.json').map((f) => join(dir, f)));
let bad = 0;
for (const file of files) {
  const errors: string[] = [];
  let data: unknown;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.log(`${file}: not JSON: ${(e as Error).message}`); bad++; continue; }
  validate(data, root, 'course', errors);
  if (errors.length) { console.log(`${file}: ${errors.length} schema problem${errors.length === 1 ? '' : 's'}`); for (const e of errors.slice(0, 40)) console.log(`  ${e}`); bad++; continue; }
  try {
    const built = buildCourse(data as CourseFile, file);
    const lessons = built.course.units.flatMap((u) => u.lessons);
    const exercises = lessons.reduce((n, l) => n + l.exercises.little.length + l.exercises.junior.length + l.exercises.teen.length, 0);
    const unused = built.items.filter((it) => !built.lessonItems.includes(it) && !Object.values(built.check).flat().includes(it) && !Object.values(built.ladders).flatMap((l) => Object.values(l).flat()).includes(it));
    console.log(`${file}: ok — ${built.items.length} items, ${built.course.units.length} units, ${lessons.length} lessons, ${exercises} exercises, ${Object.keys(built.ladders).length} ladders${unused.length ? `; ${unused.length} item${unused.length === 1 ? '' : 's'} no lesson, check or ladder uses: ${unused.map((it) => it.id).join(', ')}` : ''}`);
  } catch (e) { console.log(`${file}: ${(e as Error).message}`); bad++; }
}
process.exit(bad ? 1 : 0);
