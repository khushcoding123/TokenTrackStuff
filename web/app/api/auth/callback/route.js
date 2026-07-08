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
  const desktopFromQuery = request.nextUrl.searchParams.get("desktop") === "1";
  const desktopFromCookie = cookieStore.get("insforge_oauth_desktop")?.value === "1";
  const isDesktop = desktopFromQuery || desktopFromCookie;
  console.log("[metriq-desktop-debug] /api/auth/callback", {
    desktopFromQuery,
    desktopFromCookie,
    isDesktop,
    hasCode: Boolean(code),
    oauthError,
  });
  const errorRedirect = (reason) =>
    NextResponse.redirect(new URL(isDesktop ? `/login?desktop=1&error=${reason}` : `/login?error=${reason}`, request.url));

  if (oauthError || !code) {
    return errorRedirect("oauth_failed");
  }

  const codeVerifier = cookieStore.get("insforge_code_verifier")?.value;
  console.log("[metriq-desktop-debug] /api/auth/callback codeVerifier", { hasCodeVerifier: Boolean(codeVerifier) });
  if (!codeVerifier) {
    return errorRedirect("missing_verifier");
  }

  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.exchangeOAuthCode(code, codeVerifier);

  if (error || !data?.accessToken) {
    console.log("[metriq-desktop-debug] /api/auth/callback exchange_failed", {
      error: error ? { message: error.message, statusCode: error.statusCode, name: error.name } : null,
      hasAccessToken: Boolean(data?.accessToken),
    });
    return errorRedirect("exchange_failed");
  }

  console.log("[metriq-desktop-debug] /api/auth/callback exchange_ok", {
    hasUser: Boolean(data.user),
    userEmail: data.user?.email,
  });

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
