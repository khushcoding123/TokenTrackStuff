"use client";

import { useState } from "react";

export default function InstallCommand({
  command = "npx metriq@latest start",
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be blocked; fail silently.
    }
  };

  // Split the command so we can highlight the package name.
  return (
    <div className="install" role="group" aria-label="Install command">
      <span className="prompt">$</span>
      <span className="cmd">
        npx <span className="hl">metriq@latest</span> start
      </span>
      <button
        className={`copy-btn${copied ? " copied" : ""}`}
        onClick={copy}
        aria-label="Copy install command"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
