import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";

// GET so the "Continue with Google" button can be a plain link/navigation.
export async function GET(request) {
  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });

  const isDesktop = request.nextUrl.searchParams.get("desktop") === "1";
  const errorRedirect = isDesktop ? "/login?desktop=1&error=oauth_start_failed" : "/login?error=oauth_start_failed";

  // redirectTo must exactly match an entry in InsForge's allowed-redirect-
  // URLs list (registered via insforge.toml [auth].allowed_redirect_urls) —
  // an unregistered query string makes signInWithOAuth reject it with
  // INVALID_INPUT (confirmed via a live test). Both the bare callback and
  // the ?desktop=1 variant are registered, so this is safe. InsForge relays
  // this exact string verbatim through its Google -> api.insforge.dev ->
  // <project>.insforge.app -> back-to-us hop chain (confirmed by decoding
  // its own state JWT), so the flag survives that chain by construction.
  const callbackPath = isDesktop ? "/api/auth/callback?desktop=1" : "/api/auth/callback";
  const redirectTo = new URL(callbackPath, process.env.NEXT_PUBLIC_APP_URL).toString();
  console.log("[metriq-desktop-debug] /api/auth/google", { isDesktop, redirectTo });

  const { data, error } = await auth.signInWithOAuth("google", {
    redirectTo,
    skipBrowserRedirect: true,
  });

  if (error || !data?.url || !data?.codeVerifier) {
    console.log("[metriq-desktop-debug] /api/auth/google oauth_start_failed", { isDesktop, error });
    return NextResponse.redirect(new URL(errorRedirect, request.url));
  }

  cookieStore.set("insforge_code_verifier", data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  // Fallback signal, kept in case some intermediary strips query strings on
  // the redirectTo URL: same isDesktop flag, via a first-party cookie.
  if (isDesktop) {
    cookieStore.set("insforge_oauth_desktop", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }

  return NextResponse.redirect(data.url);
}
