# Translation, teacher voice and reminder gauntlets

Run npm run test:gauntlet for the targeted matrix; npm test also includes it.

## Automated coverage

- Seven app languages × seven course languages × four age bands × two Chinese display settings × two English accents = 784 lesson permutations. Each walks every applicable lesson, guide, exercise, answer and meaning. Seven additional cases fill every interface string and check parameters.
- Six teacher choices, 16 provider availability masks, supported speech locales and both speeds. Tests cover rapid taps, cache replay, provider identity, fallback order, access/quota limits, cache outages, cancelled downloads, stuck playback and refusing a wrong-language device voice.
- Real Azure/Qwen/Chirp adapter code with controlled upstream responses. Qwen tests include Singapore, Beijing and QwenCloud. They check language, voice, request coalescing, credential-free audio downloads and normal/slow cache reuse.
- 112,903 reminder preference combinations (seven locales × 127 course subsets × 127 weekday subsets), 418 runtime timezones across four dates, all minutes of representative quiet-hour schedules, all message kinds, daily limits and duplicate alarms.
- Client lifecycle covers denied/dismissed permission, failure cleanup, save while off, opt-out during an in-flight enable, and iOS installation requirements.

These checks establish software behavior under defined inputs. They cannot establish that every browser, network, provider account, accent and physical push service will always work.

## Browser checks

Run node scripts/gauntlet-server.mjs in a separate terminal (port 5176, no production keys), then node scripts/gauntlet-browser.mjs. Playwright must be installed or PLAYWRIGHT_PACKAGE must point to its package.json. Optional GAUNTLET_BROWSER selects the browser channel; default msedge.

The browser harness checks 196 home permutations at 390px, 49 localized settings/reminders/conversation/lab/bonus/Scan/lesson flows, teacher selection persistence, unavailable Cantonese Gemini, and Qwen preview locale routing. APIs are intercepted, so it does not spend speech credits or send real pushes. Screenshots go into ignored .wrangler.

## Fixes driven by the gauntlets

Automatic voice selection now includes configured Chirp and Qwen; provider errors can recover through configured alternatives. Shared cache failures do not prevent generation. Access and account limits stop further cloud attempts. Stopping a download releases the caller and suppresses late playback. Device fallback stays in the requested language. Playback watchdogs release stuck UI.

Saving a schedule while reminders are off keeps delivery disabled. Opt-out wins over an in-flight enable. Invalid or temporarily empty time fields fail safely.

## Remaining external checks

Upload owner-managed Qwen/Chirp credentials and audition real speech, including Cantonese. Test Web Push on physical iOS, Android and desktop devices. Native review of course content and translations, and Cantonese pronunciation scoring calibration, remain separate from these software checks.
