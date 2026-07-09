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

  // createAuthActions() strips accessToken/refreshToken out of `data` by
  // design (see sanitizeAuthData in @insforge/sdk/ssr) — it writes them into
  // insforge_access_token/insforge_refresh_token cookies instead. `data.user`
  // is the only reliable success signal here; the real token (needed only
  // for the desktop handoff) is read back from the cookie below.
  if (error || !data?.user) {
    console.log("[metriq-desktop-debug] /api/auth/callback exchange_failed", {
      error: error ? { message: error.message, statusCode: error.statusCode, name: error.name } : null,
      hasUser: Boolean(data?.user),
    });
    return errorRedirect("exchange_failed");
  }

  cookieStore.delete("insforge_code_verifier");

  if (isDesktop) {
    cookieStore.delete("insforge_oauth_desktop");
    const token = cookieStore.get("insforge_access_token")?.value;
    console.log("[metriq-desktop-debug] /api/auth/callback exchange_ok", { hasToken: Boolean(token) });
    if (!token) {
      return errorRedirect("exchange_failed");
    }
    const params = new URLSearchParams({ token });
    const refreshToken = cookieStore.get("insforge_refresh_token")?.value;
    if (refreshToken) params.set("refresh_token", refreshToken);
    params.set("email", data.user.email);
    if (data.user.profile?.name) params.set("name", data.user.profile.name);
    return NextResponse.redirect(new URL(`/desktop-connected?${params.toString()}`, request.url));
  }

  return NextResponse.redirect(new URL("/", request.url));
}
