import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import PromptStudioClient from "./PromptStudioClient";

export const metadata = { title: "Prompt Studio" };

export default function PromptStudioPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar active="prompt-studio" />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <TopBar searchPlaceholder="Search prompts, models…" />
        <PromptStudioClient />
      </div>
    </div>
  );
}
