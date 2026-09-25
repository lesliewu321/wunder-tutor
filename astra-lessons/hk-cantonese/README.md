# Hong Kong Cantonese — beginner course

Original Wunder Tutor material, built on 2026-09-25. This is a beginner course, not an accredited syllabus or a claim of official approval. Native Hong Kong teacher review and live speech calibration remain pending.

## What is included

- 28 lessons: seven topics, each with words, useful phrases, conversation, and review/application.
- 70 speaking items in Traditional Cantonese with Jyutping; seven guided conversations.
- Four lesson plans per lesson: Little (5–7), Junior (8–11), Teen (12–17), Adult (18+).
- 112 Little, 119 Junior, 133 Teen, and 136 Adult exercise entries in the authored data. The shared curriculum applies its existing teen teamwork rule to the work unit.
- Listen-and-choose, speaking, short dialogues, reading replies and sentence arrangement.
- Placement-check items and three pronunciation practice ladders: six tones, final stops, initial ng.
- Lesson titles, instructions, meanings, conversation descriptions and pronunciation guidance translated into all seven app languages: English, Traditional Chinese, Simplified Chinese, Japanese, Korean, French and Spanish.

The learning path starts with greetings and numbers, then food, people, shopping and getting around, and ends with teamwork/work. Little learners use short spoken prompts with a trusted adult; juniors practise sentences; teens practise everyday and group-project replies; adults also practise a workplace meeting phrase.

Spoken Hong Kong examples include 唔該, 幾多錢, 港鐵站, 八達通 and 菠蘿包. Practice text stays in Traditional Cantonese even when the app interface is Simplified Chinese. Meaning translations use the chosen app language. Cantonese is a course, not a new separate interface language.

## Authoring

Edit source.json and sounds.json, then run:

```
npm run lessons:cantonese
npm run content:check
npm run test:gauntlet
npm run i18n:export
npm run i18n:check
```

build.mjs writes ../courses/yue.json, scenarios.json, sounds-built.json and ../i18n/cantonese.json. Simplified interface translations are generated from Traditional with OpenCC. No textbooks were copied.

## Speech and current boundaries

Speech uses zh-HK. Automatic tries configured Azure, Google Chirp and Qwen voices in that order. Azure uses HiuMaanNeural, Chirp uses yue-HK-Chirp3-HD-Aoede, Qwen uses Kiki with Auto language detection. Explicit Gemini is unavailable for this course. Device fallback requires a Hong Kong Cantonese voice and will not substitute Mandarin.

Azure pronunciation assessment remains the scoring service. Generic word-level feedback is used; named English phonemes and Mandarin tone diagnosis are not applied to Cantonese. Jyutping validation checks notation and syllable alignment, not native pronunciation quality.

Scan's existing OCR practice pipeline remains English/Mandarin; its interface is translated across the seven app languages. No Cantonese tongue twister is marked proven without actual scoring validation. The course provides pronunciation ladders and review lessons; the tongue-twister screen currently shows its translated empty state for Cantonese.

## Primary references

- [Linguistic Society of Hong Kong Jyutping scheme](https://jyutping.org/en/jyutping/)
- [Jyutping learning guide](https://jyutping.org/en/learn/)
- [Azure language support](https://learn.microsoft.com/azure/ai-services/speech-service/language-support?tabs=pronunciation-assessment)
- [Google Chirp 3 HD](https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd)
- [Qwen voice list](https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-list)

References inform notation and provider routing; they do not approve this course.
