import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import UsageClient from "./UsageClient";

export const metadata = { title: "Usage — Metriq" };

export default function UsagePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar active="usage" />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <TopBar searchPlaceholder="Search usage…" />
        <UsageClient />
      </div>
    </div>
  );
}
