# Accuracy gauntlet

Measures how often the app's pronunciation feedback is **right**: no false alarms on correct speech, real mistakes
caught, and the mistake named correctly ("sounded like …"). The reports run the **production** code paths
(`src/speech/azureProvider.ts`, `src/speech/zh/`, `src/engine/learning.ts`, `src/tutor/feedback.ts`) over a labelled
set of recorded Azure responses, so a code change can be re-measured in seconds.

## The test set

Synthetic "learners": Gemini Live voices **Kore, Puck, Leda** (English; Kore also at 1.25×, a quicker child-like
pace) — and for Mandarin also **Aoede, Zephyr, Charon**, every voice at 1× and 1.25× (2,969 cases).
Every error case is a real word said in place of the target — "fin" for "thin", 四 sì for 是 shì, 马 mǎ for 骂 mà —
so the voice says it naturally and the truth is known exactly (`cases.ts`). Correct takes of the same items measure
false alarms. Each take is scored by Azure exactly as the app scores it, plus the extra scorings the app makes
(British takes also as US English; likely-mistake alternatives).

Glitched generations (a few milliseconds of audio, or half a minute) are excluded — see `zh-common.ts`.

## Commands

Keys come from the project `.env` (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `GEMINI_API_KEY`); nothing prints them.
Everything is cached in `eval/.cache` (gitignored, ~160 MB): a rerun only generates what is missing and costs nothing.

```bash
npx vite-node eval/build.ts en          # build/extend the English set  → eval/.cache/dataset-en.json
npx vite-node eval/build.ts zh          # build/extend the Mandarin set → eval/.cache/dataset-zh.json
npx vite-node eval/run-en.ts            # English report (US + British); --misses lists each miss, --no-alts disables alternatives
npx vite-node eval/report-zh.ts --cv    # Mandarin report; --cv = tone model never saw the voice under test (the honest number)
npx vite-node eval/train-tone.ts        # tone model: leave-one-voice-out accuracy; --write regenerates src/speech/zh/toneModel.ts
npx vite-node eval/sweep-zh.ts          # Mandarin thresholds: false alarms vs detection, single characters vs phrases
npx vite-node eval/cold-zh.ts           # a new learner (no voice profile yet) vs a known voice
npx vite-node eval/trim-check.ts        # trimming pauses: does any scored word fall outside what is kept?
npx vite-node eval/clips.ts --plan      # word-clip checks: cut clips, list scorings → node eval/run-jobs.mjs → rerun
                                         #   without --plan for the comparison (--pad=0.04 / 0.08 / 0.15)
npx vite-node eval/dump-zh-items.ts     # then: node eval/read-check.mjs [--set=polyphones] — Chinese reading + pinyin
node eval/ocr-check.mjs                 # photos of printed pages (clean / phone-like / harsh): characters read wrongly
npx vite-node eval/alt-types-zh.ts      # each kind of "sounded like" swap: right vs false alarms (sets SWAP_TRUST)
npx vite-node eval/teacher-check.ts     # tone check on the teacher's own recordings (Kore voice)
npx vite-node eval/tone-shapes.ts       # measured pitch shape of each tone, per voice and position
npx vite-node eval/pseudo-check.ts      # do respelled mistakes ("Fank you!") work as alternatives? (live calls, cached)
node eval/probe.mjs                     # the original feasibility probes (what Azure returns per locale)
```

## Results (2026-09-19)

| | False alarms (correct takes flagged) | Mistakes caught | Right sound named | "Sounded like" given / right |
| --- | --- | --- | --- | --- |
| **US English** | 2.3% | 87.6% | 80.1% | 83.7% / 99.0% |
| **British English** | 3.3% | 85.7% | 73.4% | 77.5% / 96.8% |
| **Mandarin** (six voices, held-out) | 6.7% (phrases 8.5%) | 75.4% | tones 83.6% caught, named right 91.1% | sounds 64.7% caught; 100% precision |
| Mandarin, a new learner's first takes | 5.9% | — | tones 72.5% caught | — |

