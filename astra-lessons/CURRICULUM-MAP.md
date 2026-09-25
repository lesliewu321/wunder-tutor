# Unified Wunder Tutor curriculum — 2026-09-25

The app now combines the original courses, Astra foundation units and Astra communication packs into 24 paths: six languages × four age groups. This is a reorganisation of 414 existing lesson IDs, with explicit adult exercise plans; it is not 414 newly written lessons. Existing completions, scores and saved item progress retain their IDs.

## What was compared and merged

| Material | Before | Now |
| --- | --- | --- |
| Original food/café courses | Seven lessons per language; written in JSON or TypeScript | Kept as foundation practice with the same IDs |
| Astra foundation | Fifteen additional topics in English and Putonghua | Placed by prerequisites and age relevance |
| Astra communication | People, Getting Around and Work appended to the course | People follows introductions/interests; transport follows town/travel; teamwork/work follows planning |
| Adult edition | Used the teen array directly | One short junior-level warm-up, then the teen extensions; identical tasks are deduplicated |
| Teen work edition | Used professional workplace responses | Uses the school/teamwork tasks, with teen guidance and titles |
| Reviews | Recalled words from the source-file order | Foundation carryover follows the actual path; personal due-item review remains |
| Translation checks | Skipped English items without a meaning field and some tutor prompts | Checks every course item and dialogue prompt, plus titles, instructions, stages and age guidance |

## Coverage

| Language | Playable units | Lessons per age path |
| --- | ---: | ---: |
| English | 19 | 139 |
| Putonghua | 19 | 139 |
| Japanese | 4 | 34 |
| Korean | 4 | 34 |
| French | 4 | 34 |
| Spanish | 4 | 34 |

The four shorter courses have food/café → people → getting around → school/teamwork or work. Their remaining placeholders stay visibly unavailable. They do not yet have the fifteen additional foundation topics available in English and Putonghua.

## Difficulty and age

These are teaching stages within this app, not certified CEFR levels. Age changes topics, scaffolding and context; being an adult does not imply advanced proficiency.

1. First words and patterns: concrete vocabulary, short patterns, listening and guided speaking.
2. Everyday conversations: introductions/interests, places, shopping, travel and transport.
3. Putting it together: connected ideas, plans, practical messages and team or workplace tasks.

English and Putonghua foundations:

- Little (5–7): greetings → numbers → family → home → school → animals → food → weather → feelings → routines → hobbies.
- Junior (8–11): greetings → numbers → family → home → school → food → animals → weather → feelings → routines → hobbies.
- Teen (12–17): greetings → numbers → family → home → school → routines → food → animals → weather → feelings → hobbies.
- Adult (18+): greetings → numbers → family → home → food → routines → school → animals → weather → feelings → hobbies.

All four then follow people → town → shopping → travel → getting around → stories → plans → school/teamwork (children/teens) or work (adults). Units retain their internal progression from vocabulary through listening, reading, construction, conversation and review. Related topics are revisited for a new communicative purpose instead of deleting completed lessons as duplicates.

Little learners use short, supported responses and pretend conversations with a trusted adult. Juniors build sentences and find details. Teens connect ideas in school, friendship and project situations. Adults begin with a foundation task before extending replies for real-life situations. Adults can still open any lesson; younger paths preserve sequential unlocking, and already completed lessons remain accessible.

## App languages and translation behavior

All seven app languages are covered: English, Traditional Chinese, Simplified Chinese, Japanese, Korean, French and Spanish. Titles, guides, questions and explanations use the app language. Speaking meanings now include the Little band, and English source text is translated even where the old item had no explicit meaning field. Translation prompts follow the app language rather than the home-language setting.

Target-language text, pronunciation and audio stay in the language being learned. Meanings are omitted when they simply repeat that language. Reading and sentence-building meanings appear after solving; tests do not show translation hints that give away an answer. Other app areas such as standalone scenario scripts keep their existing translation scope.

Translations are authored drafts, with bilingual foundation text reused where available. Automated coverage checks do not replace native-speaker or teacher review. These original lesson packs have no claimed institutional approval or accreditation. Reference PDFs in library/ are not imported into the app.

## Files and rebuilding

- curriculum.ts: topic order, stages and four-band runtime selection.
- curriculum-manifest.json: every path, unit, lesson and exercise, exported from the same runtime as the app.
- authoring/curriculum-translations.json: new reviewed-source candidates for labels and missing meanings.
- build-curriculum.mjs → i18n/curriculum.json: deterministic supplemental translation catalogs.
- courses/ and the original src/content/ courses: canonical authored lessons with stable IDs.

Run npm run lessons:curriculum after rebuilding foundation or communication material. Run npm run i18n:export before npm run i18n:check. Regression tests cover all 24 paths, stable lesson IDs, completed-progress access, adult scaffolding and seven-language translation completeness.
