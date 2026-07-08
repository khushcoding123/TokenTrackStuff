import { createInsForgeServerClient } from "./insforge/server";

// Server Component / Route Handler helper: resolves the current InsForge
// user (or null) from the request's cookie jar.
export async function getSession() {
  const client = await createInsForgeServerClient();
  const { data } = await client.auth.getCurrentUser();
  return data?.user ?? null;
}
