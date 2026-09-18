// Wunder Tutor API proxy — Node adapter for local development (`npm run server`).
// All behaviour lives in ./core.mjs, which the Cloudflare Pages Function (functions/api/[[path]].js)
// runs too. The Vite dev server proxies /api/* to this process.
//
// Zero dependencies, Node 22+ (global fetch + WebSocket client). Keys are read from `.env` at the
// project root; key values are never logged.

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './core.mjs';

/** Minimal .env parser (KEY=VALUE, # comments, optional quotes). Real env vars win. */
function loadEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return false; // no .env — rely on the process environment
  }
  // Collect first so duplicates resolve sensibly: a later line wins, and an empty placeholder
  // (`KEY=` left over from .env.example) never shadows a filled-in value elsewhere in the file.
  const fromFile = new Map();
  for (const line of raw.replace(/^﻿/, '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim(); // strip trailing inline comment
    }
    if (value !== '' || !fromFile.has(key)) fromFile.set(key, value);
  }
  for (const [key, value] of fromFile) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFileLoaded = loadEnvFile(resolve(projectRoot, '.env'));

const PORT = Number.parseInt(process.env.PORT ?? '', 10) || 8787;
// Loopback by default: this process holds API keys and has no TLS. Set HOST=0.0.0.0 only behind a trusted proxy.
const HOST = (process.env.HOST ?? '').trim() || '127.0.0.1';

/** Accepted teacher takes live on disk so each phrase is generated (and paid for) once. */
const cacheDir = (process.env.TTS_CACHE_DIR ?? '').trim() || resolve(projectRoot, 'server', '.cache', 'tts');
const ttsCache = {
  get: (key) => readFile(join(cacheDir, `${key}.wav`)).catch(() => null),
  put: async (key, wav) => { await mkdir(cacheDir, { recursive: true }); await writeFile(join(cacheDir, `${key}.wav`), wav); },
};

const api = createApi(process.env, { ttsCache });

const server = http.createServer(async (req, res) => {
  try {
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
      method: req.method, headers, body: hasBody ? req : undefined, duplex: hasBody ? 'half' : undefined,
    });
    const response = await api.handle(request, { clientId: req.socket.remoteAddress ?? 'local' });
    const body = Buffer.from(await response.arrayBuffer());
    const out = Object.fromEntries(response.headers);
    out['content-length'] = String(body.length);
    res.writeHead(response.status, out);
    res.end(body);
  } catch (err) {
    console.error(`[server] adapter error: ${err?.name ?? 'Error'}`);
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"error":"internal_error"}');
  }
});

server.requestTimeout = 45_000;

server.on('error', (err) => {
  console.error(`[server] failed to start: ${err.code ?? err.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  // Only booleans and model names are logged — never key values.
  const s = api.status;
  console.log(`Wunder Tutor API proxy listening on http://${HOST}:${PORT}`);
  console.log(`  .env file: ${envFileLoaded ? 'loaded' : 'not found (using process environment)'}`);
  console.log(`  azure speech: ${s.azure ? 'configured' : 'NOT configured'}`);
  console.log(`  gemini live voice: ${s.gemini ? `configured (${s.ttsVersion})` : process.env.GEMINI_API_KEY ? 'key set, but this Node has no WebSocket client (need Node 22+)' : 'NOT configured'}`);
  console.log(`  claude: ${s.claude ? `configured (model ${s.claudeModel})` : 'NOT configured'}`);
  console.log(`  beta access code: ${s.needsCode ? 'required' : 'not set (open — fine on localhost)'}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
