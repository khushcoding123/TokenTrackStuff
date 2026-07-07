import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import SettingsForm from "./SettingsForm";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar active="settings" />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <TopBar searchPlaceholder="Search settings…" />

        <div className="flex-1 p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto w-full">
          <div className="mb-stack-xl">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Settings</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Preferences are stored locally in your browser — no account required.
            </p>
          </div>
          <SettingsForm />
        </div>
      </div>
    </div>
  );
}
