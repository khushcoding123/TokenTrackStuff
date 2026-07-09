import OptimizeClient from "./OptimizeClient";

export const metadata = { title: "Optimize" };

// Self-contained page: after the "web is marketing-only" refactor the shared
// dashboard chrome (Sidebar/TopBar) no longer exists, so this page carries its
// own minimal header instead of depending on deleted components.
export default function OptimizePage() {
  return (
    <div className="min-h-screen flex flex-col bg-mesh">
      <header className="border-b border-border-subtle px-margin-mobile md:px-margin-desktop py-4 flex items-center gap-2">
        <a className="flex items-center gap-2" href="/">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-on-primary font-bold">
            M
          </div>
          <span className="font-headline-md text-headline-md font-bold text-primary leading-none">
            Metriq
          </span>
        </a>
        <span className="font-label-md text-label-md text-on-surface-variant">· Optimize</span>
      </header>
      <OptimizeClient />
    </div>
  );
}
