# Selectable teacher voices

Settings → Teacher voice provides Automatic, Azure Neural, Qwen, Google Chirp 3 HD, Gemini and This device's voice. The choice is saved on this device and a preview reads a fixed sample in the active course language. Unconfigured cloud services are disabled in the dropdown. Availability reflects configuration and access, not a guarantee that an upstream key has passed a synthesis call.

Automatic keeps Gemini first, then uses Azure if Gemini is unconfigured, then the device. An explicit selection never silently plays a different provider after failure. Existing pronunciation scoring remains Azure.

## Server configuration

| Choice | Configuration | Default voice |
| --- | --- | --- |
| Azure Neural | AZURE_SPEECH_KEY + AZURE_SPEECH_REGION | Existing per-language neural voices in azure-tts.mjs |
| Qwen | DASHSCOPE_API_KEY; QWEN_TTS_REGION = qwencloud, singapore (default) or beijing | qwen3-tts-flash / Cherry |
| Google Chirp 3 HD | GOOGLE_CLOUD_TTS_API_KEY, with Cloud Text-to-Speech enabled and billing configured | Aoede, selected by language |
| Gemini | Existing GEMINI_API_KEY and optional model/voice overrides | Existing Gemini teacher |

Keys are server-only. The Google Cloud TTS key is separate from the Gemini AI Studio key. Restrict it to Cloud Text-to-Speech. Qwen's key must match the selected service/region. Qwen accepts English as a language but does not expose separate US/UK accent controls here. Chirp maps the app's zh-CN to its cmn-CN locale. Qwen slow playback uses the same recording at a pitch-preserving 0.65 playback rate; Azure/Chirp/Gemini synthesise a separate slow take.

For the QwenCloud API Keys page displaying `maas.qwencloudapi.com`, use its **Pay-As-You-Go** key as `DASHSCOPE_API_KEY` in the ignored `.env` and set `QWEN_TTS_REGION=qwencloud`. A Singapore selection is not required for this endpoint; `qwencloud` names the service, not a data-residency guarantee. Both key validation and speech generation use that host. The app adds the speech API path itself; do not paste the OpenAI-compatible or Anthropic-compatible base URL into the region setting. Alibaba Model Studio keys still use `singapore` (`dashscope-intl.aliyuncs.com`) or `beijing` (`dashscope.aliyuncs.com`). There is no automatic fallback between services.

Leslie runs npm run keys:push to validate and upload configured keys from the ignored .env file, then redeploys. The script includes the optional keys and Qwen region. It checks Qwen key access and Google's voice list without paid speech generation; use the in-app preview to check actual synthesis afterwards. No keys are added by this change. On 2026-09-25 the production secret inventory contained Azure and Gemini, but no Qwen or Google Cloud TTS keys.

## Cache and access

The browser stores generated audio in memory and IndexedDB, keyed by provider/model/voice, accent, speed and text. Concurrent requests for a take share the same promise. Server cache keys also separate providers and voices; cached lesson audio is shared across learners to reduce generation costs. Qwen normal/slow share one take. Changing a setting never reuses a different provider's audio.

Learner-authored text marked ephemeral is not written to the shared server or process cache. Requests use existing account/invite authorization, per-client rate limits, account usage checks and a generation budget. Alternative providers do not gain Gemini's public onboarding preview exception. Qwen downloads only a validated provider OSS audio URL over HTTPS, without the API key and without following redirects. Only text goes to these TTS APIs; pronunciation recordings still use the existing assessment route.

Provider APIs are mocked in tests; Azure can be tried with existing deployment credentials. Qwen and Chirp require owner configuration before a real synthesis test. Mandarin teacher-tone calibration remains specific to Gemini; do not claim that the new voices have passed the existing calibrated pronunciation gate. Audition them on real devices before changing the default.

Official implementation references (checked 2026-09-25):
- [QwenCloud API keys](https://docs.qwencloud.com/api-reference/preparation/api-key)
- [QwenCloud speech synthesis](https://docs.qwencloud.com/api-reference/speech-synthesis/qwen-tts)
- [Qwen TTS API](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/qwen-tts-api)
- [Google Chirp 3 HD](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)

Pronunciation-assessment alternatives to trial separately: [SpeechSuper](https://docs.speechsuper.com/) lists all six course languages; [Speechace](https://api-docs.speechace.com/getting-started/supported-languages) covers English, French and Spanish. Compare teacher-labelled, consented samples from all age groups before replacing Azure.
