import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";

// GET so the "Continue with Google" button can be a plain link/navigation.
export async function GET(request) {
  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });

  const isDesktop = request.nextUrl.searchParams.get("desktop") === "1";
  const errorRedirect = isDesktop ? "/login?desktop=1&error=oauth_start_failed" : "/login?error=oauth_start_failed";

  const redirectTo = new URL("/api/auth/callback", process.env.NEXT_PUBLIC_APP_URL).toString();
  const { data, error } = await auth.signInWithOAuth("google", {
    redirectTo,
    skipBrowserRedirect: true,
  });

  if (error || !data?.url || !data?.codeVerifier) {
    return NextResponse.redirect(new URL(errorRedirect, request.url));
  }

  cookieStore.set("insforge_code_verifier", data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  // Remember this was a desktop-app handoff so the callback route knows to
  // hand back a bearer token via /desktop-connected instead of just
  // redirecting into the web dashboard.
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
