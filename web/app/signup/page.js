import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../lib/session";
import AuthShell from "../components/AuthShell";
import SignupForm from "./SignupForm";

export const metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }) {
  const params = await searchParams;
  const isDesktop = params?.desktop === "1";

  const session = await getSession();
  if (session) {
    // Same rationale as app/login/page.js: don't strand a desktop-flow user
    // on "/" just because a session cookie already exists in the system
    // browser — finish the metriq://auth-callback handoff instead.
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
          Already have an account?{" "}
          <a className="text-primary hover:underline" href={isDesktop ? "/login?desktop=1" : "/login"}>
            Log in
          </a>
        </p>
      }
      subtitle="Sign up to sync sessions across your terminal and the dashboard."
      title="Create an account"
    >
      <SignupForm />
    </AuthShell>
  );
}
