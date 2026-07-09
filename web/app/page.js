import { redirect } from "next/navigation";
import { getSession } from "./lib/session";
import { getClaudeDirs } from "../../src/core/usage/claude.js";
import { getCodexSessionsDir } from "../../src/core/usage/codex.js";

// The auto-open check below reads cookies + the local filesystem per request.
export const dynamic = "force-dynamic";

const RELEASES_URL = "https://github.com/khushcoding123/TokenTrackStuff/releases";

const STEPS = [
  {
    icon: "folder_open",
    title: "Link your project",
    body: "Point Metriq at a local folder (or a GitHub repo). It scans your real files so it knows what actually exists.",
  },
  {
    icon: "edit_note",
    title: "Draft your prompt",
    body: "Write what you're about to send to Claude, ChatGPT, Cursor, or VS Code — right inside Metriq first.",
  },
  {
    icon: "bolt",
    title: "Get instant feedback",
    body: "Metriq flags vague or broad instructions, estimates the token cost, and hands you a focused rewrite to paste in.",
  },
];

export const metadata = { title: "Metriq — Focus your prompts before you send them" };

export default async function LandingPage({ searchParams }) {
  // Opening the app should land you straight on the dashboard: anyone who is
  // signed in, or running this locally where agent logs exist, is a user of
  // the product — not a visitor who needs the marketing pitch. ?landing=1
  // (the sidebar's "Landing page" link) always shows this page.
  if (searchParams?.landing !== "1") {
    let isUser = false;
    try {
      isUser = Boolean(await getSession());
    } catch {
      /* auth backend unreachable — fall through to the local-logs check */
    }
    if (!isUser) {
      try {
        isUser = getClaudeDirs().length > 0 || Boolean(getCodexSessionsDir());
      } catch {
        /* filesystem unavailable (deployed edge) — show the landing page */
      }
    }
    if (isUser) redirect("/usage");
  }

  return (
    <div className="min-h-screen flex flex-col bg-mesh relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-5%] w-[500px] h-[500px] bg-secondary-container/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary font-bold">
            M
          </div>
          <span className="font-headline-md text-headline-md font-bold text-primary leading-none">Metriq</span>
        </div>
        <nav className="flex items-center gap-2 md:gap-4">
          <a
            className="bg-primary/10 border border-primary text-primary px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-primary/20 transition-all duration-300"
            href={RELEASES_URL}
            rel="noreferrer noopener"
            target="_blank"
          >
            Download
          </a>
        </nav>
      </header>

      <main className="flex-1 relative z-10">
        {/* Hero */}
        <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-16 pb-20 md:pt-24 md:pb-28 flex flex-col items-center text-center gap-stack-lg">
          <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider border border-primary/30 bg-primary/10 rounded-full px-3 py-1">
            AI coding companion
          </span>
          <h1 className="font-display text-headline-lg-mobile md:text-display text-on-background max-w-3xl leading-tight tracking-tight">
            Stop burning tokens on <span className="gradient-text">vague prompts.</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
            Metriq analyzes your prompt against your real codebase before it ever reaches Claude, ChatGPT, Cursor,
            or VS Code, flagging what's too broad and rewriting it into something focused, so your AI tool
            doesn't waste tokens searching the whole project.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
            <a
              className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-md text-label-md hover:opacity-90 transition-all duration-300 flex items-center gap-2"
              href={RELEASES_URL}
              rel="noreferrer noopener"
              target="_blank"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download for macOS
            </a>
            {[
              { os: "Windows", icon: "desktop_windows" },
              { os: "Linux", icon: "dns" },
            ].map((d) => (
              <a
                key={d.os}
                className="bg-primary/10 border border-primary text-primary px-6 py-3 rounded-lg font-label-md text-label-md hover:bg-primary/20 transition-all duration-300 flex items-center gap-2"
                href={RELEASES_URL}
                rel="noreferrer noopener"
                target="_blank"
              >
                <span className="material-symbols-outlined text-[18px]">{d.icon}</span>
                Download for {d.os}
              </a>
            ))}
          </div>
        </section>

        {/* Before / after */}
        <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-20 md:pb-28">
          <div className="glass-card p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-3">
              <span className="font-label-sm text-label-sm text-error uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                Before — breadth 80/100
              </span>
              <p className="font-label-md text-label-md text-on-surface bg-terminal-black rounded-lg p-4 border border-border-subtle">
                Fix the dashboard bug.
              </p>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Vague verb, no file reference, broad scope — likely to trigger a full-project search (~36K
                tokens).
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                After — saves ~15K tokens
              </span>
              <p className="font-label-md text-label-md text-on-surface bg-terminal-black rounded-lg p-4 border border-border-subtle">
                Fix the dashboard bug. Check <span className="text-primary">`web/app/page.js`</span>. Make the
                smallest change necessary. Do not refactor unrelated code. Briefly list what changed.
              </p>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Concrete starting point + scope guard — exactly what bounds how far the AI wanders.
              </span>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-20 md:pb-28">
          <h2 className="font-headline-lg text-headline-lg text-on-background text-center mb-stack-xl">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {STEPS.map((step, i) => (
              <div key={step.title} className="glass-card p-6 flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">{step.icon}</span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant/70">Step {i + 1}</span>
                <h3 className="font-headline-md text-headline-md text-on-surface">{step.title}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{step.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border-subtle/50 relative z-10">
        <span className="font-body-sm text-body-sm text-on-surface-variant">© {new Date().getFullYear()} Metriq</span>
        <div className="flex items-center gap-6">
          <a
            className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
            href="https://github.com/khushcoding123/TokenTrackStuff#readme"
            rel="noreferrer noopener"
            target="_blank"
          >
            Docs
          </a>
          <a
            className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
            href="https://github.com/khushcoding123/TokenTrackStuff"
            rel="noreferrer noopener"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
