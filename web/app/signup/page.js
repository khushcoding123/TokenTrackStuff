import { redirect } from "next/navigation";
import { getSession } from "../lib/session";
import SignupForm from "./SignupForm";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/account");

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh px-margin-mobile relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center gap-3 justify-center mb-stack-xl">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary font-bold">
            M
          </div>
          <h1 className="font-headline-md text-headline-md font-bold text-primary leading-none">Metriq</h1>
        </div>

        <div className="glass-card p-8">
          <h2 className="font-headline-lg text-headline-lg text-on-background mb-1">Create an account</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-lg">
            Sign up to sync sessions across your terminal and the dashboard.
          </p>
          <SignupForm />
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-stack-lg text-center">
            Already have an account?{" "}
            <a className="text-primary hover:underline" href="/login">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
