-- Remove the dynamic translations table.
--
-- It was built so strings could be changed without shipping an app update. Nothing ever wrote to
-- it: migration 015 already dropped its two write functions as "unused by the app", leaving a
-- read-only table nobody filled. The client's read of it was a lazy `import()` that failed on
-- every launch under Metro ("Could not load bundle"), so the feature also never ran.
--
-- It was not free. It cost a network round trip before the first screen, and it could overwrite
-- any string in the app at runtime, through i18next's deep merge — which quietly undermines the
-- one thing the locale test proves, that every key the code asks for resolves to real text.
--
-- The app's strings live in src/lib/i18n/locales, and that is now the only place they live.

DROP TRIGGER IF EXISTS update_translations_updated_at ON public.translations;

DROP TABLE IF EXISTS public.translations;
