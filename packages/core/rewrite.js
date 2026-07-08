// Turns an analysis result into a focused, rewritten prompt — deterministically,
// with no AI call. The strategy: preserve the developer's intent, then layer on
// the scoping scaffolding their prompt was missing (a starting point, a scope
// guard, and a report-back instruction).
//
// When a real project is on disk, `relevantFiles` are woven in so the rewrite
// names concrete files. Otherwise we insert a clearly-marked placeholder the
// developer can fill in.

import { analyzePrompt } from "./analyzer.js";
import { estimateTokens } from "./tokenizer.js";
import {
  MAX_EXPLORATION_TOKENS,
  MIN_EXPLORATION_TOKENS,
} from "./config.js";

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Ensure the intent sentence ends cleanly with a single period.
function normalizeIntent(prompt) {
  let s = prompt.trim().replace(/\s+/g, " ");
  if (!s) return s;
  s = capitalize(s);
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

/**
 * @param {object} analysis  result from analyzePrompt()
 * @param {object} [opts]
 * @param {string[]} [opts.relevantFiles]  files surfaced by the scanner
 * @param {object} [opts.projectContext] richer scan result
 * @returns {{ text: string, notes: string[] }}
 */
export function buildFocusedPrompt(analysis, opts = {}) {
  const projectContext = opts.projectContext || {};
  const relevantFiles = projectContext.files || opts.relevantFiles || [];
  const confidence = projectContext.confidence || (relevantFiles.length ? "medium" : "low");
  const subsystem = projectContext.subsystem || "";
  const has = (id) => analysis.issues.some((i) => i.id === id);
  const parts = [];

  // 1. Keep the original intent as the lead sentence.
  parts.push(normalizeIntent(analysis.prompt));

  // 2. Give the assistant a concrete starting point.
  if (!analysis.hasFileRef) {
    if (relevantFiles.length && confidence !== "low") {
      const list = relevantFiles.map((f) => `\`${f}\``).join(", ");
      parts.push(`Start with ${list}.`);
      if (subsystem) {
        parts.push(`This likely lives in the ${subsystem} flow.`);
      }
    } else {
      parts.push(
        "I couldn't confidently identify the responsible files from the repo scan. Name the screen, route, error, or symbol involved."
      );
    }
  }

  // 3. Add a scope guard when the prompt could sprawl.
  if (has("broad-scope") || has("heavy-change") || has("no-constraint") || has("vague-verb")) {
    parts.push(
      "Make the smallest change necessary. Do not refactor unrelated code."
    );
  }

  // 4. Ask for a short report of what changed — cheap and keeps output tight.
  parts.push("Briefly list what changed.");

  const text = parts.join(" ");

  return { text, notes: [] };
}

// Convenience: analyze + rewrite + compute projected savings in one call.
export function optimize(prompt, opts = {}) {
  const analysis = analyzePrompt(prompt, opts);
  const focused = buildFocusedPrompt(analysis, opts);

  // Re-analyze the rewritten prompt to project its (lower) token cost.
  const rewrittenAnalysis = analyzePrompt(focused.text, opts);
  const savedTokens = Math.max(
    0,
    analysis.projectedTokens - rewrittenAnalysis.projectedTokens
  );

  return {
    analysis,
    focused,
    rewrittenAnalysis,
    savedTokens,
    savedPct:
      analysis.projectedTokens > 0
        ? Math.round((savedTokens / analysis.projectedTokens) * 100)
        : 0,
  };
}

export { estimateTokens, MAX_EXPLORATION_TOKENS, MIN_EXPLORATION_TOKENS };
