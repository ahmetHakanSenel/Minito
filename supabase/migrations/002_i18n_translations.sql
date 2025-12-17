-- Translations Table
-- Stores dynamic translations for i18n support
-- Allows admin to update translations without code deployment
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL, -- Translation key (e.g., "home.title", "focus.next")
  language_code TEXT NOT NULL, -- Language code (e.g., "en", "tr")
  value TEXT NOT NULL, -- Translated text
  namespace TEXT DEFAULT 'translation', -- i18next namespace (default: "translation")
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique key-language combination
  CONSTRAINT translations_key_language_unique UNIQUE (key, language_code, namespace)
);

-- Index for fast lookups by language
CREATE INDEX IF NOT EXISTS translations_language_code_idx ON translations (language_code);

-- Index for fast lookups by key
CREATE INDEX IF NOT EXISTS translations_key_idx ON translations (key);

-- Index for namespace lookups
CREATE INDEX IF NOT EXISTS translations_namespace_idx ON translations (namespace);

-- Composite index for common query pattern (language + namespace)
CREATE INDEX IF NOT EXISTS translations_language_namespace_idx ON translations (language_code, namespace);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_translations_updated_at
BEFORE UPDATE ON translations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to get all translations for a language
CREATE OR REPLACE FUNCTION get_translations_for_language(
  p_language_code TEXT,
  p_namespace TEXT DEFAULT 'translation'
)
RETURNS TABLE (
  key TEXT,
  value TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.key, t.value
  FROM translations t
  WHERE t.language_code = p_language_code
    AND t.namespace = p_namespace
  ORDER BY t.key;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert translation (insert or update)
CREATE OR REPLACE FUNCTION upsert_translation(
  p_key TEXT,
  p_language_code TEXT,
  p_value TEXT,
  p_namespace TEXT DEFAULT 'translation'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO translations (key, language_code, value, namespace)
  VALUES (p_key, p_language_code, p_value, p_namespace)
  ON CONFLICT (key, language_code, namespace)
  DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) Policies
-- Enable RLS
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access (translations are public)
CREATE POLICY "Translations are viewable by everyone"
  ON translations
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert/update (admin only in production)
-- Note: In production, you should restrict this to admin users only
CREATE POLICY "Authenticated users can manage translations"
  ON translations
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Optional: Insert initial translations from JSON files
-- This can be done via a script or manually
-- Example:
-- INSERT INTO translations (key, language_code, value) VALUES
--   ('home.title', 'en', 'Welcome to Minito'),
--   ('home.title', 'tr', 'Minito''ya Hoş Geldiniz');















