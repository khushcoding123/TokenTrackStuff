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

  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error || !data?.user) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: error?.statusCode ?? 401 });
  }

  // createAuthActions() strips accessToken/refreshToken out of `data` by
  // design (see sanitizeAuthData in @insforge/sdk/ssr) — it writes them into
  // insforge_access_token/insforge_refresh_token cookies instead and expects
  // callers to rely on the cookie, not the bearer token, for web sessions.
  // The desktop app can't read our httpOnly session cookie, so when it asked
  // for this login via ?desktop=1, read the token back out of the cookie
  // createAuthActions() just wrote and hand it back in the body so the
  // client can forward it into the metriq:// callback. Omitted for ordinary
  // web logins, which only ever need the cookie.
  if (desktopHandoff) {
    const token = cookieStore.get("insforge_access_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Signed in, but couldn't retrieve a token for the desktop app." }, { status: 500 });
    }
    return NextResponse.json({
      user: data.user,
      token,
      refreshToken: cookieStore.get("insforge_refresh_token")?.value ?? null,
    });
  }

  return NextResponse.json({ user: data.user });
}
