// Session-behavior analysis for the usage dashboard.
//
// Takes the normalized records for ONE session (each record optionally carries
// the user prompt that started its turn — see claude.js / codex.js) and
// answers two questions the charts render:
//
//   1. WHAT was the session spent on?  Each turn's prompt is classified into a
//      deterministic intent bucket (fixing bugs, building features, ...) and
//      token totals are rolled up per bucket → the intent pie chart.
//
//   2. WHERE were tokens wasted?  Heuristics flag turns whose tokens bought no
//      forward progress (rework after the AI got it wrong, retried prompts,
//      re-sent context that missed the cache, vague prompts that made the
//      agent wander) → the wasted-tokens chart.
//
// Everything here is pure JS with no Node built-ins, so it runs in the
// browser (Prompt Studio pattern) as well as the CLI and API routes.
// Deterministic on purpose: same logs in, same numbers out.

// --- Intent classification --------------------------------------------------

export const INTENTS = [
  { key: "bugfix", label: "Fixing bugs" },
  { key: "feature", label: "Building features" },
  { key: "refactor", label: "Refactoring" },
  { key: "testing", label: "Tests & verification" },
  { key: "question", label: "Questions & review" },
  { key: "other", label: "Other" },
];

// Ordered rules: first match wins. Bugfix outranks feature so "fix the login
// feature" counts as a fix, not a feature.
const INTENT_RULES = [
  {
    key: "bugfix",
    re: /\b(fix|fixed|fixing|bug|bugs|error|errors|crash|crashes|broken|breaks?|fails?|failing|failed|issue|issues|debug|exception|wrong|incorrect|regression|not working|doesn'?t work|isn'?t working|stack ?trace)\b/i,
  },
  {
    key: "testing",
    re: /\b(test|tests|testing|spec|specs|coverage|assert|verify|verification|e2e|unit test)\b/i,
  },
  {
    key: "refactor",
    re: /\b(refactor|refactoring|rename|clean ?up|cleanup|reorganize|restructure|simplify|extract|dedupe|deduplicate|tidy|move .* (into|to)|split .* (into|out))\b/i,
  },
  {
    key: "feature",
    re: /\b(add|adds|adding|build|builds|building|create|creates|creating|implement|implements|implementing|new|make|makes|making|write|integrate|support|feature|page|button|chart|graph|endpoint|component|dashboard)\b/i,
  },
  {
    key: "question",
    re: /\b(what|why|how|where|which|when|explain|describe|show me|tell me|look at|review|take a look|understand|walk me|summarize|compare)\b/i,
  },
];

/** Classify one user prompt into an intent bucket key. */
export function classifyIntent(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return "other";
  for (const rule of INTENT_RULES) {
    if (rule.re.test(text)) return rule.key;
  }
  return "other";
}

// --- Turn grouping -----------------------------------------------------------

// Consecutive records that share a prompt belong to the same turn (one user
// message → many API requests while the agent works).
function groupTurns(records) {
  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  const turns = [];
  let current = null;
  for (const r of sorted) {
    const prompt = r.prompt || null;
    if (!current || prompt !== current.prompt) {
      current = {
        prompt,
        intent: classifyIntent(prompt),
        startedAt: r.timestamp,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
      };
      turns.push(current);
    }
    current.requests += 1;
    current.inputTokens += r.inputTokens || 0;
    current.outputTokens += r.outputTokens || 0;
    current.cacheCreationTokens += r.cacheCreationTokens || 0;
    current.cacheReadTokens += r.cacheReadTokens || 0;
    current.totalTokens +=
      (r.inputTokens || 0) +
      (r.outputTokens || 0) +
      (r.cacheCreationTokens || 0) +
      (r.cacheReadTokens || 0);
  }
  return turns;
}

// --- Waste heuristics ---------------------------------------------------------

export const WASTE_BUCKETS = [
  {
    key: "rework",
    label: "Rework after wrong output",
    hint: "Turns spent correcting or undoing what the AI just did.",
  },
  {
    key: "retries",
    label: "Repeated prompts",
    hint: "Near-identical prompts sent again because the first try missed.",
  },
  {
    key: "uncachedContext",
    label: "Re-sent context (cache misses)",
    hint: "Input tokens re-sent at full price instead of read from cache.",
  },
  {
    key: "vagueExploration",
    label: "Vague-prompt exploration",
    hint: "Short, unscoped prompts that made the agent search the codebase.",
  },
];

