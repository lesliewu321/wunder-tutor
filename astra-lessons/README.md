# Astra lessons for Wunder Tutor

English and Putonghua each contain 16 units and 112 lessons: the original food unit plus 15
new authored topics. Every lesson has Little (5–7), Junior (8–11) and Teen versions.
Adults use the Teen version, as elsewhere in Wunder Tutor. Wunder Tutor is a global app:
Hong Kong is the starting market, not a restriction on learners, accents or examples.
English teaching notes work without Cantonese knowledge. Mandarin offers both scripts and
English meanings. These lessons currently have English and Traditional Chinese interface copy.

The course covers food, introductions, numbers, family, learning, home, routines, animals,
directions, shopping, weather, hobbies, feelings, transport, past events, and plans/opinions.
Its scope is everyday foundation language with more demanding extensions for older learners.
It is not an accredited course, a full CEFR A1–C2 syllabus, or complete HSK exam preparation.

## What learners do

Each new unit has seven lessons: vocabulary; patterns; pronunciation; listening;
reading and sentence building; conversation; and cumulative review. Teaching notes explain
a goal, a grammar or pronunciation point, and an offline writing/application task.
The youngest learners may draw, dictate, or work with a grown-up.

Sentence building checks order against a model, not free writing. The app does not assess
handwriting, open-ended essays, or official exam readiness. Offline writing tasks need a
teacher or family member's feedback. Pronunciation uses the app's existing real/mock modes;
course completion does not certify language proficiency.

## Authoring

- courses/en.json and courses/zh.json: data read by the application.
- authoring/foundation.json: original bilingual topic material, three age bands, grammar,
  pronunciation guidance, reading questions, dialogue prompts and writing tasks.
- astra-lessons/build.mjs: deterministic compiler. Run after editing the authoring data.
  The original food unit, checks, Lab ladders and existing items are retained. Existing IDs
  are never reassigned to different speech.
- ../content/schema/course.schema.json: course schema.
- resources/: downloaded reference books, their manifest and terms. These files are outside
  public/ and are not copied into the deployed app. Runtime lessons are original authored
  material; no publisher textbook, archive recording, image or video is embedded.

Run:

    node astra-lessons/build.mjs
    npm run content:check
    npm test
    npm run build

Do not edit a generated new lesson directly; update its authoring row and regenerate.
The first food unit remains independently authored in ../content/courses/*.json; the compiler reads
those base files and produces the expanded courses in astra-lessons/courses/.

## Standards and editorial status

The topic order uses common beginner communicative goals described by CEFR and introductory
Mandarin curricula. This is a pedagogical reference, not a claim of official alignment or
exhaustive HSK vocabulary coverage. See the current official HSK syllabus before adding exam
labels; older FSI material predates HSK and includes dated adult/diplomatic contexts.

English and Mandarin practice lines were newly written for this project. They use everyday
family/community situations instead of reproducing archive dialogues. Mandarin carries both
character scripts and one numbered citation-tone syllable per Han character. The speech engine
applies tone sandhi. Automated checks cover structure and references; a qualified bilingual
teacher should review naturalness, age suitability and teaching sequence before a public launch.
