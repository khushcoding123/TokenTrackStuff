"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

// Compact single-row callout, not a full section — the desktop app is the
// primary product (see CLAUDE.md), so this stays low-key: one banner, no
// heading, no card grid. Links to the extension's folder in the repo since
// it isn't published to the Chrome Web Store yet (same "GitHub as
// placeholder destination" pattern the desktop download buttons use).
const EXTENSION_URL = "https://github.com/khushcoding123/TokenTrackStuff/tree/main/extension";

export default function BrowserExtension() {
  return (
    <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-20 md:pb-28">
      <Reveal>
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="glass-card p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">extension</span>
            </div>
            <div>
              <p className="font-headline-md text-headline-md text-on-surface">
                Also works as a Chrome extension
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Prefer the browser? Rewrite prompts right inside ChatGPT, Claude, Gemini, and more, no
                install of the desktop app required.
              </p>
            </div>
          </div>
          <a
            href={EXTENSION_URL}
            rel="noreferrer noopener"
            target="_blank"
            className="shrink-0 font-label-md text-label-md text-primary border border-primary/30 bg-primary/10 hover:bg-primary/15 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Get the extension
          </a>
        </motion.div>
      </Reveal>
    </section>
  );
}
