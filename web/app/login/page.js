import { redirect } from "next/navigation";
import { getSession } from "../lib/session";
import AuthShell from "../components/AuthShell";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/account");

  return (
    <AuthShell
      footer={
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Don&apos;t have an account?{" "}
          <a className="text-primary hover:underline" href="/signup">
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
