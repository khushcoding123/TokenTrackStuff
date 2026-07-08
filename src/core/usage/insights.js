// Deterministic insight heuristics for the usage dashboard.
//
// Every insight is computed from the aggregate payload with fixed thresholds
// (no randomness, no network) so the same logs always produce the same
// recommendations — consistent with the analyzer's determinism guarantee.
//
// Shape: { id, severity: "high"|"medium"|"info", title, evidence, action,
//          link? } sorted high → info.

const SEVERITY_ORDER = { high: 0, medium: 1, info: 2 };

function fmtTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function fmtUSD(n) {
  return `$${n.toFixed(2)}`;
}

/**
 * Generate ranked insights from an aggregate() payload.
 * @param {object} agg output of aggregate()
 * @param {object} [rateLimits] latest Codex rate-limit snapshot (or null)
 */
export function generateInsights(agg, rateLimits = null) {
  const insights = [];
  const { totals, sessions, models, blocks } = agg;
  if (!totals.totalTokens) return insights;

  const contextTokens =
    totals.inputTokens + totals.cacheCreationTokens + totals.cacheReadTokens;

  // 1. Cache efficiency — reads vs all context tokens.
  const cacheHitRate = contextTokens > 0 ? totals.cacheReadTokens / contextTokens : 0;
  if (contextTokens > 100_000) {
    if (cacheHitRate < 0.4) {
      insights.push({
        id: "low-cache-hit",
        severity: "high",
        title: "Low cache efficiency",
        evidence: `Only ${Math.round(cacheHitRate * 100)}% of your ${fmtTokens(contextTokens)} context tokens were served from cache. Uncached input is billed at full price.`,
        action:
          "Keep working sessions continuous instead of taking long breaks mid-session (caches expire after ~5 minutes of inactivity), and avoid restarting the CLI mid-task.",
      });
    } else if (cacheHitRate > 0.75) {
      insights.push({
        id: "good-cache-hit",
        severity: "info",
        title: "Caching is working well",
        evidence: `${Math.round(cacheHitRate * 100)}% of context tokens came from cache, saving roughly ${fmtUSD(totals.cacheSavingsUSD)} vs uncached pricing.`,
        action: "No change needed — your session rhythm keeps the prompt cache warm.",
      });
    }
  }

  // 2. Input:output ratio — broad exploration reads far more than it writes.
  const freshInput = totals.inputTokens + totals.cacheCreationTokens;
  if (totals.outputTokens > 5_000 && freshInput / Math.max(totals.outputTokens, 1) > 15) {
    const ratio = Math.round(freshInput / totals.outputTokens);
    insights.push({
      id: "high-input-ratio",
      severity: "high",
      title: "The AI is reading far more than it writes",
      evidence: `${ratio}× more fresh input tokens (${fmtTokens(freshInput)}) than output tokens (${fmtTokens(totals.outputTokens)}). That usually means broad prompts sending the agent on codebase-wide searches.`,
      action:
        "Scope prompts to specific files and add guards like \"only change X\". Run prompts through Prompt Studio before sending them.",
      link: "/prompt-studio",
    });
  }

  // 3. Expensive outlier sessions — > 3× the average session cost.
  if (sessions.length >= 5) {
    const avgCost =
      sessions.reduce((s, x) => s + x.costUSD, 0) / sessions.length;
    const outliers = sessions
      .filter((s) => avgCost > 0 && s.costUSD > avgCost * 3 && s.costUSD > 1)
      .slice(0, 2);
    for (const s of outliers) {
      insights.push({
        id: `outlier-${s.sessionId}`,
        severity: "medium",
        title: `Expensive session in ${s.project}`,
        evidence: `Session ${s.sessionId.slice(0, 8)}… consumed ${fmtTokens(s.totalTokens)} tokens (~${fmtUSD(s.costUSD)}), over 3× your session average of ${fmtUSD(avgCost)}.`,
        action:
          "Long sessions accumulate context that gets re-sent with every request. Split big tasks into separate, focused sessions.",
      });
    }
  }

  // 4. Model mix — flag heavy premium-model share.
  const premium = models.filter((m) => /opus/i.test(m.model));
  const premiumCost = premium.reduce((s, m) => s + m.costUSD, 0);
  if (totals.costUSD > 5 && premiumCost / totals.costUSD > 0.6) {
    insights.push({
      id: "premium-model-mix",
      severity: "medium",
      title: "Most spend is on the premium model",
      evidence: `${Math.round((premiumCost / totals.costUSD) * 100)}% of estimated cost (${fmtUSD(premiumCost)}) came from Opus-class models.`,
      action:
        "Route routine edits and simple questions to Sonnet/Haiku-class models and save the premium model for hard reasoning tasks.",
    });
  }

  // 5. Session-limit pressure — 5h blocks vs your own typical block.
  const nonEmpty = blocks.filter((b) => b.totalTokens > 0);
  if (nonEmpty.length >= 3) {
    const sortedTok = nonEmpty.map((b) => b.totalTokens).sort((a, b) => a - b);
    const median = sortedTok[Math.floor(sortedTok.length / 2)];
    const heavy = nonEmpty.filter((b) => b.totalTokens > median * 2.5);
    if (heavy.length && median > 0) {
      const worst = heavy[0];
      insights.push({
        id: "block-pressure",
        severity: "medium",
        title: "Some 5-hour windows run much hotter than usual",
        evidence: `${heavy.length} of your last ${nonEmpty.length} five-hour windows used over 2.5× your median (${fmtTokens(median)} tokens); the heaviest hit ${fmtTokens(worst.totalTokens)}. These are the windows where session limits bite.`,
        action:
          "Spread heavy work across windows: batch related questions into one prompt, and start large refactors early in a fresh window.",
      });
    }
  }

  // 6. Live Codex rate-limit reading, when the logs carry one.
  if (rateLimits && rateLimits.primary && rateLimits.primary.used_percent >= 50) {
    const p = rateLimits.primary;
    const hours = Math.round((p.window_minutes || 300) / 60);
    insights.push({
      id: "codex-rate-limit",
      severity: p.used_percent >= 80 ? "high" : "medium",
      title: `Codex ${hours}h limit at ${Math.round(p.used_percent)}%`,
      evidence: `Your last Codex session reported ${Math.round(p.used_percent)}% of the ${hours}-hour window used${rateLimits.secondary ? ` (weekly: ${Math.round(rateLimits.secondary.used_percent)}%)` : ""}.`,
      action:
        "Trim prompt scope for the rest of this window — focused prompts consume dramatically fewer tokens per request.",
      link: "/prompt-studio",
    });
  }

  return insights.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}
