-- Contributed recordings in every course language (2026-09-25). The first check listed only the locales of the day
-- and never grew: Japanese takes were refused by the row insert after their audio had already been stored, leaving
-- orphaned files. Korean and Spanish courses are being added, so their locales come in now.
alter table public.contributions drop constraint if exists contributions_locale_check;
alter table public.contributions add constraint contributions_locale_check
  check (locale in ('en-US', 'en-GB', 'zh-CN', 'fr-FR', 'ja-JP', 'ko-KR', 'es-ES', 'es-MX'));
