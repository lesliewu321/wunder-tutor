# Wunder Tutor API

A runtime-neutral core (`server/core.mjs`) that keeps the Azure Speech, Gemini and Anthropic keys off the browser.
It runs as a zero-dependency Node 22+ server for local dev (`server/index.mjs`) and as a Cloudflare Pages Function
in production (`functions/api/[[path]].js`). It stores nothing and never logs keys, access codes, audio, transcripts
or request bodies.

## Configure and run
1. Copy `.env.example` to `.env` (git-ignored, project root). Fill in `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`
   (we use `eastasia`), `GEMINI_API_KEY`, optionally `ANTHROPIC_API_KEY`. Optional: `CLAUDE_MODEL`,
   `GEMINI_LIVE_MODEL`, `GEMINI_TTS_VOICE`, `PORT` (8787), `HOST` (127.0.0.1). Never prefix these with `VITE_`.
   Real environment variables override `.env`. Leave `AZURE_SPEECH_ENDPOINT` unset — the portal's
   `*.api.cognitive.microsoft.com` URL is the wrong host for speech-to-text; the region alone works.
2. `npm run server`, then `npm run dev` in another terminal; Vite proxies `/api/*` to port 8787.
3. Check with `curl http://localhost:8787/api/health`. A missing key only disables its endpoint (503), so the app
   falls back to its built-in practice mode.

Hosted: secrets are Cloudflare Pages secrets (`npx wrangler pages secret put NAME`), applied on the next deploy.
When `BETA_ACCESS_CODE` is set, every endpoint except `/api/health` requires it in the `x-wunder-access` header; a
public deployment with no code set fails closed.

## Endpoints (JSON responses; request bodies over 5 MB get 413 `payload_too_large`)

- `GET /api/health` → `{ ok, azure, claude, gemini, ttsVersion, needsCode, authorized }`.
- `POST /api/assess?text=<reference>&locale=en-US|en-GB|zh-CN[&nbest=1..10][&alts=<JSON>][&dual=1]`, raw body = WAV
  (16 kHz mono 16-bit PCM, max 30 s). Azure short-audio pronunciation assessment (HundredMark, phoneme granularity,
  miscue, prosody). `text` ≤ 500 chars; Mandarin text must be **Simplified** (Traditional scores badly).
  - `nbest` (en-US only): adds Azure's "what was heard" candidates per phoneme; IPA phoneme names are en-US only.
  - `alts=["Fank you!", …]`: the same audio is also scored against up to 5 likely-mistake texts, each the reference
    with exactly one word (or one Chinese character) changed — anything else is 400 `invalid_alts`.
  - `dual=1` (en-GB only): the same audio is also scored as en-US.
  - Without `alts`/`dual` the response is Azure's JSON unchanged; with either it is `{ main, us?, alts? }` (a failed
    extra scoring is `null`; the main score still stands). Azure sometimes answers `Success` with no scores — the
    server retries that once when the retry can still finish inside the app's 20-second wait.
  - Each extra scoring is billed as the full audio again (see *Cost* below).
  - Errors: 400 `missing_text|text_too_long|unsupported_locale|missing_audio|invalid_alts`, 503
    `azure_not_configured`, 502 `{error:"azure_upstream",status}`, 504 `azure_timeout` (15 s).
