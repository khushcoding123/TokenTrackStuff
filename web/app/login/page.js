import { redirect } from "next/navigation";
import { getSession } from "../lib/session";
import AuthShell from "../components/AuthShell";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }) {
  const session = await getSession();
  if (session) redirect("/usage");

  const params = await searchParams;
  const isDesktop = params?.desktop === "1";

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
