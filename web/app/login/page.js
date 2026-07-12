import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../lib/session";
import AuthShell from "../components/AuthShell";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const isDesktop = params?.desktop === "1";

  const session = await getSession();
  if (session) {
    // A session cookie can already exist in the system browser (e.g. the
    // user logged in on the web before). Don't just bounce to "/" here —
    // the desktop app is waiting on the metriq://auth-callback handoff, and
    // "/" has no way back to it. Same handoff shape as the OAuth callback
    // route (app/api/auth/callback/route.js).
    if (isDesktop) {
      const cookieStore = await cookies();
      const token = cookieStore.get("insforge_access_token")?.value;
      if (token) {
        const handoff = new URLSearchParams({ token });
        const refreshToken = cookieStore.get("insforge_refresh_token")?.value;
        if (refreshToken) handoff.set("refresh_token", refreshToken);
        handoff.set("email", session.email);
        if (session.profile?.name) handoff.set("name", session.profile.name);
        redirect(`/desktop-connected?${handoff.toString()}`);
      }
    }
    redirect("/");
  }

  return (
    <AuthShell
      footer={
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Don&apos;t have an account?{" "}
          <a className="text-primary hover:underline" href={isDesktop ? "/signup?desktop=1" : "/signup"}>
            Sign up
          </a>
        </p>
      }
      subtitle="Welcome back. Enter your credentials to continue."
      title="Log in"
    >
      <LoginForm />
    </AuthShell>
  );
}