Before this work: US detection 48.9%, British false alarms 37.5%, Mandarin false alarms 38.6%.

Known weak spots: British at 1.25× (pair false alarms 10.3%, few sentence cases); Mandarin tone errors **inside
phrases** — only 46% caught (single characters 88%), partly because Azure marks a wrong final syllable as "missing"
(这是十 for 这是四) and falling tones that end in creak give the pitch tracker too little to read; Mandarin sound
confusions Azure cannot hear at all (村 cūn / 春 chūn both 100) — a second scorer such as SpeechSuper would be the
next step. Azure also can't tell ü from i for many voices, so those swaps are never named (`SWAP_TRUST`,
`alt-types-zh.ts`). `sweep-zh.ts` shows the false-alarm/detection trade-off for the Mandarin thresholds.

Say it right (reading text, `server/read.mjs`, Gemini 3.8 Flash): typed Chinese course lines 107/107 with Simplified,
syllables and tones right (after telling it which syllables are light: 謝謝 xièxie; 4 runs); 30 tricky sentences (還
hái/huán, 長 zhǎng/cháng, 得 de/děi…) 100% of syllables right. 得 meaning "must" came back as a non-syllable "de3"
every time until the prompt named it (0/4 → 16/16 on fresh sentences, 8 of them unseen). Typed one-per-line lists were
sometimes joined into one sentence (1 run in 4) until typed line breaks were declared final. Photographed pages
(English, Traditional, Simplified; clean, tilted/grainy, and harsh with shadow and heavy blur) read with **no** wrong
characters and all 83 + 50 syllables right, 2–6 s a page. Mixed pages: a Hong Kong menu (English and Chinese lines), bilingual
signs ("Exit 出口" → two sentences), French beside English, and Japanese — every sentence found with its language (a
page-wide label had once sent a bilingual page back as "other"), Chinese pinyin all right, French and Japanese never
offered.

Reading in two steps (2026-09-19, after a real phone photo failed): a dense textbook page (279 characters, 17
sentences) took 14 s in one answer — and a fuller page would run past the answer-size limit. Now the sentences come
first (~2.4 s), then the pinyin in up to 6 parallel requests (~3–4 s): 5.4–8.3 s for that page, every sentence with
its pinyin. Re-run afterwards: all photo pages 0% wrong characters and 133/133 syllables; course lines 100% twice;
tricky sentences 100%; 得 16/16 (a remaining "de3" slip is mended on the server). `node eval/ocr-check.mjs`,
`node eval/read-check.mjs [--set=polyphones]`.

Cost checks: trimming pauses keeps every scored word (2,541 takes) and saves ~42%; word-clip checks for phrases and
sentences — see server/README.md.

**Network note:** on this machine vite-node stalls on repeated outbound connections (plain Node doesn't), so the scripts
that make many API calls either run under plain Node (`.mjs`) or plan their calls and hand them to `run-jobs.mjs`.

## Real voices (volunteers)

Parents of volunteer children (or adult volunteers) use **Parent Zone / Settings & privacy → Share recordings for
testing**: after a consent tick the app saves one `.json` file (recordings as 16 kHz WAV, what was asked, the app's
scores, age, home language — no name). Put the files in `eval/volunteers/` (**gitignored — children's voices must
never be committed**) and run `npx vite-node eval/volunteers.ts`: each learner gets a folder of WAVs and a
`manifest.csv` with the app's verdict per word and a column for a human label (correct? what was wrong?). Labelled
real takes are what the numbers above still lack.

## Caveats

These are synthetic adult voices, not children. The tone model was trained on three synthetic voices. The numbers
say the method works; they are not a promise for a real 6-year-old. Recording real children (with consent) and adding
them to the set is the most valuable next test.
