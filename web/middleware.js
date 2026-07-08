import { NextResponse } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";

// Refreshes the InsForge session cookies before Server Components render,
// so account pages never see a stale/expired access token.
export async function middleware(request) {
  const response = NextResponse.next({ request });

  await updateSession({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
