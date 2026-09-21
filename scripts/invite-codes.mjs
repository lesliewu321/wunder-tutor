#!/usr/bin/env node
// Make and manage invite codes. Each code lets 10 families in, until 14 days from today.
//
//   npm run codes:new                       5 new codes
//   npm run codes:new -- 12                 12 new codes
//   npm run codes:new -- 5 "St Paul's WhatsApp"   with a note to yourself about who got them
//   npm run codes:list                      every code: places taken, days left, your note
//   npm run codes:off -- WUNDER-7K2MP       switch a code off — for a code that leaked; see below
//
// Uses SUPABASE_SECRET_KEY from .env and never prints it. The places and the date are enforced by the database
// itself (redeem_invite, supabase/migrations/20260921100000_invites_and_contributions.sql), not by this script.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLACES = 10;
const DAYS = 14;
const SUPABASE_URL = 'https://xzghsihffoliduqkjvck.supabase.co'; // public (also in wrangler.toml)
// No 0/O, 1/I/L: a code gets read out on the phone and typed from a photo of a WhatsApp message.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Same rules as server/index.mjs: a later line wins, and an empty `KEY=` never shadows a filled-in one. */
function readEnv(path) {
  const out = new Map();
  for (const line of readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(t);
    if (!m) continue;
    let v = m[2].trim();
    const q = v[0];
    v = (q === '"' || q === "'") && v.endsWith(q) && v.length >= 2 ? v.slice(1, -1) : v.replace(/\s+#.*$/, '').trim();
    if (v !== '' || !out.has(m[1])) out.set(m[1], v);
  }
  return out;
}

let key = '';
try { key = readEnv(join(root, '.env')).get('SUPABASE_SECRET_KEY') ?? ''; } catch { /* no .env */ }
if (!key) {
  console.error('SUPABASE_SECRET_KEY is not in .env, so codes cannot be made from here.');
  process.exit(1);
}
const auth = { apikey: key, ...(key.startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }) };
const rest = async (path, init = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...auth, 'Content-Type': 'application/json', ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
};

const newCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `WUNDER-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`;
};
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const [command = 'list', ...args] = process.argv.slice(2);

if (command === 'new') {
  const count = Math.max(1, Math.min(100, Number.parseInt(args[0] ?? '5', 10) || 5));
  const note = args.slice(1).join(' ').slice(0, 200) || null;
  const expires = new Date(Date.now() + DAYS * 86_400_000).toISOString();
  const rows = [...new Set(Array.from({ length: count }, newCode))].map((code) => ({ code, places: PLACES, expires_at: expires, note }));
  await rest('invite_codes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
  console.log(`${rows.length} new codes — each lets ${PLACES} families in, until ${day(expires)}${note ? ` (${note})` : ''}:\n`);
  for (const r of rows) console.log(`  ${r.code}`);
  console.log('\nThey go in Parent Zone → Invite code. `npm run codes:list` shows how they are being used.');
} else if (command === 'list') {
  const codes = await rest('invite_codes?select=code,places,expires_at,note,disabled,created_at&order=created_at.desc');
  const taken = await rest('invite_redemptions?select=code');
  const used = new Map();
  for (const r of taken) used.set(r.code, (used.get(r.code) ?? 0) + 1);
  if (!codes.length) { console.log('No invite codes yet. Make some with: npm run codes:new'); process.exit(0); }
  console.log('code            places   closes        note');
  for (const c of codes) {
    const left = Math.ceil((Date.parse(c.expires_at) - Date.now()) / 86_400_000);
    const state = c.disabled ? 'switched off' : left <= 0 ? 'closed' : `${left} day${left === 1 ? '' : 's'} left`;
    console.log(`${c.code.padEnd(15)} ${`${used.get(c.code) ?? 0}/${c.places}`.padEnd(8)} ${state.padEnd(13)} ${c.note ?? ''}`);
  }
} else if (command === 'off') {
  const code = String(args[0] ?? '').toUpperCase().trim();
  if (!code) { console.error('Which code? npm run codes:off -- WUNDER-XXXXX'); process.exit(1); }
  const changed = await rest(`invite_codes?code=eq.${encodeURIComponent(code)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ disabled: true }) });
  // A switch-off is a kill switch, not a "stop joining": every device using this code loses access within a minute
  // (the API remembers a code for a minute). A code that has simply filled up or passed its date needs no switching off.
  console.log(changed?.length
    ? `${code} is switched off. Everyone using it loses access within a minute — give the families who should stay a new code.`
    : `No code called ${code}.`);
} else {
  console.error('Use: npm run codes:new [-- count "note"] | codes:list | codes:off -- CODE');
  process.exit(1);
}
