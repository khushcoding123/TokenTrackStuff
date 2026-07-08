// Shared two-panel layout for /login and /signup: a brand panel on the left
// (hidden on mobile), the form on the right. Plain Server Component — no
// client state needed here.
export default function AuthShell({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-mesh items-center justify-center p-12">
        <a
          className="absolute top-6 left-6 w-10 h-10 rounded-full bg-surface-glass border border-border-subtle flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:border-primary/50 transition-colors"
          href="/"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </a>
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[450px] h-[450px] bg-secondary-container/10 rounded-full blur-[110px] pointer-events-none" />

        <div className="relative z-10 max-w-sm text-center flex flex-col items-center gap-stack-lg">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold text-2xl">
            M
          </div>
          <h2 className="font-display text-headline-lg text-on-background leading-tight">
            Stop burning tokens on <span className="gradient-text">vague prompts.</span>
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Metriq checks your prompt against your real codebase before it ever reaches Claude, ChatGPT, Cursor, or
            VS Code.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-margin-mobile md:px-margin-desktop py-stack-xl relative overflow-hidden">
        <div className="md:hidden absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="w-full max-w-sm relative z-10">
          <div className="md:hidden flex items-center gap-3 justify-center mb-stack-xl">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary font-bold">
              M
            </div>
            <span className="font-headline-md text-headline-md font-bold text-primary leading-none">Metriq</span>
          </div>

          <h1 className="font-headline-lg text-headline-lg text-on-background mb-1">{title}</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-lg">{subtitle}</p>

          {children}

          {footer && <div className="mt-stack-lg text-center">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
