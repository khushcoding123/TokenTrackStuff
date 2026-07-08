import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";

// GET so the "Continue with Google" button can be a plain link/navigation.
export async function GET(request) {
  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });

  const isDesktop = request.nextUrl.searchParams.get("desktop") === "1";
  const errorRedirect = isDesktop ? "/login?desktop=1&error=oauth_start_failed" : "/login?error=oauth_start_failed";

  // Primary signal: encode the flag directly into the redirectTo URL we hand
  // InsForge. InsForge relays this exact string through its own OAuth state
  // (Google -> api.insforge.dev -> <project>.insforge.app -> back to us),
  // so it survives that chain by construction instead of depending on a
  // cookie surviving in parallel across three third-party hops.
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
