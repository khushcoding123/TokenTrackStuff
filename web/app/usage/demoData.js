// Deterministic sample payload for demo mode.
//
// Shown when /api/usage reports no local logs (e.g. the deployed site, or a
// machine without Claude Code / Codex installed). Mirrors the exact shape the
// API returns so the UI renders identically; the banner in UsageClient makes
// clear these numbers are illustrative.

// Fixed per-day activity pattern (fraction of a heavy day), 30 entries.
const PATTERN = [
  0.2, 0.55, 0.4, 0, 0.75, 0.6, 0.3, 0.1, 0.9, 0.5,
  0.35, 0, 0.65, 0.8, 0.45, 0.25, 0.7, 0.4, 0, 0.55,
  1.0, 0.6, 0.3, 0.5, 0.85, 0.2, 0.45, 0.7, 0.35, 0.6,
];

const HEAVY_DAY = {
  inputTokens: 220_000,
  outputTokens: 38_000,
  cacheCreationTokens: 150_000,
  cacheReadTokens: 2_600_000,
};

function scaleDay(f) {
  const t = {
    inputTokens: Math.round(HEAVY_DAY.inputTokens * f),
    outputTokens: Math.round(HEAVY_DAY.outputTokens * f),
    cacheCreationTokens: Math.round(HEAVY_DAY.cacheCreationTokens * f),
    cacheReadTokens: Math.round(HEAVY_DAY.cacheReadTokens * f),
  };
  t.totalTokens =
    t.inputTokens + t.outputTokens + t.cacheCreationTokens + t.cacheReadTokens;
  t.costUSD = Math.round((t.inputTokens * 3 + t.outputTokens * 15 + t.cacheCreationTokens * 3.75 + t.cacheReadTokens * 0.3) / 10_000) / 100;
  t.cacheSavingsUSD = Math.round((t.cacheReadTokens * 2.7) / 10_000) / 100;
  return t;
}

function localDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function buildDemoPayload(days = 30, source = "claude-code") {
  const now = new Date();
  const daily = [];
  const totals = {
    inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0,
    cacheReadTokens: 0, totalTokens: 0, costUSD: 0, cacheSavingsUSD: 0,
  };

  // Scale demo numbers per agent so each tab looks distinct in demo mode.
  const scale =
    source === "codex" ? 0.85 : source === "cursor" ? 0.55 : 1;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const f = PATTERN[(days - 1 - i) % PATTERN.length] * scale;
    const t = scaleDay(f);
    for (const k of Object.keys(totals)) totals[k] += t[k];
    daily.push({
      date: localDateKey(d),
      ...t,
      sources: { [source]: t },
    });
  }
  totals.costUSD = Math.round(totals.costUSD * 100) / 100;
  totals.cacheSavingsUSD = Math.round(totals.cacheSavingsUSD * 100) / 100;

  const mkSession = (id, project, hoursAgo, durationMin, f, models, sessionSource = source) => {
    const start = new Date(now.getTime() - hoursAgo * 3600_000);
    const t = scaleDay(f * scale);
    return {
      sessionId: id,
      source: sessionSource,
      project,
      startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + durationMin * 60_000).toISOString(),
      durationMs: durationMin * 60_000,
      models,
      requests: Math.round(80 * f) + 4,
      ...t,
    };
  };

  const sessions =
    source === "codex"
      ? [
          mkSession("codex-demo-1", "checkout-service", 4, 80, 0.7, ["gpt-5"]),
          mkSession("codex-demo-2", "TokenTrackStuff", 12, 120, 0.95, ["gpt-5.4-mini"]),
        ]
      : source === "cursor"
        ? [
            mkSession("cursor-demo-1", "TokenTrackStuff", 2, 45, 0.5, ["cursor-agent"]),
            mkSession("cursor-demo-2", "web", 18, 90, 0.65, ["cursor-agent"]),
          ]
        : [
            mkSession("a1b2c3d4-demo", "checkout-service", 3, 95, 0.6, ["claude-sonnet-4-5"]),
            mkSession("e5f6a7b8-demo", "TokenTrackStuff", 8, 140, 0.9, ["claude-opus-4-1", "claude-sonnet-4-5"]),
            mkSession("c9d0e1f2-demo", "docs-site", 26, 40, 0.2, ["claude-haiku-4"]),
            mkSession("13579bdf-demo", "checkout-service", 30, 200, 1.0, ["claude-opus-4-1"]),
            mkSession("2468ace0-demo", "infra-scripts", 50, 65, 0.35, ["claude-sonnet-4-5"]),
            mkSession("0f1e2d3c-demo", "TokenTrackStuff", 75, 110, 0.55, ["claude-sonnet-4-5"]),
          ];

  const mkModel = (model, label, f, hitRate, modelSource = source) => {
    const t = scaleDay(f * 8 * scale);
    const context = t.inputTokens + t.cacheCreationTokens + t.cacheReadTokens;
    return {
      model, label, approximatePricing: modelSource === "cursor", source: modelSource,
      requests: Math.round(500 * f), cacheHitRate: hitRate,
      ...t,
      cacheReadTokens: Math.round(context * hitRate),
    };
  };

  const models =
    source === "codex"
      ? [mkModel("gpt-5", "GPT-5", 1.0, 0.15), mkModel("gpt-5.4-mini", "GPT-5 mini", 0.4, 0.1)]
      : source === "cursor"
        ? [mkModel("cursor-agent", "Cursor Agent", 1.0, 0)]
        : [
            mkModel("claude-opus-4-1", "Claude Opus", 0.5, 0.62),
            mkModel("claude-sonnet-4-5", "Claude Sonnet", 1.0, 0.78),
            mkModel("claude-haiku-4", "Claude Haiku", 0.15, 0.7),
          ];

  const blocks = [0.55, 0.85, 0.3, 1.0, 0.45].map((f, i) => {
    const start = new Date(now.getTime() - (i * 9 + 2) * 3600_000);
    const t = scaleDay(f);
    return {
      start: start.toISOString(),
      end: new Date(start.getTime() + 5 * 3600_000).toISOString(),
      active: i === 0,
      requests: Math.round(120 * f),
      sources: { [source]: t },
      ...t,
    };
  });

  // Mirrors src/core/usage/behavior.js's analyzeCurrentSession() shape.
  const currentSession = {
    sessionId: `${source}-demo-current`,
    source,
    project: "checkout-service",
    startedAt: new Date(now.getTime() - 3 * 3600_000).toISOString(),
    endedAt: now.toISOString(),
    turns: 14,
    classifiedTurns: 14,
    sessionTokens: 1_820_000,
    sessionUsedPctOfLimit: 42,
    intents: [
      { key: "bugfix", label: "Fixing bugs", tokens: 693_000, turns: 5, pctOfSession: 38.1, pctOfLimit: 16 },
      { key: "feature", label: "Building features", tokens: 720_000, turns: 4, pctOfSession: 39.6, pctOfLimit: 16.6 },
      { key: "refactor", label: "Refactoring", tokens: 160_000, turns: 2, pctOfSession: 8.8, pctOfLimit: 3.7 },
      { key: "question", label: "Questions & review", tokens: 190_000, turns: 2, pctOfSession: 10.4, pctOfLimit: 4.4 },
      { key: "other", label: "Other", tokens: 57_000, turns: 1, pctOfSession: 3.1, pctOfLimit: 1.3 },
    ],
    waste: [
      {
        key: "rework",
        label: "Rework after wrong output",
        hint: "Turns spent correcting or undoing what the AI just did.",
        tokens: 212_000,
        turns: 2,
      },
      {
        key: "uncachedContext",
        label: "Re-sent context (cache misses)",
        hint: "Input tokens re-sent at full price instead of read from cache.",
        tokens: 96_000,
        turns: 9,
      },
      {
        key: "vagueExploration",
        label: "Vague-prompt exploration",
        hint: "Short, unscoped prompts that made the agent search the codebase.",
        tokens: 64_000,
        turns: 1,
      },
    ],
    wastedTokens: 372_000,
    wastedPct: 20.4,
  };

  return {
    available: true,
    demo: true,
    sources: [source],
    detectedSources: [],
    selectedSource: source,
    days,
    generatedAt: now.toISOString(),
    rateLimits: null,
    currentSession,
    totals,
    bySource: { [source]: totals },
    daily,
    sessions,
    models,
    blocks,
    insights: [
      {
        id: "high-input-ratio",
        severity: "high",
        title: "The AI is reading far more than it writes",
        evidence: "9× more fresh input tokens (3.1M) than output tokens (342k). That usually means broad prompts sending the agent on codebase-wide searches.",
        action: 'Scope prompts to specific files and add guards like "only change X". Run prompts through Prompt Studio before sending them.',
        link: "/prompt-studio",
      },
      {
        id: "outlier-13579bdf",
        severity: "medium",
        title: "Expensive session in checkout-service",
        evidence: "Session 13579bdf… consumed 3.0M tokens (~$3.12), over 3× your session average of $0.94.",
        action: "Long sessions accumulate context that gets re-sent with every request. Split big tasks into separate, focused sessions.",
      },
      {
        id: "good-cache-hit",
        severity: "info",
        title: "Caching is working well",
        evidence: "76% of context tokens came from cache, saving roughly $18.40 vs uncached pricing.",
        action: "No change needed — your session rhythm keeps the prompt cache warm.",
      },
    ],
  };
}