- `POST /api/tts` with `{ text, locale?: "en-US"|"en-GB"|"zh-CN", accent?, slow?, kind?, ephemeral? }` → `audio/wav` (24 kHz mono,
  silence-trimmed), header `X-Tts-Cache: hit|miss`. One Gemini Live session per uncached phrase with a strict "say
  exactly this" instruction; the model's own transcript must match the text (Chinese: character overlap, no Latin
  words), one firmer retry, else `502 tts_mismatch` and the app uses the device voice. New **Mandarin** takes must also
  score as the text on Azure (≥ 85 overall, every syllable ≥ 70) before they are cached — a scorer outage skips that
  check rather than silencing the teacher. Errors: 400 `missing_text|text_too_long|invalid_text`, 429
  `tts_budget_exceeded` (120 generations / 10 min), 502 `gemini_rejected|gemini_closed|gemini_no_audio`, 503
  `gemini_not_configured`, 504 `gemini_timeout`. `ephemeral: true` (a learner's own "Say it right" sentence) is
  spoken but never stored in the shared cache, and is capped at 40 requests / 10 min per client (429 `rate_limited`).
  Only text goes to Google; never learner audio.
- `POST /api/read`: "Say it right". Body = a photo (`image/jpeg|png|webp`, the app sends a ≤1600 px JPEG) or JSON
  `{ "text": "…" }` (≤ 2000 chars) → `{ language: "en"|"zh"|"other"|"none", lines: [{ text, lang: "en"|"zh"|"other",
  traditional?, simplified?, pinyin? }] }`. Every sentence has its own language, so a bilingual page (a Hong Kong menu or
  sign) keeps both; the page `language` follows from its sentences ("other" = nothing in English or Chinese). Typed line
  breaks are kept. Gemini (`GEMINI_READ_MODEL`, default `gemini-3.8-flash`) works in two steps with strict JSON
  schemas: first the sentences and their languages, then the Chinese ones character by character ({t, s, py}) in up to
  6 requests side by side (~45 characters each; a Worker opens 6 connections at a time). A sentence keeps its pinyin
  only if the entries spell it as written (numbers are written out: 3 → 三); failing sentences get one more try while
  there is time. Known model slips are mended (得 "de3" → dei3). 30 requests / 10 min per client. Errors: 400
  `missing_text|text_too_long|missing_image`, 503 `gemini_not_configured`, 502 `read_upstream` (with Gemini's
  `status`) `|read_unparseable` (with `finish`, e.g. MAX_TOKENS), 504 `read_timeout` (40 s for the whole read). Each
  failure is logged as `[read] <code> after N s, photo N KB` (never the content) — see it live with
  `npx wrangler pages deployment tail --project-name wunder-tutor`. The app shows the code in brackets. The image or
  text goes to Google; Wunder Tutor stores neither.
- `POST /api/tutor` with `{ scenario:{title,setting,tutorRole,goals[]}, band, history:[{role:"tutor"|"child",text}], pronunciationNotes? }`
  → `{ reply, suggestions (0-2 strings), done }`. Child-safety rules live in the system prompt; emojis are stripped;
  `done` is forced after 8 child turns. Errors: 400 `invalid_json|invalid_scenario|invalid_band|invalid_history`,
  503 `claude_not_configured`, 502 `{error:"claude_upstream",status}`, 504 `claude_timeout` (20 s).

Per-client rate limits: assess 400 billed scorings / 5 min (a take with likely-mistake checks counts each scoring),
tts 120 / 5 min, tutor 40 / 5 min, access-code guesses 12 / 10 min.

## Verified live (eastasia, 2026-09)

- Regional host `{region}.stt.speech.microsoft.com`; scores sit flat on `NBest[0]`.
- **en-US**: IPA phoneme names, syllables, prosody, `NBestPhonemes`. **en-GB**: phoneme scores but no names, no
  `NBestPhonemes`, harsh single-word scores. **zh-CN**: one unit per character, labelled with pinyin + tone number
  (`shui 3`), with Offset/Duration; no prosody.
- Gemini Live teacher voice from Node and from the Workers runtime (fetch-upgrade WebSocket).
- Not yet run live: the Claude tutor (no Anthropic key set).

## Cost

Azure bills audio time: about US$1.00/h speech-to-text + $0.30/h pronunciation assessment (eastasia, pay-as-you-go).
Because of the accuracy checks, one learner take is scored 1–6 times (US: main + up to 3 likely mistakes; British:
main + US + up to 3; Mandarin: main + up to 5). Two things keep that down (2026-09-19):
- The app trims the pauses around the speech before sending (`speechWindow`, generous margins): ~42% less audio on
  every scoring; no scored word was ever cut in 2,541 test takes, quiet or noisy.
- Phrases and sentences are checked on each word's own clip (a second, parallel round): the checks cost ~35% less and
  are more accurate (Mandarin sound slips named 27% → 58%, British swaps 0% → 88%).
Together roughly half the earlier cost: ~US$3.5–4 a month for a learner doing 50 takes a day (pay-as-you-go).
