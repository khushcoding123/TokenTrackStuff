import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";
import { validateSignupInput } from "../../../lib/validation";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, name, password, desktopHandoff } = body || {};

  const { valid, errors } = validateSignupInput({ email, password });
  if (!valid) {
    return NextResponse.json({ error: "Please fix the highlighted fields.", fieldErrors: errors }, { status: 400 });
  }

  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    name: name?.trim() || undefined,
  });

  if (error) {
    const status = error.statusCode ?? 400;
    const isDuplicate = status === 409;
    const message = isDuplicate
      ? "An account with this email already exists."
      : error.message || "Something went wrong. Please try again.";
    return NextResponse.json(
      { error: message, fieldErrors: isDuplicate ? { email: message } : {} },
      { status }
    );
  }

  // See login/route.js — same bearer-token handback for the desktop app,
  // read from the cookie createAuthActions() just wrote (data.accessToken
  // is always stripped by the SDK's sanitizeAuthData).
  if (desktopHandoff) {
    const token = cookieStore.get("insforge_access_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Account created, but couldn't retrieve a token for the desktop app." }, { status: 500 });
    }
    return NextResponse.json(
      { user: data.user, token, refreshToken: cookieStore.get("insforge_refresh_token")?.value ?? null },
      { status: 201 }
    );
  }

  return NextResponse.json({ user: data.user }, { status: 201 });
}
