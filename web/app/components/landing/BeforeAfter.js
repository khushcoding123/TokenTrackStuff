"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

// Before/after comparison, upgraded from plain paragraphs to badge callouts:
// the issues on the vague side become flag chips, and the winning moves on the
// focused side (file reference, scope guard) are highlighted inline with a
// color-matched legend underneath. Copy is unchanged from the original card.

const ISSUE_CHIPS = ["vague verb", "no file reference", "broad scope"];

export default function BeforeAfter() {
  return (
    <section className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-20 md:pb-28">
      <Reveal>
        <div className="glass-card p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Before */}
          <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} className="flex flex-col gap-3">
            <span className="font-label-sm text-label-sm text-error uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              Before — breadth 80/100
            </span>
            <p className="font-label-md text-label-md text-on-surface bg-terminal-black rounded-lg p-4 border border-border-subtle">
              Fix the dashboard bug.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ISSUE_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="font-label-sm text-label-sm text-error border border-error/30 bg-error/10 rounded-full px-2.5 py-0.5"
                >
                  ✕ {chip}
                </span>
              ))}
              <span className="font-label-sm text-label-sm text-on-surface-variant border border-border-subtle rounded-full px-2.5 py-0.5">
                ~36K token full-project search
              </span>
            </div>
          </motion.div>

          {/* After */}
          <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} className="flex flex-col gap-3">
            <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              After — saves ~15K tokens
            </span>
            <p className="font-label-md text-label-md text-on-surface bg-terminal-black rounded-lg p-4 border border-border-subtle">
              Fix the dashboard bug. Check{" "}
              <span className="text-primary bg-primary/10 border border-primary/30 rounded px-1">
                `web/app/page.js`
              </span>
              . Make the smallest change necessary.{" "}
              <span className="text-secondary underline decoration-secondary/50 underline-offset-2">
                Do not refactor unrelated code.
              </span>{" "}
              Briefly list what changed.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="font-label-sm text-label-sm text-primary border border-primary/30 bg-primary/10 rounded-full px-2.5 py-0.5">
                ✓ file reference
              </span>
              <span className="font-label-sm text-label-sm text-secondary border border-secondary/30 bg-secondary/10 rounded-full px-2.5 py-0.5">
                ✓ scope guard
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant border border-border-subtle rounded-full px-2.5 py-0.5">
                bounds how far the AI wanders
              </span>
            </div>
          </motion.div>
        </div>
      </Reveal>
    </section>
  );
}
