// Per-model pricing for the usage dashboard.
//
// $ per 1M tokens, split by token type. Like src/config.js these are
// deliberately approximate — the dashboard is about relative cost and
// trends, not billing-grade accuracy. Subscription (Pro/Max/Plus) usage
// isn't billed per token at all; we still price it so users can see the
// API-equivalent value of what they consumed.
//
// Matching is by substring against the raw model id from the logs
// (e.g. "claude-sonnet-4-5-20250929", "gpt-5.4-mini"), most-specific first.

const PRICING_TABLE = [
  // Anthropic
  { match: "claude-opus", label: "Claude Opus", input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { match: "claude-sonnet", label: "Claude Sonnet", input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { match: "claude-haiku", label: "Claude Haiku", input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
  // Older Anthropic ids ("claude-3-5-sonnet-...") put the family later in the id.
  { match: "opus", label: "Claude Opus", input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  { match: "sonnet", label: "Claude Sonnet", input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  { match: "haiku", label: "Claude Haiku", input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },

  // OpenAI / Codex
  { match: "gpt-5", modifier: "mini", label: "GPT-5 mini", input: 0.25, output: 2, cacheWrite: 0, cacheRead: 0.025 },
  { match: "gpt-5", modifier: "nano", label: "GPT-5 nano", input: 0.05, output: 0.4, cacheWrite: 0, cacheRead: 0.005 },
  { match: "gpt-5", label: "GPT-5", input: 1.25, output: 10, cacheWrite: 0, cacheRead: 0.125 },
  { match: "codex", label: "Codex", input: 1.25, output: 10, cacheWrite: 0, cacheRead: 0.125 },
  { match: "gpt-4o", modifier: "mini", label: "GPT-4o mini", input: 0.15, output: 0.6, cacheWrite: 0, cacheRead: 0.075 },
  { match: "gpt-4o", label: "GPT-4o", input: 2.5, output: 10, cacheWrite: 0, cacheRead: 1.25 },

  // Cursor transcripts carry no model id; records use the synthetic
  // "cursor-agent" id and mid-tier pricing so estimates stay conservative.
  { match: "cursor-agent", label: "Cursor Agent", input: 3, output: 15, cacheWrite: 0, cacheRead: 0.3 },
];

// Family defaults used when nothing in the table matches.
const DEFAULT_CLAUDE = { label: "Claude (unknown)", input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };
const DEFAULT_OPENAI = { label: "OpenAI (unknown)", input: 1.25, output: 10, cacheWrite: 0, cacheRead: 0.125 };

/**
 * Resolve pricing for a raw model id.
 * @returns {{ label, input, output, cacheWrite, cacheRead, approximate }}
 */
export function pricingFor(modelId = "") {
  const id = String(modelId).toLowerCase();
  for (const row of PRICING_TABLE) {
    if (!id.includes(row.match)) continue;
    if (row.modifier && !id.includes(row.modifier)) continue;
    // Skip the plain "gpt-5" row for mini/nano ids: modifier rows come first
    // in the table, so by the time we reach it those already matched.
    return { ...row, approximate: false };
  }
  if (id.includes("claude")) return { ...DEFAULT_CLAUDE, approximate: true };
  return { ...DEFAULT_OPENAI, approximate: true };
}

/**
 * Estimated cost in USD for one normalized usage record.
 */
export function costForRecord(record) {
  const p = pricingFor(record.model);
  return (
    (record.inputTokens || 0) * p.input +
    (record.outputTokens || 0) * p.output +
    (record.cacheCreationTokens || 0) * p.cacheWrite +
    (record.cacheReadTokens || 0) * p.cacheRead
  ) / 1_000_000;
}

/**
 * What the cache reads *would* have cost at full input price. The delta vs
 * actual cache-read cost is the "saved by caching" figure on the dashboard.
 */
export function cacheSavingsForRecord(record) {
  const p = pricingFor(record.model);
  const reads = record.cacheReadTokens || 0;
  return (reads * (p.input - p.cacheRead)) / 1_000_000;
}
