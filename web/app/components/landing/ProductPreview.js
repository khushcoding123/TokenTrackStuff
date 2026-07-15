"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";

// A faithful miniature of the desktop app's Prompt Studio, in a window-frame
// mockup (21st.dev "browser/window mockup" pattern, hand-rolled). It plays a
// looping two-beat sequence once scrolled into view:
//
//   Beat 1 — the app itself: icon-rail sidebar + an idle Prompt Studio pane,
//            so it reads as a real product, not an illustration.
//   Beat 2 — the rewrite in action: the vague prompt types in, analysis flags
//            light up, then the focused rewrite types out with the file
//            reference and scope guard highlighted, ending on the savings pill.
//
// The mockup's inner colors are hardcoded on purpose: they mirror the desktop
// app's dark-only design tokens (desktop/DESIGN.md §1 — #0A0B0D shell,
// #0C0E11 canvas, #121417 surface, #34D399 accent) so the "screenshot" stays
// true to the product in both web themes, exactly like a real screenshot would.

const VAGUE = "Fix the dashboard bug.";

const REWRITE_SEGMENTS = [
  { text: "Fix the dashboard bug. Check " },
  { text: "web/app/page.js", kind: "file" },
  { text: ". Make the smallest change necessary. " },
  { text: "Do not refactor unrelated code.", kind: "guard" },
  { text: " Briefly list what changed." },
];
const REWRITE_LEN = REWRITE_SEGMENTS.reduce((n, s) => n + s.text.length, 0);

const ISSUES = ["vague verb", "no file reference", "broad scope"];

// Sidebar mirrors the desktop app's real nav order (Overview, Prompt Studio,
// Projects, Tools, Usage, Impact, Settings). Prompt Studio is active.
const RAIL = [
  { icon: "space_dashboard", label: "Overview" },
  { icon: "edit_note", label: "Prompt Studio", active: true },
  { icon: "folder_open", label: "Projects" },
  { icon: "handyman", label: "Tools" },
  { icon: "monitoring", label: "Usage" },
  { icon: "eco", label: "Impact" },
  { icon: "settings", label: "Settings" },
];

const TYPE_MS = 38; // per-char, vague prompt (deliberate, human-ish)
const REWRITE_MS = 14; // per-char, rewrite (fast — the tool is doing it)

// Render `count` characters across the highlight segments.
function TypedSegments({ count }) {
  const out = [];
  let remaining = count;
  for (let i = 0; i < REWRITE_SEGMENTS.length && remaining > 0; i++) {
    const seg = REWRITE_SEGMENTS[i];
    const take = seg.text.slice(0, remaining);
    remaining -= seg.text.length;
    if (seg.kind === "file") {
      out.push(
        <span key={i} className="text-[#34D399] bg-[#34D399]/10 border border-[#34D399]/30 rounded px-1">
          {take}
        </span>
      );
    } else if (seg.kind === "guard") {
      out.push(
        <span key={i} className="text-[#6C8EF5] underline decoration-[#6C8EF5]/50 underline-offset-2">
          {take}
        </span>
      );
    } else {
      out.push(<span key={i}>{take}</span>);
    }
  }
  return out;
}

function Caret() {
  return (
    <motion.span
      aria-hidden
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      className="inline-block w-[7px] h-[13px] align-[-2px] bg-[#34D399] ml-[1px]"
    />
  );
}

