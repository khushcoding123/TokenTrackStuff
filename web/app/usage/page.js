import Sidebar from "../components/Sidebar";
import UsageClient from "./UsageClient";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default function UsagePage() {
  return (
    <div className="min-h-screen bg-mesh">
      <Sidebar active="usage" />
      <main className="md:pl-64 min-h-screen">
        <div className="px-margin-mobile md:px-margin-desktop py-8">
          <UsageClient />
        </div>
      </main>
    </div>
  );
}
