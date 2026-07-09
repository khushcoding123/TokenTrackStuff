import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import OptimizeClient from "./OptimizeClient";

export const metadata = { title: "Optimize" };

export default function OptimizePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar active="optimize" />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <TopBar searchPlaceholder="Optimize a prompt…" />
        <OptimizeClient />
      </div>
    </div>
  );
}
