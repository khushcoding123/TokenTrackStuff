-- Derive user_id from the authenticated JWT by default, so the desktop
-- client never has to know/send its own user id (removes a class of
-- spoofing risk — RLS's WITH CHECK already caught a mismatched value in
-- testing, but there's no reason to require or trust a client-supplied
-- value at all when Postgres can derive it from the auth token itself).
ALTER TABLE public.linked_projects
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- The owner-change trigger from the previous migration already blocks
-- changing user_id via UPDATE at the row level; narrow the column grant
-- too, following InsForge's documented "revoke broad, grant exact columns"
-- pattern, so the client can't even attempt to set id/user_id/created_at
-- (updated_at is maintained by its own trigger).
REVOKE UPDATE ON public.linked_projects FROM authenticated;
GRANT UPDATE (name, path, kind, file_count, last_scanned_at) ON public.linked_projects TO authenticated;
