"use client";

import { useEffect, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle";

const NOTIFICATIONS = [
  { title: "New CLI release", detail: "metriq 0.2.0-preview adds duplicate-prompt detection." },
  { title: "Weekly digest ready", detail: "Your token-savings summary for this week is available." },
];

export default function TopBar({ searchPlaceholder = "Search…", mobileTitle = "Metriq" }) {
  const [openMenu, setOpenMenu] = useState(null); // "notifications" | "status" | "profile" | null
  const containerRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = (menu) => setOpenMenu((current) => (current === menu ? null : menu));

  return (
    <header
      ref={containerRef}
      className="sticky top-0 w-full h-16 flex justify-between items-center px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto z-30 border-b border-border-subtle/30 backdrop-blur-md bg-background/80"
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="md:hidden font-headline-md text-headline-md font-bold text-primary">{mobileTitle}</div>
        <div className="hidden md:flex items-center gap-2 text-on-surface-variant bg-surface-glass border border-border-subtle rounded-lg px-3 py-1.5 focus-within:border-secondary-container focus-within:ring-1 focus-within:ring-secondary-container transition-all w-64">
          <span className="material-symbols-outlined text-[20px]">search</span>
          <input
            className="bg-transparent border-none focus:ring-0 text-body-md font-body-md text-on-surface w-full placeholder:text-on-surface-variant/50 p-0"
            placeholder={searchPlaceholder}
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />

        <div className="relative">
          <button
            className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer opacity-90 hover:opacity-100 flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-glass relative"
            onClick={() => toggle("notifications")}
            type="button"
          >
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
          </button>
          {openMenu === "notifications" && (
            <div className="absolute right-0 mt-2 w-72 glass-card p-2 shadow-lg z-50">
              <div className="px-2 py-1 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Notifications
              </div>
              {NOTIFICATIONS.map((n) => (
                <div key={n.title} className="px-2 py-2 rounded hover:bg-surface-container-highest transition-colors">
                  <div className="font-label-md text-label-md text-on-surface">{n.title}</div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant">{n.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className="text-primary hover:text-primary transition-colors cursor-pointer opacity-90 hover:opacity-100 flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-glass"
            onClick={() => toggle("status")}
            type="button"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              cloud_done
            </span>
          </button>
          {openMenu === "status" && (
            <div className="absolute right-0 mt-2 w-64 glass-card p-3 shadow-lg z-50">
              <div className="font-label-md text-label-md text-on-surface mb-1">Local-only</div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Metriq runs entirely offline. Session data stays on this machine at{" "}
                <code className="text-primary">~/.metriq/session.json</code> — nothing is uploaded.
              </p>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className="w-8 h-8 rounded-full bg-primary/15 border border-border-subtle ml-1 flex items-center justify-center text-primary cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => toggle("profile")}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </button>
          {openMenu === "profile" && (
            <div className="absolute right-0 mt-2 w-48 glass-card p-2 shadow-lg z-50">
              <a
                className="block px-3 py-2 rounded font-label-md text-label-md text-on-surface hover:bg-surface-container-highest transition-colors"
                href="/settings"
              >
                Settings
              </a>
              <a
                className="block px-3 py-2 rounded font-label-md text-label-md text-on-surface hover:bg-surface-container-highest transition-colors"
                href="https://github.com/khushcoding123/TokenTrackStuff"
                rel="noreferrer noopener"
                target="_blank"
              >
                View on GitHub
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
