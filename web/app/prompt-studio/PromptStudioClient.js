"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyzePrompt } from "../../../packages/core/analyzer.js";
import { optimize } from "../../../packages/core/rewrite.js";
import { PROVIDERS, DEFAULT_PROVIDER, dollarsFor } from "../../../packages/core/config.js";
import { useToast } from "../components/ToastProvider";
import EditorPanel from "./EditorPanel";

const DEFAULT_PROMPT = `You are an expert data analyst AI.
Your primary directive is to process raw JSON telemetry and output actionable insights.

Constraints:
- Always use concise, professional language.
- Do not hallucinate metrics.
- If data is missing, explicitly state "Insufficient telemetry".

Context: Analyzing server load distribution across regional nodes.`;

function reasoningFor(issueCount) {
  if (issueCount === 0) return { label: "High", note: "No scope issues found" };
  if (issueCount <= 2) return { label: "Medium", note: `${issueCount} scope issue(s) remain` };
  return { label: "Low", note: `${issueCount} scope issues remain` };
}

export default function PromptStudioClient() {
  const { notify } = useToast();
  const [promptText, setPromptText] = useState(DEFAULT_PROMPT);
  const [temperature, setTemperature] = useState("0.2");
  const [feedback, setFeedback] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const menuRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem("metriq:provider");
    if (stored && PROVIDERS[stored]) setProvider(stored);
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setRevisionsOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const analysis = useMemo(() => analyzePrompt(promptText), [promptText]);
  const optimized = useMemo(() => optimize(promptText), [promptText]);
  const reasoning = reasoningFor(analysis.issues.length);
  const specificity = Math.max(0, 100 - analysis.breadthScore);
  const dollarsSaved = dollarsFor(optimized.savedTokens, provider);

  const pushRevision = () => {
    setRevisions((prev) =>
      [{ id: Date.now(), text: promptText, at: new Date(), breadthScore: analysis.breadthScore }, ...prev].slice(0, 10)
    );
  };

  const handleRunEvaluation = () => {
    setEvaluating(true);
    window.setTimeout(() => {
      setEvaluating(false);
      pushRevision();
      setLastEvaluation({
        passed: analysis.breadthScore < 55,
        latencyMs: Math.round(analysis.promptTokens * 3 + 200),
        at: new Date(),
      });
      notify(`Evaluation complete — breadth ${analysis.breadthScore}/100`);
    }, 600);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      notify("Copied to clipboard");
    } catch {
      notify("Clipboard unavailable in this browser");
    }
  };

  const handleMagic = () => {
    if (promptText.trim() === optimized.focused.text.trim()) {
      notify("Prompt is already focused");
      return;
    }
    pushRevision();
    setPromptText(optimized.focused.text);
    notify(`Optimized — saves ~${optimized.savedPct}% (${optimized.savedTokens} tokens)`);
  };

  const handleFeedback = (value) => {
    setFeedback((prev) => (prev === value ? null : value));
    notify("Thanks for your feedback!");
  };

  const restoreRevision = (rev) => {
    setPromptText(rev.text);
    setRevisionsOpen(false);
    notify(`Restored revision from ${rev.at.toLocaleTimeString()}`);
  };

  return (
    <div className="flex-1 overflow-auto p-gutter max-w-container-max mx-auto w-full flex flex-col gap-stack-lg">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Prompt Studio</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Optimize and evaluate LLM instructions.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative" ref={menuRef}>
            <button
              className="glass-card px-4 py-2 flex items-center gap-2 text-on-surface font-label-md text-label-md hover:bg-surface-container-high"
              onClick={() => setRevisionsOpen((v) => !v)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              Revisions{revisions.length > 0 ? ` (${revisions.length})` : ""}
            </button>
            {revisionsOpen && (
              <div className="absolute right-0 mt-2 w-80 glass-card p-2 shadow-lg z-50 max-h-80 overflow-auto">
                {revisions.length === 0 ? (
                  <p className="px-2 py-2 font-body-sm text-body-sm text-on-surface-variant">
                    Run an evaluation or optimize a prompt to start tracking revisions.
                  </p>
                ) : (
                  revisions.map((rev) => (
                    <button
                      className="w-full text-left px-2 py-2 rounded hover:bg-surface-container-highest transition-colors"
                      key={rev.id}
                      onClick={() => restoreRevision(rev)}
                      type="button"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md text-on-surface">
                          {rev.at.toLocaleTimeString()}
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          breadth {rev.breadthScore}
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{rev.text}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            className="bg-primary-container text-on-primary-container px-4 py-2 rounded-lg font-label-md text-label-md font-bold flex items-center gap-2 hover:bg-primary transition-colors border-t border-white/20 disabled:opacity-60"
            disabled={evaluating}
            onClick={handleRunEvaluation}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              {evaluating ? "progress_activity" : "play_arrow"}
            </span>
            {evaluating ? "Evaluating…" : "Run Evaluation"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div className="glass-card p-4 flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-xl" />
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm uppercase">
            <span>Specificity Score</span>
            <span className="material-symbols-outlined text-[16px] text-primary">target</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-display text-on-surface">{specificity}</span>
            <span className="font-body-md text-body-md text-primary">breadth {analysis.breadthScore}/100</span>
          </div>
          <div className="w-full bg-surface-container-highest h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary-container to-primary h-full rounded-full"
              style={{ width: `${specificity}%` }}
            />
          </div>
        </div>

        <div className="glass-card p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm uppercase">
            <span>Token Savings</span>
            <span className="material-symbols-outlined text-[16px] text-secondary">data_usage</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-display text-on-surface">{optimized.savedPct}%</span>
            <span className="font-body-md text-body-md text-on-surface-variant">if optimized</span>
          </div>
          <div className="font-label-sm text-label-sm text-secondary mt-2">
            ~{optimized.savedTokens} tokens · ${dollarsSaved.toFixed(4)} ({PROVIDERS[provider].label})
          </div>
        </div>

        <div className="glass-card p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm uppercase">
            <span>Model Reasoning</span>
            <span className="material-symbols-outlined text-[16px] text-tertiary">psychology</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-display text-on-surface">{reasoning.label}</span>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant mt-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-tertiary" /> {reasoning.note}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-px bg-border-subtle rounded-xl overflow-hidden glass-card min-h-[500px]">
        <EditorPanel
          onChange={setPromptText}
          onCopy={handleCopy}
          onMagic={handleMagic}
          tokenCount={analysis.promptTokens}
          value={promptText}
        />

        <div className="bg-surface-glass flex flex-col h-full relative">
          <div className="h-10 flex items-center justify-between px-4 border-b border-border-subtle bg-surface-container-highest/50">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-secondary">output</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Model Response (gpt-4-turbo)
              </span>
            </div>
            <select
              className="bg-transparent border-none text-label-sm font-label-sm text-on-surface-variant focus:ring-0 py-0 pr-6"
              onChange={(e) => setTemperature(e.target.value)}
              value={temperature}
            >
              <option value="0.2">Temperature: 0.2</option>
              <option value="0.7">Temperature: 0.7</option>
              <option value="1.0">Temperature: 1.0</option>
            </select>
          </div>

          <div className="flex-1 p-6 font-body-md text-body-md text-on-surface overflow-auto leading-relaxed">
            <p className="mb-4">Analysis of Regional Server Load Telemetry:</p>
            <div className="bg-terminal-black border border-border-subtle rounded p-3 font-label-md text-label-md text-primary/90 mb-4">
              <span className="text-secondary">&quot;us-east-1&quot;</span>: 84% utilization (Critical)
              <br />
              <span className="text-secondary">&quot;eu-west-2&quot;</span>: 42% utilization (Nominal)
              <br />
              <span className="text-secondary">&quot;ap-south-1&quot;</span>: 12% utilization (Underutilized)
            </div>
            <p className="mb-2">
              <strong>Actionable Insights:</strong>
            </p>
            <ul className="list-disc pl-5 space-y-1 text-on-surface-variant">
              <li>Immediate load balancing required from us-east-1 to eu-west-2 to mitigate critical utilization.</li>
              <li>Consider downscaling resources in ap-south-1 to optimize compute costs.</li>
            </ul>
          </div>

          <div className="w-full p-4 bg-gradient-to-t from-background via-surface-glass to-transparent pt-12 border-t border-border-subtle/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-label-sm text-label-sm">
                <span
                  className={`px-2 py-1 rounded border ${
                    !lastEvaluation
                      ? "bg-surface-container-highest text-on-surface-variant border-border-subtle"
                      : lastEvaluation.passed
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-error/10 text-error border-error/20"
                  }`}
                >
                  {!lastEvaluation
                    ? "Not yet evaluated"
                    : lastEvaluation.passed
                      ? "Passed Guidelines"
                      : "Needs Scope"}
                </span>
                <span className="px-2 py-1 bg-surface-container-highest text-on-surface-variant rounded">
                  Latency: {lastEvaluation ? `${lastEvaluation.latencyMs}ms` : "—"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    feedback === "up" ? "bg-primary/20" : "bg-surface-container-highest hover:bg-border-subtle"
                  }`}
                  onClick={() => handleFeedback("up")}
                  title="Thumbs up"
                  type="button"
                >
                  <span
                    className={`material-symbols-outlined text-[16px] ${feedback === "up" ? "text-primary" : "text-on-surface-variant"}`}
                  >
                    thumb_up
                  </span>
                </button>
                <button
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    feedback === "down" ? "bg-error/20" : "bg-surface-container-highest hover:bg-border-subtle"
                  }`}
                  onClick={() => handleFeedback("down")}
                  title="Thumbs down"
                  type="button"
                >
                  <span
                    className={`material-symbols-outlined text-[16px] ${feedback === "down" ? "text-error" : "text-on-surface-variant"}`}
                  >
                    thumb_down
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
