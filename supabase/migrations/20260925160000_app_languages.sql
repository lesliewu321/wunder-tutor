-- The App language now has seven choices (Leslie, 2026-09-25: "add all the course languages to app language",
-- "app language should include traditional and simplified chinese"). A consent is recorded in the language its
-- wording was shown in, so the two checks widen to match src/i18n/index.ts LANGUAGES.
alter table public.parents drop constraint if exists parents_ui_language_check;
alter table public.parents add constraint parents_ui_language_check
  check (ui_language in ('en', 'zh-Hant', 'zh-Hans', 'ja', 'ko', 'fr', 'es'));

alter table public.consents drop constraint if exists consents_language_check;
alter table public.consents add constraint consents_language_check
  check (language in ('en', 'zh-Hant', 'zh-Hans', 'ja', 'ko', 'fr', 'es'));
