import { cookies } from "next/headers";
import { createServerClient } from "@insforge/sdk/ssr";

// Server Component / Route Handler helper: an InsForge client scoped to the
// current request's access-token cookie.
export async function createInsForgeServerClient() {
  return createServerClient({ cookies: await cookies() });
}
