import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import SessionsClient from "./SessionsClient";

export const metadata = { title: "Sessions" };

export default function SessionsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar active="sessions" />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <TopBar searchPlaceholder="Search sessions…" />
        <SessionsClient />
      </div>
    </div>
  );
}
