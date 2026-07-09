const NAV_ITEMS = [
  { key: "usage", label: "Dashboard", href: "/usage", icon: "space_dashboard" },
  { key: "prompt-studio", label: "Prompt Studio", href: "/prompt-studio", icon: "bolt" },
  { key: "sessions", label: "Sessions", href: "/sessions", icon: "history" },
  { key: "sustainability", label: "Sustainability", href: "/sustainability", icon: "eco" },
  // ?landing=1 bypasses the auto-redirect to /usage for signed-in users.
  { key: "overview", label: "Landing page", href: "/?landing=1", icon: "home" },
];

const FOOTER_ITEMS = [
  {
    key: "docs",
    label: "Docs",
    href: "https://github.com/khushcoding123/TokenTrackStuff#readme",
    icon: "description",
    external: true,
  },
  { key: "support", label: "Support", href: "mailto:kotharikhush0@gmail.com", icon: "help" },
  { key: "account", label: "Account", href: "/account", icon: "account_circle" },
  { key: "settings", label: "Settings", href: "/settings", icon: "settings" },
];

function NavLink({ item, isActive }) {
  return (
    <a
      className={
        isActive
          ? "flex items-center gap-3 px-4 py-3 rounded-lg text-primary font-bold border-r-2 border-primary bg-primary/10 transition-colors duration-200 active:scale-95"
          : "flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant font-medium hover:bg-surface-container-highest transition-colors duration-200 active:scale-95"
      }
      href={item.href}
    >
      <span
        className="material-symbols-outlined text-[20px]"
        style={{ fontVariationSettings: `'FILL' ${isActive ? 1 : 0}` }}
      >
        {item.icon}
      </span>
      {item.label}
    </a>
  );
}

export default function Sidebar({ active }) {
  return (
    <nav className="hidden md:flex flex-col h-full py-stack-lg fixed w-64 left-0 top-0 bg-surface-container-low border-r border-border-subtle z-40">
      <div className="px-6 mb-stack-xl flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-on-primary font-bold">
          M
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-primary leading-none">
            Metriq
          </h1>
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            v0.1.0
          </span>
        </div>
      </div>

      <ul className="flex-1 px-4 space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <NavLink item={item} isActive={active === item.key} />
          </li>
        ))}
      </ul>

      <div className="px-4 space-y-1 pt-stack-md border-t border-border-subtle">
        {FOOTER_ITEMS.map((item) => (
          <a
            key={item.key}
            className={
              active === item.key
                ? "flex items-center gap-3 px-4 py-3 rounded-lg text-primary font-bold border-r-2 border-primary bg-primary/10 transition-colors duration-200 active:scale-95"
                : "flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant font-medium hover:bg-surface-container-highest transition-colors duration-200 active:scale-95"
            }
            href={item.href}
            rel={item.external ? "noreferrer noopener" : undefined}
            target={item.external ? "_blank" : undefined}
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
