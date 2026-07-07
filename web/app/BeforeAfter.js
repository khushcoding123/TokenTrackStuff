"use client";

import { useState } from "react";

// A faithful recreation of real `tokenpilot analyze` output for the flagship
// example, toggled between the vague prompt and the focused rewrite.
export default function BeforeAfter() {
  const [tab, setTab] = useState("before");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div className="toggle" role="tablist" aria-label="Prompt comparison">
          <button
            role="tab"
            aria-selected={tab === "before"}
            className={tab === "before" ? "active bad" : ""}
            onClick={() => setTab("before")}
          >
            Vague prompt
          </button>
          <button
            role="tab"
            aria-selected={tab === "after"}
            className={tab === "after" ? "active good" : ""}
            onClick={() => setTab("after")}
          >
            TokenPilot rewrite
          </button>
        </div>
      </div>

      <div className="terminal">
        <div className="term-bar">
          <span className="term-dot r" />
          <span className="term-dot y" />
          <span className="term-dot g" />
          <span className="term-title">tokenpilot analyze</span>
        </div>
        <div className="term-body">
          {tab === "before" ? <Before /> : <After />}
        </div>
      </div>
    </div>
  );
}

function L({ children }) {
  return <div className="line">{children}</div>;
}

function Before() {
  return (
    <>
      <L>
        <span className="c-dim">$ </span>
        <span className="c-white">tokenpilot analyze </span>
        <span className="c-yellow">&quot;Fix the dashboard bug&quot;</span>
      </L>
      <L>{" "}</L>
      <L>
        <span className="c-red">⚠ BROAD</span>
        <span className="c-dim">  breadth 80/100</span>
      </L>
      <L>
        <span className="c-red">  ███████████████████</span>
        <span className="c-dim">░░░░░</span>
      </L>
      <L>{" "}</L>
      <L>
        <span className="c-white">  Projected cost  </span>
        <span className="c-cyan">~36,165 tokens</span>
        <span className="c-dim">  ≈ $0.22</span>
      </L>
      <L>{" "}</L>
      <L>
        <span className="c-white">  Issues</span>
      </L>
      <L>
        <span className="c-red">  ✕ </span>
        <span className="c-white">Broad scope (&quot;the dashboard&quot;) — likely full-project search.</span>
      </L>
      <L>
        <span className="c-red">  ✕ </span>
        <span className="c-white">Vague instruction (&quot;fix&quot;) with no specific target.</span>
      </L>
      <L>
        <span className="c-yellow">  ! </span>
        <span className="c-white">No file or symbol referenced — the assistant must go find it.</span>
      </L>
    </>
  );
}

function After() {
  return (
    <>
      <L>
        <span className="c-green">  ✓ Suggested prompt</span>
        <span className="c-dim">   saves ~25,801 tokens (84%)</span>
      </L>
      <L>{" "}</L>
      <L>
        <span className="c-green">  Fix the dashboard bug related to token usage.</span>
      </L>
      <L>
        <span className="c-green">  Begin by checking </span>
        <span className="c-cyan">`src/Dashboard.tsx`</span>
        <span className="c-green">,</span>
      </L>
      <L>
        <span className="c-cyan">  `src/usageApi.ts`</span>
        <span className="c-green">, </span>
        <span className="c-cyan">`src/tokenCalc.ts`</span>
        <span className="c-green">. Do not redesign</span>
      </L>
      <L>
        <span className="c-green">  the UI or refactor unrelated components. Make the</span>
      </L>
      <L>
        <span className="c-green">  smallest change necessary. Briefly explain which</span>
      </L>
      <L>
        <span className="c-green">  files you modified and why.</span>
      </L>
      <L>{" "}</L>
      <L>
        <span className="c-dim">  · Added likely-relevant files from a project scan.</span>
      </L>
      <L>
        <span className="c-dim">  · Added a scope guard to prevent unrelated changes.</span>
      </L>
    </>
  );
}
