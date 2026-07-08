import { redirect } from "next/navigation";
import { getSession } from "../lib/session";
import AuthShell from "../components/AuthShell";
import SignupForm from "./SignupForm";

export const metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }) {
  const session = await getSession();
  if (session) redirect("/account");

  const params = await searchParams;
  const isDesktop = params?.desktop === "1";

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
