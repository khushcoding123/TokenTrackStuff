import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";

// Google redirects here with ?insforge_code=... after the user approves
// access; we exchange that code for a session using the verifier we stashed
// in app/api/auth/google/route.js.
export async function GET(request) {
  const code = request.nextUrl.searchParams.get("insforge_code");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError || !code) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }

  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("insforge_code_verifier")?.value;
  if (!codeVerifier) {
    return NextResponse.redirect(new URL("/login?error=missing_verifier", request.url));
  }

  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.exchangeOAuthCode(code, codeVerifier);

  if (error || !data?.accessToken) {
    return NextResponse.redirect(new URL("/login?error=exchange_failed", request.url));
  }

  cookieStore.delete("insforge_code_verifier");

  const isDesktop = cookieStore.get("insforge_oauth_desktop")?.value === "1";
  if (isDesktop) {
    cookieStore.delete("insforge_oauth_desktop");
    const params = new URLSearchParams({ token: data.accessToken });
    if (data.refreshToken) params.set("refresh_token", data.refreshToken);
    params.set("email", data.user.email);
    if (data.user.profile?.name) params.set("name", data.user.profile.name);
    return NextResponse.redirect(new URL(`/desktop-connected?${params.toString()}`, request.url));
  }

  return NextResponse.redirect(new URL("/account", request.url));
}
