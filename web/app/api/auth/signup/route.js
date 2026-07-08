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

  const auth = createAuthActions({ cookies: await cookies() });
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

  // See login/route.js — same bearer-token handback for the desktop app.
  if (desktopHandoff) {
    return NextResponse.json(
      { user: data.user, token: data.accessToken, refreshToken: data.refreshToken ?? null },
      { status: 201 }
    );
  }

  return NextResponse.json({ user: data.user }, { status: 201 });
}
