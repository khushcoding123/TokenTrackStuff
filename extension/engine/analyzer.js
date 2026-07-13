// The prompt analysis engine.
//
// Given a raw prompt (and optional session history), it detects the patterns
// that make AI coding assistants waste tokens, produces a 0-100 "breadth score"
// (higher = broader = more wasteful), and projects how many tokens the prompt
// is likely to burn once the assistant starts exploring the codebase.
//
// Everything here is local, rule-based, and deterministic. No network, no keys.

import { estimateTokens } from "./tokenizer.js";
import {
  MAX_EXPLORATION_TOKENS,
  MIN_EXPLORATION_TOKENS,
} from "./config.js";

// --- Signal dictionaries ----------------------------------------------------

// Vague action verbs that describe intent without a concrete target.
const VAGUE_VERBS = [
  "fix", "improve", "optimize", "clean up", "cleanup", "enhance", "polish",
  "handle", "update", "tweak", "sort out", "deal with", "work on", "look into",
];

// Words that widen scope to large or unbounded areas of the codebase.
const BROAD_SCOPE = [
  "everything", "the whole", "entire", "all the", "the codebase", "the project",
  "the app", "the application", "the system", "the frontend", "the backend",
  "the ui", "the dashboard", "the site", "the website", "throughout",
  "across the", "anywhere", "wherever",
];

// Words that trigger large, sprawling changes.
const HEAVY_CHANGE = [
  "refactor", "redesign", "rewrite", "overhaul", "restructure", "rearchitect",
  "migrate", "modernize", "revamp", "rework", "clean up the whole",
];

// A prompt that references a file, path, or symbol is already fairly scoped.
const FILE_REF = /([\w./-]+\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|vue|svelte|css|scss|html|json|md))\b/i;
const PATH_REF = /(^|\s)(src|app|lib|components|pages|api|routes|packages|apps)[\\/][\w./-]+/i;
const CODE_REF = /`[^`]+`/; // backtick-wrapped symbol or identifier

// Explicit scope guards the developer might already include.
const HAS_CONSTRAINT =
  /(smallest change|do not refactor|don'?t refactor|only (change|modify|touch)|without (changing|touching)|minimal|just this|scope|leave .* unchanged)/i;

// --- Helpers ----------------------------------------------------------------

const includesAny = (text, phrases) =>
  phrases.filter((p) => text.includes(p));

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// --- Main analysis ----------------------------------------------------------

/**
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string[]} [opts.history] previously-seen prompts this session
 * @returns {object} analysis result
 */
export function analyzePrompt(prompt, opts = {}) {
  const raw = String(prompt || "").trim();
  const text = raw.toLowerCase();
  const words = raw.split(/\s+/).filter(Boolean);
  const history = opts.history || [];

  const issues = [];
  const add = (id, severity, weight, message, hint) =>
    issues.push({ id, severity, weight, message, hint });

  const hasFileRef = FILE_REF.test(raw) || PATH_REF.test(raw) || CODE_REF.test(raw);

  // 1. Vague action verb with no concrete target.
  const vague = includesAny(text, VAGUE_VERBS);
  if (vague.length && !hasFileRef) {
    add(
      "vague-verb",
      "high",
      22,
      `Vague instruction ("${vague[0]}") with no specific target.`,
      "Name the file, function, or exact behavior to change."
    );
  }

  // 2. Broad scope language.
  const broad = includesAny(text, BROAD_SCOPE);
  if (broad.length) {
    add(
      "broad-scope",
      "high",
      24,
      `Broad scope ("${broad[0]}") — likely to trigger a full-project search.`,
      "Point at the specific area or files involved."
    );
  }

  // 3. Heavy / sprawling change verbs.
  const heavy = includesAny(text, HEAVY_CHANGE);
  if (heavy.length) {
    add(
      "heavy-change",
      "medium",
      16,
      `Large-change verb ("${heavy[0]}") can cause unrelated rewrites.`,
      "Constrain it: smallest change necessary, no unrelated refactors."
    );
  }

  // 4. No file / path / symbol reference at all.
  if (!hasFileRef) {
    add(
      "no-file-ref",
      "medium",
      14,
      "No file, path, or symbol referenced — the assistant must go find it.",
      "Add a starting point, e.g. `Dashboard.tsx` or `src/api/usage.ts`."
    );
  }

  // 5. Too short to be actionable.
  if (words.length > 0 && words.length < 5) {
    add(
      "too-short",
      "medium",
      12,
      `Very short prompt (${words.length} words) — likely ambiguous.`,
      "Add the what, where, and any constraints."
    );
  }

  // 6. Overly long / context-dumping prompt.
  const promptTokens = estimateTokens(raw);
  if (promptTokens > 500) {
    add(
      "excessive-context",
      "low",
      8,
      `Long prompt (~${promptTokens} tokens) — may include unnecessary context.`,
      "Trim to the essentials the assistant actually needs."
    );
  }

  // 7. No explicit scope guard.
  if (!HAS_CONSTRAINT.test(raw) && (vague.length || broad.length || heavy.length)) {
    add(
      "no-constraint",
      "low",
      8,
      "No scope guard — nothing stops the assistant from wandering.",
      'Add: "Make the smallest change necessary; don\'t refactor unrelated code."'
    );
  }

  // 8. Repeated / near-duplicate of an earlier prompt this session.
  const repeated = history.find((h) => similarity(h, raw) > 0.85);
  if (repeated) {
    add(
      "repeated",
      "medium",
      12,
      "Near-duplicate of an earlier prompt — risk of repeating work.",
      "Reference the previous result instead of starting over."
    );
  }

  // --- Score & projections --------------------------------------------------

  const rawScore = issues.reduce((s, i) => s + i.weight, 0);
  const breadthScore = clamp(Math.round(rawScore), 0, 100);

  // Project total tokens the prompt is likely to burn: prompt text + an
  // exploration cost that scales with breadth.
  let exploration =
    MIN_EXPLORATION_TOKENS +
    (MAX_EXPLORATION_TOKENS - MIN_EXPLORATION_TOKENS) * (breadthScore / 100);

  // Two things genuinely bound how far the assistant wanders — and they're
  // exactly what a good rewrite adds. Reward them multiplicatively so an
  // optimized prompt projects a realistically lower cost.
  const hasConstraint = HAS_CONSTRAINT.test(raw);
  if (hasFileRef) exploration *= 0.45; // a concrete starting point
  if (hasConstraint) exploration *= 0.6; // an explicit scope guard
  exploration = Math.round(Math.max(MIN_EXPLORATION_TOKENS, exploration));

  const projectedTokens = promptTokens + exploration;

  return {
    prompt: raw,
    empty: raw.length === 0,
    words: words.length,
    hasFileRef,
    issues: issues.sort((a, b) => b.weight - a.weight),
    breadthScore,
    rating: ratingFor(breadthScore),
    promptTokens,
    explorationTokens: exploration,
    projectedTokens,
  };
}

export function ratingFor(score) {
  if (score >= 55) return "broad";
  if (score >= 25) return "moderate";
  return "focused";
}

// Rough token-set Jaccard similarity for duplicate detection.
function similarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter++;
  return inter / (setA.size + setB.size - inter);
}
