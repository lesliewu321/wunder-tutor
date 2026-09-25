# Cantonese — everyday language curriculum

Original Wunder Tutor material, expanded 2026-09-25. This is a broad foundation course with applied sentence patterns, not a claim of certified proficiency. Native Hong Kong teacher review and pronunciation-scoring calibration remain pending.

## Coverage

- 96 lessons in 24 ordered topics; 246 practice items in Traditional Cantonese with Jyutping.
- 24 guided conversations, each with two exchanges and a Cantonese closing.
- Four plans per lesson: Little (5–7), Junior (8–11), Teen (12–17), Adult (18+). Authored exercise entries: 408 / 541 / 565 / 568 respectively. Teen teamwork retains the shared curriculum adaptation.
- Each topic progresses through words, useful sentences, conversation, and review/application. Activities combine speaking, listening choices, reading replies, sentence arrangement and spaced review.
- Six pronunciation ladders: six tones, final stops, initial ng, aa/a, aspiration d/t, and rounded yu. The six-tone diagram uses Cantonese citation tones, not the Mandarin four-tone component.
- 28 original lesson IDs and existing practice item IDs retained, preserving saved progress. Added words and expressions are practised aloud, not merely present in a vocabulary file.

## Learning sequence

| Stage | Topics | Main language patterns |
| --- | --- | --- |
| Foundations | Greetings, numbers, family, home, school, animals, weather, feelings, routines, hobbies | 唔該/多謝; 兩 and classifiers; 嘅; 我哋; 喺; 有冇; 聽唔明; 呢/嗰/邊; time words; 想/唔想; progressive 緊; 識唔識 |
| Everyday situations | Food, friends, transport, shopping, dining, community services, health, travel, messages | 一杯/一個; 鍾意; 喺邊; 幾多錢; 少啲/唔要; permission requests; seeking help; travel questions; completion 咗 and not-yet 未 |
| Putting it together | Plans, experiences, opinions, teamwork, solving problems | 好唔好; 得閒; past events and 過; 覺得/比/因為; collaborative requests; 先…再…; 搵唔到 |

Health lessons practise expressing discomfort and seeking help, not diagnosis or treatment. Children use pretend travel and service situations; the adult meeting phrase remains adult-only. Scan remains the existing English/Mandarin feature and has translated UI; this expansion does not add a Cantonese OCR pipeline or calibrated tongue twisters.

## Complete translation matrix

Every authored catalog has the same 272 content labels, 33 instruction/grammar lines and 244 distinct meanings. All seven app languages are included: English, Traditional Chinese, Simplified Chinese, Japanese, Korean, French and Spanish. Simplified Chinese is generated with OpenCC from Traditional Chinese.

| Runtime coverage | Permutations |
| --- | ---: |
| 96 lessons × 7 app languages × 4 age bands × 2 character preferences × 2 English accents | 10,752 |
| 24 conversations × the same 112 combinations | 2,688 |
| 6 pronunciation ladders × the same 112 combinations | 672 |

The general gauntlet walks every lesson exercise, guide, answer, meaning and speech locale. `src/__tests__/gauntlet-cantonese-translations.test.tsx` additionally checks every catalog entry, translated course/unit/lesson title, conversation description/turn/closing, ladder item, and accessible six-tone chart. It caught the Mandarin script preference rewriting Japanese and Simplified Chinese labels; translated UI now follows its language independently.

Practice text always stays Cantonese with Jyutping, including when the app UI is Simplified Chinese. English/UK accent preferences do not change Cantonese speech. Translated Chinese meanings may use standard written Chinese; they are supporting explanations, not the spoken practice target. Complete catalog coverage is not a substitute for native-speaker editorial review.

## Authoring and checks

- `source.json`: the original seven topics and stable item identities.
- `extension.mjs`, `applications.mjs`: seventeen additional topics, six source translations per row, meaningful sentence chunks and reply pairs.
- `guidance.mjs`: original-topic grammar tips and the full prerequisite order.
- `sounds.json`, `phonetics.mjs`: pronunciation guidance and extra practice items.
- `build.mjs`: validates translation rows and Jyutping alignment; writes the runtime course, conversations, sound guides and seven catalogs.

Run:

```sh
npm run lessons:cantonese
npm run content:check
npm run i18n:export
npm run i18n:check
npm test
npm run typecheck
```

Do not run export tests against another task’s nested release checkout; exclude `.wrangler/**` when invoking an exporter directly. The runtime curriculum manifest can be regenerated with `astra-lessons/export-curriculum.mjs` when no nested release checkout is present.

## Speech

All course, conversation, review and ladder items use `zh-HK`. Chirp maps that to `yue-HK-Chirp3-HD-Aoede`; Azure uses HiuMaanNeural and Qwen uses Kiki. Automatic tries configured Azure, Chirp, then Qwen. Gemini is excluded for Cantonese; device fallback requires an actual Cantonese voice. Pronunciation assessment uses Azure word-level feedback, without applying Mandarin tone diagnosis or English sound labels to Cantonese.

## Primary references

- [Linguistic Society of Hong Kong Jyutping scheme](https://jyutping.org/en/jyutping/)
- [Jyutping sound and tone guide](https://jyutping.org/en/learn/)
- [Google Chirp 3 HD language support](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)

Notation references inform the original material; they do not endorse or certify the course.
