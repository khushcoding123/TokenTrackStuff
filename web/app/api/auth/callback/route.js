import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";

// Google redirects here with ?insforge_code=... after the user approves
// access; we exchange that code for a session using the verifier we stashed
// in app/api/auth/google/route.js.
export async function GET(request) {
  const code = request.nextUrl.searchParams.get("insforge_code");
  const oauthError = request.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const isDesktop = cookieStore.get("insforge_oauth_desktop")?.value === "1";
  const errorRedirect = (reason) =>
    NextResponse.redirect(new URL(isDesktop ? `/login?desktop=1&error=${reason}` : `/login?error=${reason}`, request.url));

  if (oauthError || !code) {
    return errorRedirect("oauth_failed");
  }

  const codeVerifier = cookieStore.get("insforge_code_verifier")?.value;
  if (!codeVerifier) {
    return errorRedirect("missing_verifier");
  }

  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.exchangeOAuthCode(code, codeVerifier);

  if (error || !data?.accessToken) {
    return errorRedirect("exchange_failed");
  }

  cookieStore.delete("insforge_code_verifier");

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
