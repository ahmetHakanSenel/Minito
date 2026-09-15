-- tasks and system_prompts are only read and written by edge functions through the
-- service role, which bypasses RLS. Enabling RLS without policies closes them to app clients.
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;

-- With open sign-up, "any authenticated user" meant anyone could rewrite the app's copy.
-- Translations are managed only through the service role (dashboard or scripts) from now on.
DROP POLICY IF EXISTS "Authenticated users can manage translations" ON translations;
