// Terminal rendering for metriq. Boxes, bars, and the analysis report.

import { colors, severityColor } from "./colors.js";
import { dollarsFor } from "../../packages/core/config.js";

const RATING_STYLE = {
  focused: { color: colors.green, icon: "✓", label: "FOCUSED" },
  moderate: { color: colors.yellow, icon: "○", label: "MODERATE" },
  broad: { color: colors.red, icon: "⚠", label: "BROAD" },
};

const SEV_ICON = { high: "✕", medium: "!", low: "·" };

export function num(n) {
  return Number(n).toLocaleString("en-US");
}

export function money(n) {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

// A compact horizontal meter, e.g. breadth score.
export function bar(value, max = 100, width = 24) {
  const filled = Math.round((Math.min(value, max) / max) * width);
  const color =
    value >= 55 ? colors.red : value >= 25 ? colors.yellow : colors.green;
  return color("█".repeat(filled)) + colors.gray("░".repeat(width - filled));
}

// Wrap text to a width, preserving words.
export function wrap(text, width = 66, indent = "  ") {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      lines.push(line);
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines.map((l) => indent + l).join("\n");
}

function rule(char = "─", width = 60) {
  return colors.gray(char.repeat(width));
}

// The full analysis report for a single prompt.
export function renderAnalysis(result, opts = {}) {
  const { optimize, projectContext = {}, provider } = opts;
  const a = result;
  const relevantFiles = projectContext.files || [];
  const style = RATING_STYLE[a.rating] || RATING_STYLE.moderate;
  const out = [];

  out.push("");
  out.push(
    `${style.color(colors.bold(`${style.icon} ${style.label}`))}  ` +
      colors.gray(`breadth ${a.breadthScore}/100`)
  );
  out.push(`  ${bar(a.breadthScore)}`);
  out.push("");

  // Projected cost line.
  const dollars = provider ? dollarsFor(a.projectedTokens, provider) : null;
  out.push(
    colors.bold("  Cost  ") +
      `~${colors.cyan(num(a.projectedTokens))} tokens` +
      (dollars !== null ? colors.gray(`  ≈ ${money(dollars)}`) : "")
  );

  // Issues.
  if (a.issues.length) {
    out.push("");
    out.push(colors.bold("  Flags"));
    for (const issue of a.issues.slice(0, 3)) {
      const sc = severityColor[issue.severity] || colors.gray;
      out.push(`  ${sc(SEV_ICON[issue.severity] || "·")} ${issue.message}`);
    }
  } else {
    out.push("");
    out.push(colors.green("  ✓ Well scoped."));
  }

  // Relevant files (from scan) shown when we have them and the prompt lacked refs.
  if (relevantFiles.length && !a.hasFileRef) {
    out.push("");
    const confidence = projectContext.confidence
      ? ` ${colors.gray(`(${projectContext.confidence})`)}`
      : "";
    out.push(colors.bold("  Files") + confidence);
    for (const candidate of (projectContext.candidates || []).slice(0, 3)) {
      const reason = candidate.reasons?.[0]
        ? colors.gray(` — ${candidate.reasons[0]}`)
        : "";
      out.push(`  ${colors.magenta("▫")} ${candidate.file}${reason}`);
    }
  }

  // Optimized rewrite — only worth showing when it meaningfully helps.
  if (optimize && optimize.savedTokens < 100) {
    out.push("");
    out.push(rule());
    out.push(colors.green("  ✓ No rewrite needed."));
  } else if (optimize) {
    out.push("");
    out.push(rule());
    out.push(
      colors.green(colors.bold("  Suggestion")) +
        colors.gray(`   saves ~${num(optimize.savedTokens)} tokens`)
    );
    out.push("");
    out.push(colors.green(wrap(optimize.focused.text, 64, "  ")));
  }

  out.push("");
  return out.join("\n");
}

export function banner() {
  const name = colors.cyan(colors.bold("metriq"));
  return `${name} ${colors.gray("— prompt focus")}`;
}
