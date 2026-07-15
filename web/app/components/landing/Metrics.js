"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import Reveal from "./Reveal";

// Impact metrics with a count-up on scroll (adapted from the 21st.dev
// "animated number counter" pattern). Deliberately capability figures from
// the analysis engine — the before/after example and the README benchmark —
// NOT adoption/user statistics, and footnoted as such.

const METRICS = [
  {
    to: 15,
    prefix: "~",
    suffix: "K",
    label: "tokens saved per rewrite",
    sub: "focused rewrite vs. the vague original",
  },
  {
    to: 80,
    suffix: "%",
    label: "avg. breadth reduction",
    sub: "vague prompt scope, narrowed to real files",
  },
  {
    to: 84,
    suffix: "%",
    label: "exploration cost cut",
    sub: "projected tokens the AI never has to burn",
  },
  {
    to: 0,
    label: "network calls",
    sub: "analysis is 100% local and offline",
  },
];

function CountUp({ to, prefix = "", suffix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? to : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, reduced]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function Metrics() {
  return (
    <section className="relative w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-20 md:pb-28">
      <div
        aria-hidden
        className="absolute inset-x-0 top-1/4 h-1/2 bg-primary/5 blur-[100px] rounded-full pointer-events-none"
      />
      <Reveal>
        <span className="block text-center font-label-sm text-label-sm text-primary uppercase tracking-wider mb-3">
          Impact
        </span>
        <h2 className="font-headline-lg text-headline-lg text-on-background text-center mb-stack-xl">
          Built to make every prompt cheaper
        </h2>
      </Reveal>
      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {METRICS.map((m, i) => (
          <Reveal key={m.label} delay={i * 0.1}>
            <motion.div
              whileHover={{ y: -5 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="glass-card relative overflow-hidden p-6 flex flex-col gap-2 h-full"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
              />
              <span className="font-label-md text-4xl md:text-5xl font-semibold text-primary leading-none">
                <CountUp to={m.to} prefix={m.prefix} suffix={m.suffix} />
              </span>
              <span className="font-headline-md text-headline-md text-on-surface mt-1">{m.label}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{m.sub}</span>
            </motion.div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.2}>
        <p className="mt-6 text-center font-body-sm text-body-sm text-on-surface-variant/70">
          Representative capability figures from Metriq's offline analysis engine. Not usage statistics.
        </p>
      </Reveal>
    </section>
  );
}
