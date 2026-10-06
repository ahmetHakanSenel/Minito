-- Planner projects and their tasks, synced across devices.
--
-- The app is offline-first: it writes locally, then pushes whole rows with an upsert and pulls
-- whatever changed since its last cursor. Three rules make that safe to replay in any order:
--
--   1. Ids are generated on the device, so a retried push is the same row, never a second one.
--   2. Deletes are tombstones (deleted_at), so an offline device learns about them on its next
--      pull, and a stale push cannot quietly bring a deleted row back.
--   3. client_updated_at orders edits: an update older than the stored row is skipped, so a
--      device that was offline for a week cannot overwrite newer edits made elsewhere.

CREATE TABLE IF NOT EXISTS public.planner_projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  color TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  due_date DATE,
  client_updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Target of the tasks' composite foreign key below.
  UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.planner_tasks (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  client_updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A task can only belong to a project of the same user. RLS alone would allow attaching a task
  -- to someone else's project id; this key makes that impossible at the schema level.
  FOREIGN KEY (project_id, user_id) REFERENCES public.planner_projects (id, user_id) ON DELETE CASCADE
);

-- Pull sync reads "my rows changed since the cursor".
CREATE INDEX IF NOT EXISTS planner_projects_user_updated_idx
ON public.planner_projects (user_id, updated_at);

CREATE INDEX IF NOT EXISTS planner_tasks_user_updated_idx
ON public.planner_tasks (user_id, updated_at);

CREATE INDEX IF NOT EXISTS planner_tasks_project_idx ON public.planner_tasks (project_id, user_id);

CREATE INDEX IF NOT EXISTS planner_projects_deleted_idx
ON public.planner_projects (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS planner_tasks_deleted_idx
ON public.planner_tasks (deleted_at) WHERE deleted_at IS NOT NULL;

-- Server-side bookkeeping for every write, from any client.
CREATE OR REPLACE FUNCTION public.planner_prepare_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- A device clock set far ahead would otherwise make its edits unbeatable.
  NEW.client_updated_at := LEAST(NEW.client_updated_at, NOW() + INTERVAL '1 minute');

  IF TG_OP = 'UPDATE' THEN
    -- Returning NULL skips the row: an upsert carrying an older edit changes nothing.
    IF NEW.client_updated_at < OLD.client_updated_at THEN
      RETURN NULL;
    END IF;
    NEW.created_at := OLD.created_at;
  END IF;

  -- The pull cursor follows the server's clock, never the device's.
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER planner_projects_prepare_write
BEFORE INSERT OR UPDATE ON public.planner_projects
FOR EACH ROW
EXECUTE FUNCTION public.planner_prepare_write();

CREATE TRIGGER planner_tasks_prepare_write
BEFORE INSERT OR UPDATE ON public.planner_tasks
FOR EACH ROW
EXECUTE FUNCTION public.planner_prepare_write();

-- Owner-only access. There is no DELETE policy: clients delete with a tombstone, and only the
-- cleanup job or an account deletion removes rows.
ALTER TABLE public.planner_projects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.planner_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own projects"
ON public.planner_projects FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users create their own projects"
ON public.planner_projects FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users update their own projects"
ON public.planner_projects FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users read their own tasks"
ON public.planner_tasks FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users create their own tasks"
ON public.planner_tasks FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users update their own tasks"
ON public.planner_tasks FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.planner_projects, public.planner_tasks FROM anon;

REVOKE DELETE, TRUNCATE ON TABLE public.planner_projects, public.planner_tasks FROM authenticated;

-- Tombstones only need to live as long as a device may stay offline. A device that comes back
-- after this with an edit to a purged row recreates it, which is the safer failure.
CREATE OR REPLACE FUNCTION public.cleanup_planner_tombstones(
  p_older_than INTERVAL DEFAULT INTERVAL '30 days'
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_projects INTEGER;
  v_tasks INTEGER;
BEGIN
  DELETE FROM public.planner_tasks WHERE deleted_at < NOW() - p_older_than;
  GET DIAGNOSTICS v_tasks = ROW_COUNT;
  -- Removing a project also removes its remaining tasks through the foreign key.
  DELETE FROM public.planner_projects WHERE deleted_at < NOW() - p_older_than;
  GET DIAGNOSTICS v_projects = ROW_COUNT;
  RETURN v_projects + v_tasks;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_planner_tombstones(INTERVAL)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cleanup_planner_tombstones(INTERVAL) TO service_role;

REVOKE ALL ON FUNCTION public.planner_prepare_write() FROM PUBLIC, anon, authenticated;

-- With pg_cron enabled:
-- SELECT cron.schedule('cleanup-planner-tombstones', '40 3 * * *', 'SELECT public.cleanup_planner_tombstones();');
