import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";
import { validateLoginInput } from "../../../lib/validation";

const GENERIC_ERROR = "Invalid email or password.";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, password, desktopHandoff } = body || {};

  const { valid, errors } = validateLoginInput({ email, password });
  if (!valid) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors: errors }, { status: 400 });
  }

  const auth = createAuthActions({ cookies: await cookies() });
  const { data, error } = await auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data?.user) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: error?.statusCode ?? 401 });
  }

  // The desktop app can't read our httpOnly session cookie — when it asked
  // for this login via ?desktop=1, hand the bearer token back in the body
  // too, so the client can forward it into the metriq:// callback. Omitted
  // for ordinary web logins, which only ever need the cookie.
  if (desktopHandoff) {
    return NextResponse.json({
      user: data.user,
      token: data.accessToken,
      refreshToken: data.refreshToken ?? null,
    });
  }

  return NextResponse.json({ user: data.user });
}