export default function ProductPreview() {
  const frameRef = useRef(null);
  const inView = useInView(frameRef, { amount: 0.3 });
  const reduced = useReducedMotion();

  // Phase machine: app → typing → analyze → rewrite → hold → (reset) app
  const [phase, setPhase] = useState("app");
  const [vagueCount, setVagueCount] = useState(0);
  const [rewriteCount, setRewriteCount] = useState(0);

  // With reduced motion preferred, skip the show and pin the final frame.
  const effPhase = reduced ? "hold" : phase;
  const effVague = reduced ? VAGUE.length : vagueCount;
  const effRewrite = reduced ? REWRITE_LEN : rewriteCount;
  const stage = ["app", "typing", "analyze", "rewrite", "hold"].indexOf(effPhase);

  // Dwell-phase scheduler (pauses whenever the frame scrolls out of view).
  useEffect(() => {
    if (!inView || reduced) return;
    let t;
    if (phase === "app") t = setTimeout(() => setPhase("typing"), 1700);
    else if (phase === "analyze") t = setTimeout(() => setPhase("rewrite"), 1500);
    else if (phase === "hold")
      t = setTimeout(() => {
        setVagueCount(0);
        setRewriteCount(0);
        setPhase("app");
      }, 3400);
    return () => clearTimeout(t);
  }, [phase, inView, reduced]);

  // Typewriter: vague prompt.
  useEffect(() => {
    if (phase !== "typing" || !inView || reduced) return;
    const id = setInterval(() => setVagueCount((c) => Math.min(c + 1, VAGUE.length)), TYPE_MS);
    return () => clearInterval(id);
  }, [phase, inView, reduced]);
  useEffect(() => {
    if (phase !== "typing" || vagueCount < VAGUE.length) return;
    const t = setTimeout(() => setPhase("analyze"), 500);
    return () => clearTimeout(t);
  }, [phase, vagueCount]);

  // Typewriter: focused rewrite.
  useEffect(() => {
    if (phase !== "rewrite" || !inView || reduced) return;
    const id = setInterval(() => setRewriteCount((c) => Math.min(c + 1, REWRITE_LEN)), REWRITE_MS);
    return () => clearInterval(id);
  }, [phase, inView, reduced]);
  useEffect(() => {
    if (phase !== "rewrite" || rewriteCount < REWRITE_LEN) return;
    const t = setTimeout(() => setPhase("hold"), 400);
    return () => clearTimeout(t);
  }, [phase, rewriteCount]);

  return (
    <div className="w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-20 md:pb-28">
      <motion.div
        initial={{ opacity: 0, y: 56, rotateX: 9, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        style={{ perspective: 1200, transformStyle: "preserve-3d" }}
        className="relative max-w-4xl mx-auto"
      >
        {/* Glow bed under the window */}
        <div
          aria-hidden
          className="absolute -inset-x-8 -bottom-10 top-1/3 rounded-full bg-primary/15 blur-[90px] pointer-events-none"
        />

        <div
          ref={frameRef}
          className="relative rounded-xl border border-white/10 bg-[#0A0B0D] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] overflow-hidden text-left"
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 h-9 border-b border-white/[0.07] bg-[#0A0B0D]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F2545C]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#F0A93A]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]/80" />
            <span className="flex-1 text-center font-label-sm text-[11px] text-[#9CA3AE] tracking-wide">
              Metriq Prompt Studio
            </span>
            <span className="font-label-sm text-[10px] text-[#6B7280] border border-white/10 rounded px-1.5 py-0.5">
              ⌘⇧M
            </span>
          </div>

          <div className="flex min-h-[380px]">
            {/* Icon rail — mirrors the desktop sidebar */}
            <div className="w-12 shrink-0 border-r border-white/[0.07] bg-[#0A0B0D] py-3 flex flex-col items-center gap-1">
              {RAIL.map((r) => (
                <div
                  key={r.label}
                  title={r.label}
                  className={`relative w-8 h-8 rounded-lg flex items-center justify-center ${
                    r.active ? "bg-white/[0.09] text-[#34D399]" : "text-[#6B7280]"
                  }`}
                >
                  {r.active && (
                    <span className="absolute left-[-8px] w-[3px] h-4 rounded-full bg-[#34D399]" />
                  )}
                  <span className="material-symbols-outlined text-[17px]">{r.icon}</span>
                </div>
              ))}
            </div>

            {/* Prompt Studio pane */}
            <div className="flex-1 bg-[#0C0E11] p-4 md:p-5 flex flex-col gap-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-label-sm text-[10px] uppercase tracking-[0.08em] text-[#6B7280]">
                  Prompt Studio
                </span>
                <span className="font-label-sm text-[10px] text-[#9CA3AE] border border-white/10 rounded-full px-2 py-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                  linked: tokentrack
                </span>
              </div>

              {/* Prompt input */}
              <div className="rounded-lg border border-white/10 bg-[#121417] px-3 py-2.5 min-h-[52px]">
                <div className="font-label-sm text-[10px] uppercase tracking-[0.08em] text-[#6B7280] mb-1">
                  Your prompt
                </div>
                <div className="font-label-md text-[13px] text-[#EDEEF0] leading-relaxed">
                  {effVague > 0 ? (
                    <>
                      {VAGUE.slice(0, effVague)}
                      {effPhase === "typing" && <Caret />}
                    </>
                  ) : (
                    <span className="text-[#6B7280]">Draft your prompt…</span>
                  )}
                </div>
              </div>

              {/* Analysis row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2 min-w-[150px] flex-1">
                  <span className="font-label-sm text-[10px] uppercase tracking-[0.08em] text-[#6B7280]">
                    Breadth
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[#F0A93A] to-[#F2545C]"
                      initial={false}
                      animate={{ width: stage >= 2 ? "80%" : "0%" }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <AnimatePresence>
                    {stage >= 2 && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="font-label-sm text-[11px] text-[#F0A93A] tabular-nums"
                      >
                        80/100
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <AnimatePresence>
                  {stage >= 2 && (
                    <motion.span
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="font-label-sm text-[11px] text-[#9CA3AE] tabular-nums"
                    >
                      ~36K tokens projected
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Issue chips */}
              <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                <AnimatePresence>
                  {stage >= 2 &&
                    ISSUES.map((issue, i) => (
                      <motion.span
                        key={issue}
                        initial={{ opacity: 0, scale: 0.8, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: i * 0.14, type: "spring", stiffness: 400, damping: 24 }}
                        className="font-label-sm text-[10px] text-[#F0A93A] border border-[#F0A93A]/30 bg-[#F0A93A]/10 rounded-full px-2 py-0.5"
                      >
                        ✕ {issue}
                      </motion.span>
                    ))}
                </AnimatePresence>
              </div>

              {/* Focused rewrite panel */}
              <div className="rounded-lg border border-[#34D399]/25 bg-[#121417] px-3 py-2.5 flex-1 min-h-[104px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-sm text-[10px] uppercase tracking-[0.08em] text-[#34D399]">
                    Focused rewrite
                  </span>
                  <AnimatePresence>
                    {stage >= 4 && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="font-label-sm text-[10px] text-[#06120C] bg-[#34D399] rounded-full px-2 py-0.5 font-semibold"
                      >
                        ✓ saves ~15K tokens
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="font-label-md text-[13px] text-[#EDEEF0] leading-relaxed break-words">
                  {effRewrite > 0 ? (
                    <>
                      <TypedSegments count={effRewrite} />
                      {effPhase === "rewrite" && <Caret />}
                    </>
                  ) : (
                    <span className="text-[#6B7280]">
                      {stage >= 2 ? "Rewriting…" : "The focused rewrite will appear here."}
                    </span>
                  )}
                </div>
                <AnimatePresence>
                  {stage >= 4 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-2 flex items-center gap-2"
                    >
                      <span className="font-label-sm text-[10px] text-[#06120C] bg-[#34D399] rounded px-2 py-1 font-semibold cursor-default">
                        Copy to clipboard
                      </span>
                      <span className="font-label-sm text-[10px] text-[#6B7280]">
                        file reference + scope guard included
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
