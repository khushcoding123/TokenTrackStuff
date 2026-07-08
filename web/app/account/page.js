import { redirect } from "next/navigation";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { getSession } from "../lib/session";
import LogoutButton from "./LogoutButton";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");

  const displayName = session.profile?.name || session.email;
  const provider = session.providers?.includes("google") ? "Google" : "Email";

  return (
    <div className="flex min-h-screen">
      <Sidebar active="account" />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <TopBar searchPlaceholder="Search…" />

        <div className="flex-1 p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto w-full">
          <div className="mb-stack-xl">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Account</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Your Metriq identity — used to sign in from the CLI and the dashboard alike.
            </p>
          </div>

          <div className="glass-card p-6 max-w-xl flex flex-col gap-stack-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/15 border border-border-subtle flex items-center justify-center text-primary overflow-hidden">
                {session.profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="w-full h-full object-cover" src={session.profile.avatar_url} />
                ) : (
                  <span className="material-symbols-outlined">person</span>
                )}
              </div>
              <div>
                <div className="font-headline-md text-headline-md text-on-surface">{displayName}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">{session.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              Signed in with {provider}
            </div>

            <div className="border-t border-border-subtle pt-stack-md">
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