// A correction prompt signals the previous turn's output was wrong/discarded.
const CORRECTION_RE =
  /^(no\b|nope\b|not\b|wait\b|actually\b|undo\b|revert\b|stop\b)|(\bstill (broken|failing|wrong|not working|doesn'?t)\b)|(\b(didn'?t|doesn'?t|does not) work\b)|(\bthat'?s (not|wrong)\b)|(\byou (broke|removed|deleted|missed)\b)|(\btry again\b)|(\bnot what i\b)/i;

function normalizePrompt(p) {
  return String(p || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// Cheap similarity: shared-word overlap (Jaccard). Good enough to catch
// "same prompt sent again", with zero dependencies.
function promptSimilarity(a, b) {
  const wa = new Set(normalizePrompt(a).split(" ").filter(Boolean));
  const wb = new Set(normalizePrompt(b).split(" ").filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / (wa.size + wb.size - shared);
}

const VAGUE_MAX_WORDS = 6;
const FILE_REF_RE = /[\w-]+\.(js|jsx|ts|tsx|py|css|html|json|md|go|rs|java|rb)\b|\//;

function analyzeWaste(turns) {
  const buckets = Object.fromEntries(
    WASTE_BUCKETS.map((b) => [b.key, { ...b, tokens: 0, turns: 0 }])
  );
  const wastedByIntent = new Map();

  // Record one wasteful event into a bucket (a single row + turn on the chart)
  // and attribute its tokens to one or more intents (for the per-intent
  // useful/wasted split). `attributions` is [{ intent, tokens }, ...] — the
  // bucket counts the full sum as ONE wasteful turn, but the tokens can span
  // intents (e.g. rework includes the previous turn's discarded output, which
  // belongs to that earlier turn's intent, not the correction's).
  function recordWaste(bucketKey, attributions) {
    let total = 0;
    for (const { intent, tokens } of attributions) {
      const amount = Math.max(0, Math.round(tokens || 0));
      if (!amount) continue;
      total += amount;
      wastedByIntent.set(intent, (wastedByIntent.get(intent) || 0) + amount);
    }
    if (!total) return;
    buckets[bucketKey].tokens += total;
    buckets[bucketKey].turns += 1;
  }

  turns.forEach((turn, i) => {
    const prev = i > 0 ? turns[i - 1] : null;

    // 1. Rework: this turn corrects the previous one, so the previous turn's
    //    output was thrown away and this turn re-does it. Attribute the
    //    discarded output to the PREVIOUS turn's intent so the per-intent cap
    //    downstream doesn't clip it against this (usually smaller) turn.
    if (turn.prompt && CORRECTION_RE.test(turn.prompt.trim())) {
      recordWaste("rework", [
        { intent: turn.intent, tokens: turn.totalTokens },
        ...(prev ? [{ intent: prev.intent, tokens: prev.outputTokens }] : []),
      ]);
      return; // a correction turn isn't double-counted in other buckets
    }

    // 2. Retries: near-duplicate of the previous prompt.
    if (
      turn.prompt &&
      prev &&
      prev.prompt &&
      promptSimilarity(turn.prompt, prev.prompt) >= 0.8
    ) {
      recordWaste("retries", [{ intent: turn.intent, tokens: turn.totalTokens }]);
      return;
    }

    // 3. Cache misses: past the first turn the conversation context already
    //    exists, so uncached input tokens are context re-sent at full price.
    if (i > 0 && turn.inputTokens > 0 && turn.cacheReadTokens > 0) {
      recordWaste("uncachedContext", [{ intent: turn.intent, tokens: turn.inputTokens }]);
    }

    // 4. Vague exploration: a tiny unscoped prompt where input dwarfs output
    //    means the agent burned context wandering the codebase. Count the
    //    input beyond a healthy 4:1 input:output ratio as waste.
    const words = normalizePrompt(turn.prompt).split(" ").filter(Boolean);
    const contextIn = turn.inputTokens + turn.cacheCreationTokens;
    if (
      turn.prompt &&
      words.length > 0 &&
      words.length <= VAGUE_MAX_WORDS &&
      !FILE_REF_RE.test(turn.prompt) &&
      contextIn > turn.outputTokens * 4
    ) {
      recordWaste("vagueExploration", [
        { intent: turn.intent, tokens: contextIn - turn.outputTokens * 4 },
      ]);
    }
  });

  const waste = WASTE_BUCKETS.map((b) => ({
    ...buckets[b.key],
    tokens: Math.round(buckets[b.key].tokens),
  })).filter((b) => b.tokens > 0);
  return { waste, wastedByIntent };
}

// --- Public entry -------------------------------------------------------------

/**
 * Analyze one session's records into the intent + waste breakdown.
 * @param {Array<object>} records normalized records for a single session
 * @param {object} [options]
 * @param {object|null} [options.rateLimits] latest Codex rate-limit snapshot;
 *        when present, each intent also reports pctOfLimit — its share of the
 *        session-limit percentage the whole session consumed.
 * @returns {object|null} breakdown, or null when there's nothing to analyze
 */
export function analyzeSessionBehavior(records, options = {}) {
  if (!records || !records.length) return null;
  const turns = groupTurns(records);
  const sessionTokens = turns.reduce((sum, t) => sum + t.totalTokens, 0);
  if (sessionTokens === 0) return null;

  const rateLimits = options.rateLimits || null;
  // used_percent is how much of the 5h window the WHOLE session limit has
  // consumed; each intent's slice of session tokens maps to a slice of that.
  const usedPct = rateLimits?.primary?.used_percent ?? null;

  const byIntent = new Map();
  for (const t of turns) {
    if (!byIntent.has(t.intent)) {
      byIntent.set(t.intent, { tokens: 0, turns: 0 });
    }
    const b = byIntent.get(t.intent);
    b.tokens += t.totalTokens;
    b.turns += 1;
  }

  const wasteAnalysis = analyzeWaste(turns);
  const intents = INTENTS.map((meta) => {
    const b = byIntent.get(meta.key);
    if (!b) return null;
    const pctOfSession = b.tokens / sessionTokens;
    const wastedTokens = Math.min(
      b.tokens,
      wasteAnalysis.wastedByIntent.get(meta.key) || 0
    );
    return {
      key: meta.key,
      label: meta.label,
      tokens: b.tokens,
      usefulTokens: b.tokens - wastedTokens,
      wastedTokens,
      turns: b.turns,
      pctOfSession: Math.round(pctOfSession * 1000) / 10,
      pctOfLimit:
        usedPct != null ? Math.round(pctOfSession * usedPct * 10) / 10 : null,
    };
  }).filter(Boolean);

  // Multiple waste heuristics can overlap on one turn. Cap each intent at its
  // real token count, then scale the cause rows to that same honest total.
  const wastedTokens = intents.reduce((sum, intent) => sum + intent.wastedTokens, 0);
  const usefulTokens = sessionTokens - wastedTokens;
  const rawWasteTokens = wasteAnalysis.waste.reduce((sum, item) => sum + item.tokens, 0);
  const wasteScale = rawWasteTokens > 0 ? wastedTokens / rawWasteTokens : 0;
  const scaledWaste = wasteAnalysis.waste.map((item) => {
    const exactTokens = item.tokens * wasteScale;
    return { ...item, tokens: Math.floor(exactTokens), fraction: exactTokens % 1 };
  });
  let wasteRemainder = wastedTokens - scaledWaste.reduce((sum, item) => sum + item.tokens, 0);
  [...scaledWaste]
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((item) => {
      if (wasteRemainder <= 0) return;
      item.tokens += 1;
      wasteRemainder -= 1;
    });
  const waste = scaledWaste
    .map(({ fraction, ...item }) => ({
      ...item,
      pctOfWaste: wastedTokens > 0
        ? Math.round((item.tokens / wastedTokens) * 1000) / 10
        : 0,
    }))
    .filter((item) => item.tokens > 0);
  const usefulBreakdown = intents
    .filter((intent) => intent.usefulTokens > 0)
    .map((intent) => ({
      key: intent.key,
      label: intent.label,
      tokens: intent.usefulTokens,
      turns: intent.turns,
      pctOfUseful: usefulTokens > 0
        ? Math.round((intent.usefulTokens / usefulTokens) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  return {
    turns: turns.length,
    classifiedTurns: turns.filter((t) => t.prompt).length,
    sessionTokens,
    usefulTokens,
    sessionUsedPctOfLimit: usedPct,
    intents,
    usefulBreakdown,
    waste,
    wastedTokens,
    wastedPct: Math.round((wastedTokens / sessionTokens) * 1000) / 10,
  };
}

/**
 * Pick the "current" session (most recent activity) out of all records and
 * analyze it. Returns null when no records carry prompts worth analyzing.
 */
export function analyzeCurrentSession(records, options = {}) {
  if (!records || !records.length) return null;

  // Most recent session = the one containing the newest record.
  let newest = records[0];
  for (const r of records) {
    if (r.timestamp > newest.timestamp) newest = r;
  }
  const sessionRecords = records.filter(
    (r) => r.source === newest.source && r.sessionId === newest.sessionId
  );

  const breakdown = analyzeSessionBehavior(sessionRecords, options);
  if (!breakdown) return null;
  return {
    sessionId: newest.sessionId,
    source: newest.source,
    project: newest.project,
    startedAt: sessionRecords.reduce(
      (min, r) => (r.timestamp < min ? r.timestamp : min),
      sessionRecords[0].timestamp
    ),
    endedAt: newest.timestamp,
    ...breakdown,
  };
}
