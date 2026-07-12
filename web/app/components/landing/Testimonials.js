"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

// Testimonial marquee, styled after 21st.dev's popular "Infinite Moving
// Cards" pattern: two rows of duplicated cards sliding in opposite
// directions (CSS keyframes in globals.css — .animate-marquee, paused on
// hover), with Framer Motion handling the section's scroll-reveal and each
// card's hover lift/scale.
//
// Deliberately NOT attributed to named/pictured people — Metriq is
// pre-launch with no real user base yet, and inventing named reviewers
// would misrepresent them as genuine customer quotes. Every card is
// labeled "Illustrative example." Swap for real quotes once there are
// actual users to quote.

const EXAMPLES = [
  {
    quote:
      "“Fix the dashboard bug” was burning a full-project search every time. Naming the file up front cut that prompt down to a fraction of the tokens.",
    context: "Working in a mid-size React codebase",
  },
  {
    quote:
      "The breadth score catches it before I hit send — broad, vague prompts get flagged with the exact file to point the AI at instead.",
    context: "Refactoring a Node/Express API",
  },
  {
    quote:
      "The scope guard alone stopped a handful of prompts from turning into unrelated file-wide rewrites I didn't ask for.",
    context: "Maintaining a shared component library",
  },
  {
    quote:
      "Rewriting the prompt to reference the real file path instead of describing it in words made the whole exchange cheaper and faster.",
    context: "Debugging a Python data pipeline",
  },
  {
    quote:
      "Seeing the projected token cost before sending changed how I write prompts — shorter, more specific, less exploration.",
    context: "Building a Next.js dashboard",
  },
  {
    quote:
      "Instead of the AI searching the whole monorepo, the rewrite pointed it straight at the two files that mattered.",
    context: "Working across a large monorepo",
  },
];

const ROW_ONE = EXAMPLES.slice(0, 3);
const ROW_TWO = EXAMPLES.slice(3);

function Card({ ex }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="glass-card w-[320px] md:w-[380px] shrink-0 p-6 flex flex-col gap-4"
    >
      <span className="font-label-sm text-label-sm text-primary/60 border border-primary/20 bg-primary/5 rounded-full px-2.5 py-0.5 w-fit">
        Illustrative example
      </span>
      <span className="material-symbols-outlined text-[28px] text-primary/40">format_quote</span>
      <p className="font-body-md text-body-md text-on-surface leading-relaxed">{ex.quote}</p>
      <span className="font-label-sm text-label-sm text-on-surface-variant/70 border-t border-border-subtle pt-3">
        {ex.context}
      </span>
    </motion.div>
  );
}

function MarqueeRow({ items, direction = "left", duration = 38 }) {
  const track = [...items, ...items]; // duplicated for a seamless loop
  return (
    <div
      className="group relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div
        className="animate-marquee flex gap-6 w-max"
        style={{
          "--marquee-duration": `${duration}s`,
          "--marquee-direction": direction === "left" ? "-50%" : "50%",
        }}
      >
        {track.map((ex, i) => (
          <Card key={`${ex.context}-${i}`} ex={ex} />
        ))}
      </div>
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="w-full pb-20 md:pb-28 overflow-hidden">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
        <Reveal>
          <span className="block text-center font-label-sm text-label-sm text-primary uppercase tracking-wider mb-3">
            In practice
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-background text-center mb-2">
            What token savings looks like
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant/70 text-center mb-stack-xl max-w-xl mx-auto">
            Metriq is pre-launch — these are illustrative scenarios based on the analysis engine's real
            behavior, not quotes from real users.
          </p>
        </Reveal>
      </div>
      <Reveal delay={0.1}>
        <div className="flex flex-col gap-6">
          <MarqueeRow items={ROW_ONE} direction="left" duration={38} />
          <MarqueeRow items={ROW_TWO} direction="right" duration={44} />
        </div>
      </Reveal>
    </section>
  );
}
