// Aggregation for the usage dashboard.
//
// Takes the flat normalized records emitted by claude.js / codex.js and
// produces everything the dashboard renders: daily buckets, per-session
// rollups, per-model totals, and 5-hour billing blocks (the window both
// Claude and Codex subscription session limits are measured against).

import { pricingFor, costForRecord, cacheSavingsForRecord } from "./pricing.js";

export const BLOCK_MS = 5 * 60 * 60 * 1000; // 5-hour limit window

function dayKey(ts) {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function localDayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function emptyTotals() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    costUSD: 0,
    cacheSavingsUSD: 0,
  };
}

function addRecord(t, r, cost, savings) {
  t.inputTokens += r.inputTokens;
  t.outputTokens += r.outputTokens;
  t.cacheCreationTokens += r.cacheCreationTokens;
  t.cacheReadTokens += r.cacheReadTokens;
  t.totalTokens +=
    r.inputTokens + r.outputTokens + r.cacheCreationTokens + r.cacheReadTokens;
  t.costUSD += cost;
  t.cacheSavingsUSD += savings;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function finishTotals(t) {
  t.costUSD = round2(t.costUSD);
  t.cacheSavingsUSD = round2(t.cacheSavingsUSD);
  return t;
}

/**
 * Aggregate normalized usage records into the dashboard payload.
 * @param {Array<object>} records normalized records from both parsers
 * @param {object} [options]
 * @param {number} [options.days] restrict to the last N days
 * @param {Date}   [options.now]  clock override (tests)
 */
export function aggregate(records, options = {}) {
  const now = options.now || new Date();
  const cutoff = options.days
    ? now.getTime() - options.days * 24 * 60 * 60 * 1000
    : 0;

  const sorted = records
    .filter((r) => !cutoff || new Date(r.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const totals = emptyTotals();
  const bySource = {};
  const daily = new Map();
  const sessions = new Map();
  const models = new Map();
  const blocks = [];
  let currentBlock = null;

  for (const r of sorted) {
    const cost = costForRecord(r);
    const savings = cacheSavingsForRecord(r);
    const ts = new Date(r.timestamp).getTime();

    addRecord(totals, r, cost, savings);
    if (!bySource[r.source]) bySource[r.source] = emptyTotals();
    addRecord(bySource[r.source], r, cost, savings);

    // --- daily buckets ---
    const day = dayKey(r.timestamp);
    if (!daily.has(day)) {
      daily.set(day, { date: day, ...emptyTotals(), sources: {} });
    }
    const d = daily.get(day);
    addRecord(d, r, cost, savings);
    if (!d.sources[r.source]) d.sources[r.source] = emptyTotals();
    addRecord(d.sources[r.source], r, cost, savings);

    // --- per-session rollups ---
    const sKey = `${r.source}:${r.sessionId}`;
    if (!sessions.has(sKey)) {
      sessions.set(sKey, {
        sessionId: r.sessionId,
        source: r.source,
        project: r.project,
        startedAt: r.timestamp,
        endedAt: r.timestamp,
        models: new Set(),
        requests: 0,
        ...emptyTotals(),
      });
    }
    const s = sessions.get(sKey);
    if (r.timestamp < s.startedAt) s.startedAt = r.timestamp;
    if (r.timestamp > s.endedAt) s.endedAt = r.timestamp;
    s.models.add(r.model);
    s.requests += 1;
    addRecord(s, r, cost, savings);

    // --- per-model totals ---
    if (!models.has(r.model)) {
      const p = pricingFor(r.model);
      models.set(r.model, {
        model: r.model,
        label: p.label,
        approximatePricing: p.approximate || Boolean(r.modelIsFallback),
        source: r.source,
        requests: 0,
        ...emptyTotals(),
      });
    }
    const m = models.get(r.model);
    m.requests += 1;
    addRecord(m, r, cost, savings);

    // --- 5-hour blocks (window starts at first activity after a gap) ---
    if (!currentBlock || ts >= currentBlock.start + BLOCK_MS) {
      currentBlock = {
        start: ts,
        end: ts + BLOCK_MS,
        requests: 0,
        sources: {},
        ...emptyTotals(),
      };
      blocks.push(currentBlock);
    }
    currentBlock.requests += 1;
    addRecord(currentBlock, r, cost, savings);
    if (!currentBlock.sources[r.source]) {
      currentBlock.sources[r.source] = emptyTotals();
    }
    addRecord(currentBlock.sources[r.source], r, cost, savings);
  }

  // Fill calendar gaps so charts show quiet days as zero, not missing.
  const dailyOut = [];
  if (sorted.length) {
    const firstDay = options.days
      ? addLocalDays(localDayStart(now), -(options.days - 1))
      : new Date(sorted[0].timestamp);
    for (let d = localDayStart(firstDay); d <= now; d = addLocalDays(d, 1)) {
      const key = dayKey(d);
      dailyOut.push(
        daily.get(key) || { date: key, ...emptyTotals(), sources: {} }
      );
    }
  }
  for (const d of dailyOut) {
    finishTotals(d);
    for (const src of Object.values(d.sources)) finishTotals(src);
  }

  const sessionsOut = [...sessions.values()]
    .map((s) => {
      const durationMs =
        new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
      return finishTotals({ ...s, models: [...s.models], durationMs });
    })
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

  const modelsOut = [...models.values()]
    .map((m) => {
      // Cache efficiency: share of all context tokens served from cache.
      const context = m.inputTokens + m.cacheCreationTokens + m.cacheReadTokens;
      return finishTotals({
        ...m,
        cacheHitRate: context > 0 ? m.cacheReadTokens / context : 0,
      });
    })
    .sort((a, b) => b.costUSD - a.costUSD);

  const nowMs = now.getTime();
  const blocksOut = blocks
    .map((b) =>
      finishTotals({
        ...b,
        start: new Date(b.start).toISOString(),
        end: new Date(b.end).toISOString(),
        active: nowMs >= new Date(b.start).getTime() && nowMs < new Date(b.end).getTime(),
      })
    )
    .sort((a, b) => (a.start < b.start ? 1 : -1));

  return {
    totals: finishTotals(totals),
    bySource: Object.fromEntries(
      Object.entries(bySource).map(([k, v]) => [k, finishTotals(v)])
    ),
    daily: dailyOut,
    sessions: sessionsOut,
    models: modelsOut,
    blocks: blocksOut,
  };
}
