-- 0002_add_user_language
-- Per-user UI language (bilingual UI, 'en' | 'vi'). NULL = not chosen yet:
-- the browser language / DEFAULT_LANGUAGE is used until the user picks one.
ALTER TABLE users ADD COLUMN language VARCHAR(5)
  CHECK (language IS NULL OR language IN ('en', 'vi'));
