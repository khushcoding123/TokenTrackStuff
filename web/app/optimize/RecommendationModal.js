"use client";

// The recommendation popup. Shown after analysis; presents the original prompt,
// the improved prompt, the relevant files chosen, the token-saving explanation,
// and the three actions. Styling matches the app's glass-card modal pattern.

import { useEffect } from "react";
import { useToast } from "../components/ToastProvider";

export default function RecommendationModal({ data, onClose, onUse }) {
  const { notify } = useToast();

  // Close on Escape, like the other modals in the app.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!data) return null;

  const { originalPrompt, improvedPrompt, relevantFiles, tokenSaving, analysis } = data;

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(label);
    } catch {
      notify("Clipboard unavailable in this browser");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-3xl max-h-[86vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Prompt optimization recommendation"
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">auto_fix_high</span>
            <h2 className="font-headline-md text-headline-md text-on-surface">Focused prompt ready</h2>
          </div>
          <div className="flex items-center gap-2">
            {tokenSaving.savedTokens > 0 && (
              <span className="font-label-sm text-label-sm text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
                ↓ {tokenSaving.savedPct}% · ~{tokenSaving.savedTokens.toLocaleString()} tokens
              </span>
            )}
            <button
              className="text-on-surface-variant hover:text-on-surface"
              onClick={onClose}
              aria-label="Close"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* body */}
        <div className="overflow-auto p-5 flex flex-col gap-5">
          {/* token saving explanation */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[18px]">savings</span>
              <span className="font-label-md text-label-md text-on-surface">Why this saves tokens</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">{tokenSaving.reason}</p>
          </div>

          {/* improved prompt (the star) */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-label-md text-label-md text-on-surface">Improved prompt</h3>
              <button
                className="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1"
                onClick={() => copy(improvedPrompt, "Improved prompt copied")}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span> Copy
              </button>
            </div>
            <div className="bg-surface-container-high/60 border border-primary/30 rounded-lg p-4 font-body-md text-body-md text-on-surface whitespace-pre-wrap">
              {improvedPrompt}
            </div>
          </section>

          {/* relevant files */}
          <section>
            <h3 className="font-label-md text-label-md text-on-surface mb-2">
              Relevant files {relevantFiles.length > 0 && <span className="text-on-surface-variant">({relevantFiles.length})</span>}
            </h3>
            {relevantFiles.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                No specific files matched. The improved prompt still adds a starting point and scope guard — connect a repo or name the feature for file-level targeting.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {relevantFiles.map((f) => (
                  <li
                    key={f.path}
                    className="flex items-start justify-between gap-3 bg-surface-glass border border-border-subtle rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="font-label-md text-label-md text-on-surface truncate" title={f.path}>
                        {f.path}
                      </div>
                      {f.reasons.length > 0 && (
                        <div className="font-label-sm text-label-sm text-on-surface-variant">
                          {f.reasons.join(" · ")}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 font-label-sm text-label-sm text-secondary mono">
                      {f.score}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* original prompt (collapsed context) */}
          <section>
            <h3 className="font-label-md text-label-md text-on-surface-variant mb-2">Original prompt</h3>
            <div className="bg-surface/40 border border-border-subtle rounded-lg p-3 font-body-sm text-body-sm text-on-surface-variant whitespace-pre-wrap">
              {originalPrompt}
            </div>
            {analysis?.rating && (
              <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">
                Scored <span className="text-on-surface">{analysis.rating}</span> (breadth {analysis.breadthScore}/100)
                {analysis.issues?.[0] && <> · {analysis.issues[0].message}</>}
              </p>
            )}
          </section>
        </div>

        {/* footer actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-subtle bg-surface/30">
          <button
            className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface px-4 py-2 rounded-lg transition-colors"
            onClick={onClose}
            type="button"
          >
            Dismiss
          </button>
          <button
            className="font-label-md text-label-md text-on-surface bg-surface-glass border border-border-subtle hover:border-primary/50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            onClick={() => copy(improvedPrompt, "Improved prompt copied")}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span> Copy Improved Prompt
          </button>
          <button
            className="font-label-md text-label-md text-on-primary bg-primary hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            onClick={() => {
              copy(improvedPrompt, "Improved prompt copied — paste it into your AI tool");
              onUse?.(improvedPrompt);
            }}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">check</span> Use This Prompt
          </button>
        </div>
      </div>
    </div>
  );
}
