"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadCSV } from "../lib/csv.js";
import { useToast } from "../components/ToastProvider";
import { buildDemoPayload } from "./demoData.js";

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

const SOURCE_META = {
  "claude-code": { label: "Claude Code", icon: "smart_toy" },
  codex: { label: "Codex", icon: "terminal" },
};

const SEVERITY_STYLES = {
  high: { badge: "bg-error/10 border-error/30 text-error", icon: "priority_high" },
  medium: { badge: "bg-tertiary/10 border-tertiary/30 text-tertiary", icon: "warning" },
  info: { badge: "bg-primary/10 border-primary/30 text-primary", icon: "check_circle" },
};

// Stacked-bar segments, bottom to top.
const SEGMENTS = [
  { key: "cacheReadTokens", label: "Cache read", barClass: "bg-surface-variant/60", dotClass: "bg-surface-variant" },
  { key: "cacheCreationTokens", label: "Cache write", barClass: "bg-secondary/60", dotClass: "bg-secondary" },
  { key: "inputTokens", label: "Input", barClass: "bg-primary/70", dotClass: "bg-primary" },
  { key: "outputTokens", label: "Output", barClass: "bg-tertiary/80", dotClass: "bg-tertiary" },
];

const PAGE_SIZE = 6;

function fmtTokens(n) {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUSD(n) {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function fmtDuration(ms) {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "<1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function fmtWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SourceBadge({ source }) {
  const meta = SOURCE_META[source] || { label: source, icon: "memory" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary font-label-sm text-label-sm">
      <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function ProgressBar({ pct, toneClass = "bg-primary" }) {
  return (
    <div className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden">
      <div
        className={`h-full rounded-full ${toneClass} transition-all duration-500`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export default function UsageClient() {
  const { notify } = useToast();
  const [days, setDays] = useState(30);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hoveredDay, setHoveredDay] = useState(null);

  function loadUsage(nextDays = days, { silent = false } = {}) {
    let cancelled = false;
    if (silent) setRefreshing(true);
    else setLoading(true);
    fetch(`/api/usage?days=${nextDays}`)
      .then((r) => r.json())
      .catch(() => ({ available: false }))
      .then((data) => {
        if (cancelled) return;
        setPayload(data.available ? data : buildDemoPayload(nextDays));
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }

  useEffect(() => {
    return loadUsage(days);
  }, [days]);

  useEffect(() => {
    const id = setInterval(() => loadUsage(days, { silent: true }), 60_000);
    return () => clearInterval(id);
  }, [days]);

  useEffect(() => setPage(1), [query, days]);

  const sessions = payload?.sessions || [];
  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.sessionId.toLowerCase().includes(q) ||
        s.project.toLowerCase().includes(q) ||
        s.models.some((m) => m.toLowerCase().includes(q))
    );
  }, [sessions, query]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const pagedSessions = filteredSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const chartDays = useMemo(() => {
    const daily = payload?.daily || [];
    // Cap the bar count so 90d stays readable.
    return daily.length > 45 ? daily.filter((_, i) => i % 2 === 0) : daily;
  }, [payload]);
  const chartMax = Math.max(1, ...chartDays.map((d) => d.totalTokens));

  const activeBlock = (payload?.blocks || []).find((b) => b.active) || null;
  const recentBlocks = (payload?.blocks || []).filter((b) => !b.active).slice(0, 5);
  const blockMax = Math.max(1, ...(payload?.blocks || []).map((b) => b.totalTokens));
  const blockElapsedPct = activeBlock
    ? ((Date.now() - new Date(activeBlock.start).getTime()) / (5 * 3600_000)) * 100
    : 0;

  const rateLimits = payload?.rateLimits;

  const handleExport = () => {
    downloadCSV(
      "metriq-usage-sessions.csv",
      filteredSessions.map((s) => ({
        sessionId: s.sessionId,
        source: s.source,
        project: s.project,
        startedAt: s.startedAt,
        durationMin: Math.round(s.durationMs / 60_000),
        requests: s.requests,
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        cacheReadTokens: s.cacheReadTokens,
        cacheCreationTokens: s.cacheCreationTokens,
        totalTokens: s.totalTokens,
        estCostUSD: s.costUSD,
        models: s.models.join(" / "),
      }))
    );
    notify(`Exported ${filteredSessions.length} session(s) to CSV`);
  };

  if (loading || !payload) {
    return (
      <div className="flex-1 flex items-center justify-center py-32">
        <div className="flex items-center gap-3 text-on-surface-variant font-label-md text-label-md">
          <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          Scanning local usage logs…
        </div>
      </div>
    );
  }

  const t = payload.totals;
  const primaryLimit = rateLimits?.primary || null;
  const weeklyLimit = rateLimits?.secondary || null;
  const primaryUsedPct = primaryLimit ? Math.round(primaryLimit.used_percent || 0) : null;
  const primaryRemainingPct = primaryLimit ? Math.max(0, 100 - primaryUsedPct) : null;
  const weeklyUsedPct = weeklyLimit ? Math.round(weeklyLimit.used_percent || 0) : null;
  const weeklyRemainingPct = weeklyLimit ? Math.max(0, 100 - weeklyUsedPct) : null;

  const headline = [
    { label: "Total tokens", value: fmtTokens(t.totalTokens), note: `${fmtTokens(t.inputTokens + t.cacheCreationTokens)} fresh input`, tone: "primary" },
    { label: "Est. cost", value: fmtUSD(t.costUSD), note: "API-equivalent pricing", tone: "default" },
    { label: "Saved by caching", value: fmtUSD(t.cacheSavingsUSD), note: `${fmtTokens(t.cacheReadTokens)} cached reads`, tone: "primary" },
    { label: "Sessions", value: String(sessions.length), note: `last ${payload.days} days`, tone: "default" },
  ];

  return (
    <div className="flex-1 p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto w-full space-y-stack-xl">
      {payload.demo && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-tertiary/40 bg-tertiary/10">
          <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5">science</span>
          <div>
            <p className="font-label-md text-label-md text-tertiary">Demo data — no local logs detected</p>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Run this dashboard on the machine where you use Claude Code or Codex
              (<code className="text-on-surface">cd web &amp;&amp; npm run dev</code>) and your real usage
              is imported automatically from the local session logs. Nothing ever leaves your machine.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Token Usage
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 flex items-center gap-2 flex-wrap">
            Imported automatically from local logs
            {payload.sources.map((s) => (
              <SourceBadge key={s} source={s} />
            ))}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-border-subtle overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.days}
                className={
                  days === r.days
                    ? "px-4 py-2 font-label-md text-label-md bg-primary/15 text-primary"
                    : "px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-highest transition-colors"
                }
                onClick={() => setDays(r.days)}
                type="button"
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            className="bg-surface-glass border border-border-subtle hover:border-primary/50 text-on-surface font-label-md text-label-md py-2 px-4 rounded transition-all duration-200 flex items-center gap-2"
            disabled={refreshing}
            onClick={() => loadUsage(days, { silent: true })}
            type="button"
          >
            <span className={`material-symbols-outlined text-sm ${refreshing ? "animate-spin" : ""}`}>
              refresh
            </span>
            Refresh
          </button>
          <button
            className="bg-surface-glass border border-border-subtle hover:border-primary/50 text-on-surface font-label-md text-label-md py-2 px-4 rounded transition-all duration-200 flex items-center gap-2"
            onClick={handleExport}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export
          </button>
        </div>
      </div>

      {/* Headline metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
        {headline.map((m) => (
          <div key={m.label} className="glass-card p-5 flex flex-col gap-unit">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              {m.label}
            </span>
            <span
              className={`font-headline-lg text-headline-lg ${
                m.tone === "primary" ? "text-primary" : "text-on-background"
              }`}
            >
              {m.value}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{m.note}</span>
          </div>
        ))}
      </section>

      {/* Daily usage chart + session limits */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-7 glass-card p-6 flex flex-col gap-stack-md">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-headline-md text-headline-md text-on-background">Daily usage</h3>
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                Hover a bar to inspect token mix, cost, and source breakdown.
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {SEGMENTS.map((seg) => (
                <span key={seg.key} className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant">
                  <span className={`w-2 h-2 rounded-full ${seg.dotClass}`} /> {seg.label}
                </span>
              ))}
            </div>
          </div>

          <div className="h-56 flex items-end gap-[3px] relative">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="w-full border-b border-border-subtle" />
              <div className="w-full border-b border-border-subtle" />
              <div className="w-full border-b border-border-subtle" />
              <div className="w-full border-b border-border-subtle" />
            </div>
            {chartDays.map((d) => {
              // Square-root scale keeps light days visible next to heavy ones.
              const barPct = d.totalTokens > 0 ? Math.sqrt(d.totalTokens / chartMax) * 100 : 0;
              return (
                <div
                  key={d.date}
                  className="group relative flex-1 h-full flex flex-col justify-end outline-none"
                  onBlur={() => setHoveredDay(null)}
                  onFocus={() => setHoveredDay(d)}
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  tabIndex={0}
                >
                  {SEGMENTS.slice().reverse().map((seg) => (
                    <div
                      key={seg.key}
                      className={`w-full ${seg.barClass} first:rounded-t-sm group-hover:opacity-100 group-focus:opacity-100 opacity-80 transition-opacity`}
                      style={{ height: `${(d[seg.key] / d.totalTokens) * barPct || 0}%` }}
                    />
                  ))}
                  {hoveredDay?.date === d.date && (
                    <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-64 -translate-x-1/2 rounded-lg border border-border-subtle bg-surface-container-low px-4 py-3 shadow-xl pointer-events-none">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="font-label-md text-label-md text-on-surface">{d.date}</span>
                        <span className="font-label-md text-label-md text-primary">{fmtUSD(d.costUSD)}</span>
                      </div>
                      <div className="space-y-1.5">
                        {SEGMENTS.map((seg) => (
                          <div key={seg.key} className="flex items-center justify-between font-label-sm text-label-sm">
                            <span className="text-on-surface-variant flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${seg.dotClass}`} />
                              {seg.label}
                            </span>
                            <span className="text-on-surface">{fmtTokens(d[seg.key])}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-border-subtle/60 flex items-center justify-between font-label-sm text-label-sm">
                        <span className="text-on-surface-variant">Total</span>
                        <span className="text-on-surface">{fmtTokens(d.totalTokens)}</span>
                      </div>
                      {Object.keys(d.sources || {}).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border-subtle/60 space-y-1">
                          {Object.entries(d.sources).map(([source, sourceTotals]) => (
                            <div key={source} className="flex items-center justify-between font-label-sm text-label-sm">
                              <span className="text-on-surface-variant">
                                {SOURCE_META[source]?.label || source}
                              </span>
                              <span className="text-on-surface">{fmtTokens(sourceTotals.totalTokens)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
            <span>{chartDays[0]?.date}</span>
            <span>{chartDays[chartDays.length - 1]?.date}</span>
          </div>
        </div>

        {/* Session limits */}
        <div className="lg:col-span-5 glass-card p-6 flex flex-col gap-stack-md">
          <h3 className="font-headline-md text-headline-md text-on-background flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">hourglass_top</span>
            Session limits (5-hour windows)
          </h3>

          {primaryLimit ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border-subtle bg-surface/40 p-3">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Used
                  </span>
                  <div className={`font-headline-md text-headline-md mt-1 ${primaryUsedPct >= 80 ? "text-error" : "text-primary"}`}>
                    {primaryUsedPct}%
                  </div>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface/40 p-3">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Remaining
                  </span>
                  <div className={`font-headline-md text-headline-md mt-1 ${primaryRemainingPct <= 20 ? "text-error" : "text-on-surface"}`}>
                    {primaryRemainingPct}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between font-label-md text-label-md">
                <span className="text-on-surface-variant">
                  Codex {Math.round((primaryLimit.window_minutes || 300) / 60)}h session limit
                </span>
                <span className={primaryUsedPct >= 80 ? "text-error" : "text-on-surface"}>
                  {primaryUsedPct}% used · {primaryRemainingPct}% left
                </span>
              </div>
              <ProgressBar
                pct={primaryUsedPct}
                toneClass={primaryUsedPct >= 80 ? "bg-error" : "bg-primary"}
              />
              {weeklyLimit && (
                <>
                  <div className="flex items-center justify-between font-label-md text-label-md">
                    <span className="text-on-surface-variant">Weekly window</span>
                    <span className="text-on-surface">
                      {weeklyUsedPct}% used · {weeklyRemainingPct}% left
                    </span>
                  </div>
                  <ProgressBar pct={weeklyUsedPct} toneClass="bg-secondary" />
                </>
              )}
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Reported by your last Codex session ({fmtWhen(rateLimits.observedAt)})
                {rateLimits.plan_type ? ` — ${rateLimits.plan_type} plan` : ""}.
              </p>
            </div>
          ) : (
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              No live limit telemetry in these logs, so an exact percent of your plan limit is unavailable. Showing activity per 5-hour window instead.
            </p>
          )}

          {activeBlock && (
            <div className="space-y-2 pt-2 border-t border-border-subtle/50">
              <div className="flex items-center justify-between font-label-md text-label-md">
                <span className="text-on-surface flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  Current window
                </span>
                <span className="text-on-surface-variant">
                  {fmtTokens(activeBlock.totalTokens)} tokens · {fmtUSD(activeBlock.costUSD)}
                </span>
              </div>
              <ProgressBar pct={blockElapsedPct} />
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Window started {fmtWhen(activeBlock.start)} · resets {fmtWhen(activeBlock.end)}
              </p>
            </div>
          )}

          {recentBlocks.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border-subtle/50">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Recent windows
              </span>
              {recentBlocks.map((b) => (
                <div key={b.start} className="flex items-center gap-3">
                  <span className="font-label-sm text-label-sm text-on-surface-variant w-28 shrink-0">
                    {fmtWhen(b.start)}
                  </span>
                  <div className="flex-1">
                    <ProgressBar pct={(b.totalTokens / blockMax) * 100} toneClass="bg-secondary/70" />
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface w-16 text-right shrink-0">
                    {fmtTokens(b.totalTokens)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Insights */}
      <section className="space-y-stack-md">
        <h3 className="font-headline-md text-headline-md text-on-background flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary">insights</span>
          How to reduce your token usage
        </h3>
        {payload.insights.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">
            Not enough usage in this window to generate insights yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
            {payload.insights.map((ins) => {
              const sev = SEVERITY_STYLES[ins.severity] || SEVERITY_STYLES.info;
              return (
                <div key={ins.id} className="glass-card p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-label-md text-label-md text-on-surface">{ins.title}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-label-sm text-label-sm shrink-0 ${sev.badge}`}>
                      <span className="material-symbols-outlined text-[13px]">{sev.icon}</span>
                      {ins.severity}
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant flex-1">{ins.evidence}</p>
                  <p className="font-label-sm text-label-sm text-on-surface border-l-2 border-primary/50 pl-3">
                    {ins.action}
                  </p>
                  {ins.link && (
                    <a
                      className="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1 w-fit"
                      href={ins.link}
                    >
                      Open Prompt Studio
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Model breakdown */}
      <section className="space-y-stack-md">
        <h3 className="font-headline-md text-headline-md text-on-background">By model</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-gutter">
          {payload.models.map((m) => (
            <div key={m.model} className="glass-card p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md text-on-surface">{m.label}</span>
                <SourceBadge source={m.source} />
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant break-all">{m.model}</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="font-headline-md text-headline-md text-primary">{fmtTokens(m.totalTokens)}</span>
                <span className="font-label-md text-label-md text-on-surface-variant">
                  {fmtUSD(m.costUSD)}
                  {m.approximatePricing ? " (approx.)" : ""}
                </span>
              </div>
              <div className="space-y-1 mt-1">
                <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                  <span>Cache efficiency</span>
                  <span>{Math.round(m.cacheHitRate * 100)}%</span>
                </div>
                <ProgressBar pct={m.cacheHitRate * 100} />
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">{m.requests} requests</span>
            </div>
          ))}
        </div>
      </section>

      {/* Sessions table */}
      <section className="space-y-stack-md">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-headline-md text-headline-md text-on-background">Sessions</h3>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none">
              search
            </span>
            <input
              className="bg-surface-glass border border-border-subtle rounded py-2 pl-9 pr-3 text-label-md font-label-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-56"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search project, model, id…"
              type="text"
              value={query}
            />
          </div>
        </div>

        <div className="bg-surface-glass border border-border-subtle rounded-xl overflow-hidden flex flex-col">
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-4 border-b border-border-subtle bg-surface/50 font-label-sm text-label-sm text-on-surface-variant">
            <div className="col-span-3">PROJECT / SESSION</div>
            <div className="col-span-2">STARTED</div>
            <div className="col-span-1 text-right">LENGTH</div>
            <div className="col-span-3 text-right">TOKENS (IN / OUT / CACHED)</div>
            <div className="col-span-1 text-right">EST. COST</div>
            <div className="col-span-2 text-right">MODELS</div>
          </div>

          <div className="flex flex-col divide-y divide-border-subtle/50">
            {pagedSessions.length === 0 && (
              <div className="px-6 py-10 text-center font-body-md text-body-md text-on-surface-variant">
                No sessions match your search.
              </div>
            )}
            {pagedSessions.map((s) => (
              <div
                key={`${s.source}:${s.sessionId}`}
                className="grid grid-cols-1 sm:grid-cols-12 gap-y-2 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-surface-container-high/30 transition-colors"
              >
                <div className="col-span-1 sm:col-span-3 flex flex-col justify-center min-w-0">
                  <span className="font-body-md text-body-md text-on-surface truncate">{s.project}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                    {SOURCE_META[s.source]?.label || s.source} · {s.sessionId.slice(0, 8)}…
                  </span>
                </div>
                <div className="col-span-1 sm:col-span-2 flex items-center">
                  <span className="font-label-md text-label-md text-on-surface-variant">{fmtWhen(s.startedAt)}</span>
                </div>
                <div className="col-span-1 sm:col-span-1 flex items-center sm:justify-end">
                  <span className="font-label-md text-label-md text-on-surface-variant">{fmtDuration(s.durationMs)}</span>
                </div>
                <div className="col-span-1 sm:col-span-3 flex items-center sm:justify-end">
                  <span className="font-label-md text-label-md text-on-surface">
                    {fmtTokens(s.inputTokens)} / {fmtTokens(s.outputTokens)} /{" "}
                    <span className="text-on-surface-variant">{fmtTokens(s.cacheReadTokens)}</span>
                  </span>
                </div>
                <div className="col-span-1 sm:col-span-1 flex items-center sm:justify-end">
                  <span className="font-label-md text-label-md text-primary">{fmtUSD(s.costUSD)}</span>
                </div>
                <div className="col-span-1 sm:col-span-2 flex items-center sm:justify-end min-w-0">
                  <span className="font-label-sm text-label-sm text-on-surface-variant truncate" title={s.models.join(", ")}>
                    {s.models.join(", ")}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle bg-surface/30">
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Showing {filteredSessions.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, filteredSessions.length)} of {filteredSessions.length} sessions
            </span>
            <div className="flex items-center gap-2">
              <button
                className="p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:hover:text-on-surface-variant transition-colors"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {page} / {totalPages}
              </span>
              <button
                className="p-1 text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:hover:text-on-surface-variant transition-colors"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <p className="font-label-sm text-label-sm text-on-surface-variant pb-stack-lg">
        {payload.demo
          ? "Sample data shown for illustration."
          : `Imported from local ${payload.sources.map((s) => SOURCE_META[s]?.label || s).join(" and ")} logs at ${fmtWhen(payload.generatedAt)}. The page auto-refreshes every 60 seconds and the API keeps a 60-second parse cache; new Codex/Claude entries appear after the CLI writes them and the next refresh runs. All parsing happens on this machine — nothing is uploaded.`}
      </p>
    </div>
  );
}
