-- Metriq desktop app: projects a user has linked (local folder or, later,
-- a GitHub repo) so the link persists across app restarts and devices.

CREATE TABLE public.linked_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'local',
  file_count INTEGER,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT linked_projects_kind_check CHECK (kind IN ('local', 'github'))
);

CREATE INDEX linked_projects_user_id_idx ON public.linked_projects (user_id);

ALTER TABLE public.linked_projects ENABLE ROW LEVEL SECURITY;

-- Strict per-user ownership: a user may only ever see or touch their own
-- linked projects, never anyone else's.
CREATE POLICY "owners can select their linked projects" ON public.linked_projects
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "owners can insert their own linked projects" ON public.linked_projects
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "owners can update their own linked projects" ON public.linked_projects
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "owners can delete their own linked projects" ON public.linked_projects
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- No policy for `anon` at all — an unauthenticated caller gets zero rows,
-- not just a filtered view.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.linked_projects TO authenticated;

-- Prevent a row's owner from ever being reassigned by an UPDATE (defense in
-- depth beyond the WITH CHECK above, which only validates the final row).
CREATE OR REPLACE FUNCTION public.prevent_linked_project_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER linked_projects_prevent_owner_change
  BEFORE UPDATE ON public.linked_projects
  FOR EACH ROW EXECUTE FUNCTION public.prevent_linked_project_owner_change();

CREATE TRIGGER linked_projects_updated_at
  BEFORE UPDATE ON public.linked_projects
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();
