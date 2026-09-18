# Wunder Tutor API proxy

Zero-dependency Node 20+ server (`server/index.mjs`) that keeps the Azure Speech and
Anthropic keys off the browser. It stores nothing and never logs keys, audio or transcripts.

## Configure and run
1. Copy `.env.example` to `.env` (git-ignored, project root). Fill in `AZURE_SPEECH_KEY`,
   `AZURE_SPEECH_REGION` (e.g. `westeurope`), `ANTHROPIC_API_KEY`. Optional: `CLAUDE_MODEL`
   (default `claude-sonnet-5`), `PORT` (8787), `HOST` (127.0.0.1), `AZURE_SPEECH_ENDPOINT`.
   Never prefix these with `VITE_`. Real environment variables override `.env`.
2. `npm run server`, then `npm run dev` in another terminal; Vite proxies `/api/*` to port 8787.
3. Check with `curl http://localhost:8787/api/health`. A missing key only disables its endpoint
   (503), so the app can fall back to its offline/mock provider.

## Endpoints (JSON responses; request bodies over 5 MB get 413 `payload_too_large`)
- `GET /api/health` -> `{ ok: true, azure: boolean, claude: boolean }` (keys configured?).
- `POST /api/assess?text=<reference>&locale=en-US|en-GB[&nbest=1..10]`, raw body = WAV
  (16 kHz mono 16-bit PCM, max 30 s). Forwards to Azure short-audio pronunciation assessment
  (HundredMark, phoneme granularity, miscue + prosody, IPA) and returns Azure's JSON unchanged:
  scores sit on `NBest[0]` (`PronScore`, `AccuracyScore`, `FluencyScore`, `CompletenessScore`,
  `ProsodyScore`, `Words[]`). `RecognitionStatus` may be `NoMatch` / `InitialSilenceTimeout`
  with HTTP 200. `nbest` adds `NBestPhonemeCount` (for "heard as"). Errors: 400
  `missing_text|text_too_long|unsupported_locale|missing_audio`, 503 `azure_not_configured`,
  502 `{error:"azure_upstream",status}`, 504 `azure_timeout` (15 s).
- `POST /api/tutor` with `{ scenario:{title,setting,tutorRole,goals[]}, band, history:[{role:"tutor"|"child",text}], pronunciationNotes? }`
  -> `{ reply, suggestions (0-2 strings), done }`. Child-safety rules live in the system prompt;
  emojis are stripped; `done` is forced after 8 child turns; empty `history` yields the opening
  line. Errors: 400 `invalid_json|invalid_scenario|invalid_band|invalid_history`,
  503 `claude_not_configured`, 502 `{error:"claude_upstream",status}`, 504 `claude_timeout` (20 s).

## Not yet verified against live Azure / Anthropic
Tested locally: startup, health, validation, 413/503/502/404/405. No real keys were available, so
no successful upstream round trip has been seen.
- Azure: header/query format was checked against Microsoft's current REST docs, but they now show
  `https://<resource>.cognitiveservices.azure.com/stt/...` rather than the default regional host
  `{region}.stt.speech.microsoft.com` (set `AZURE_SPEECH_ENDPOINT` to `https://<resource>.cognitiveservices.azure.com/stt` if it fails).
  `PhonemeAlphabet` / `NBestPhonemeCount` are documented for the SDK only, so IPA output and the
  `Phonemes` / `Syllables` shape inside `Words[]` are unconfirmed over REST.
- Anthropic: structured-output JSON (`output_config.format`) and `thinking: disabled` on the chosen
  model are unconfirmed; a 400 triggers one retry without them.

## Teacher voice — `POST /api/tts` (Gemini Live, native audio)

Set `GEMINI_API_KEY` (optional: `GEMINI_LIVE_MODEL`, `GEMINI_TTS_VOICE`, `TTS_CACHE_DIR`). Needs Node 22+ (built-in WebSocket client).

- Body: `{ "text": "three red apples", "accent": "en-US" | "en-GB", "slow": false, "kind": "syllable"? }` — text ≤ 200 chars.
- 200 → `audio/wav` (24 kHz mono, silence-trimmed), header `X-Tts-Cache: hit|miss`. Takes are cached in `server/.cache/tts`.
- One Live session per uncached phrase: strict "say exactly this" system instruction, `outputAudioTranscription` checked against
  the request, one firmer retry, then `502 tts_mismatch` (the app falls back to the device voice).
- Errors: 400 `missing_text` / `text_too_long` / `invalid_text`, 429 `tts_budget_exceeded` (120 generations / 10 min),
  502 `gemini_rejected` (bad key/model) / `gemini_closed` / `gemini_no_audio`, 503 `gemini_not_configured`, 504 `gemini_timeout`.
- Only lesson text goes to Google. No child audio is ever sent to this endpoint.
- This endpoint fronts a paid API and the server has no auth: keep it bound to localhost, or put auth + rate limiting in
  front of it before deploying.
