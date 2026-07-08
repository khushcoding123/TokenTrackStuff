import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";

export async function POST() {
  const auth = createAuthActions({ cookies: await cookies() });
  await auth.signOut();
  return NextResponse.json({ ok: true });
}
