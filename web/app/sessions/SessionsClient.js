"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadCSV } from "../lib/csv.js";
import { useToast } from "../components/ToastProvider";

const STATUS_STYLES = {
  Completed: { icon: "memory", iconClass: "text-primary", dotClass: "bg-primary shadow-[0_0_8px_rgba(75,226,119,0.8)]", badgeClass: "bg-primary/10 border-primary/20", textClass: "text-primary" },
  Running: { icon: "database", iconClass: "text-secondary", dotClass: "bg-secondary animate-pulse", badgeClass: "bg-secondary/10 border-secondary/20", textClass: "text-secondary" },
  Failed: { icon: "warning", iconClass: "text-error", dotClass: "bg-error", badgeClass: "bg-error/10 border-error/20", textClass: "text-error" },
  Queued: { icon: "schedule", iconClass: "text-tertiary", dotClass: "bg-tertiary", badgeClass: "bg-tertiary/10 border-tertiary/20", textClass: "text-tertiary" },
};

const SESSIONS = [
  { id: "#EX-992A", project: "Neural Net Alpha", detail: "Epoch 50/100 completed successfully", duration: "02:14:30", status: "Completed", logs: ["[14:00:01] Starting epoch 50/100", "[14:12:44] Loss: 0.0421, Accuracy: 97.8%", "[14:14:30] Checkpoint saved to /ckpt/alpha-50.pt", "[14:14:30] Run completed successfully."] },
  { id: "#IN-441B", project: "Data Ingestion V2", detail: "Processing 4.2TB raw text corpus", duration: "45:12", status: "Running", logs: ["[13:20:00] Ingest job started", "[13:32:11] 1.1TB / 4.2TB processed", "[14:05:12] 2.9TB / 4.2TB processed — still running"] },
  { id: "#EX-991A", project: "Model Training", detail: "OOM Error on Node 4 during backprop", duration: "00:04:12", status: "Failed", logs: ["[09:00:00] Job started on 4 nodes", "[09:03:58] Node 4: CUDA out of memory", "[09:04:12] Job terminated: OOM"] },
  { id: "#SCH-001", project: "Neural Net Alpha", detail: "Scheduled execution for standard reporting", duration: "--:--:--", status: "Queued", logs: ["[--:--:--] Waiting for scheduler slot"] },
  { id: "#EX-988C", project: "Model Training", detail: "Epoch 12/50 in progress", duration: "18:02", status: "Running", logs: ["[10:00:00] Starting epoch 12/50", "[10:18:02] Loss: 0.512 — still training"] },
  { id: "#IN-440A", project: "Data Ingestion V2", detail: "Nightly batch completed", duration: "01:02:10", status: "Completed", logs: ["[02:00:00] Nightly batch started", "[03:02:10] Batch completed, 0 errors"] },
  { id: "#EX-987B", project: "Neural Net Alpha", detail: "Validation sweep across 6 configs", duration: "00:41:55", status: "Completed", logs: ["[11:00:00] Sweep started (6 configs)", "[11:41:55] Best config: lr=3e-4, completed"] },
  { id: "#EX-986Z", project: "Model Training", detail: "Node 2 disk pressure during checkpoint", duration: "00:02:47", status: "Failed", logs: ["[08:10:00] Checkpoint write started", "[08:12:47] Node 2: disk pressure, write aborted"] },
  { id: "#IN-439X", project: "Data Ingestion V2", detail: "Scheduled for 03:00 UTC", duration: "--:--:--", status: "Queued", logs: ["[--:--:--] Waiting for scheduler slot"] },
  { id: "#EX-985Q", project: "Neural Net Alpha", detail: "Distillation pass 3/3", duration: "03:12:09", status: "Completed", logs: ["[06:00:00] Distillation pass 3 started", "[09:12:09] Pass complete, model exported"] },
];

const PROJECTS = ["All Projects", ...Array.from(new Set(SESSIONS.map((s) => s.project)))];
const PAGE_SIZE = 4;

export default function SessionsClient() {
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("All Projects");
  const [page, setPage] = useState(1);
  const [logsFor, setLogsFor] = useState(null);
  const [menuFor, setMenuFor] = useState(null);

  useEffect(() => setPage(1), [query, projectFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SESSIONS.filter((s) => {
      const matchesProject = projectFilter === "All Projects" || s.project === projectFilter;
      const matchesQuery =
        !q || s.id.toLowerCase().includes(q) || s.project.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q);
      return matchesProject && matchesQuery;
    });
  }, [query, projectFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeLogs = SESSIONS.find((s) => s.id === logsFor);

  const handleExportAll = () => {
    downloadCSV(
      "metriq-sessions.csv",
      filtered.map(({ logs, ...rest }) => rest)
    );
    notify(`Exported ${filtered.length} session(s) to CSV`);
  };

  const handleExportRow = (session) => {
    const { logs, ...rest } = session;
    downloadCSV(`metriq-session-${session.id.replace("#", "")}.csv`, [rest]);
    setMenuFor(null);
    notify(`Exported ${session.id}`);
  };

  const handleCopyId = async (session) => {
    try {
      await navigator.clipboard.writeText(session.id);
      notify(`Copied ${session.id}`);
    } catch {
      notify("Clipboard unavailable in this browser");
    }
    setMenuFor(null);
  };

  return (
    <div className="flex-1 p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto w-full space-y-stack-xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Sessions &amp; History
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Review and manage recent execution logs and pipeline sessions.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none">
              search
            </span>
            <input
              className="bg-surface-glass border border-border-subtle rounded py-2 pl-9 pr-3 text-label-md font-label-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-48"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions…"
              type="text"
              value={query}
            />
          </div>
          <div className="relative">
            <select
              className="appearance-none bg-surface-glass border border-border-subtle rounded py-2 pl-4 pr-10 text-label-md font-label-md text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary hover:border-primary/50 transition-colors cursor-pointer"
              onChange={(e) => setProjectFilter(e.target.value)}
              value={projectFilter}
            >
              {PROJECTS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-sm">
              expand_more
            </span>
          </div>
          <button
            className="bg-surface-glass border border-border-subtle hover:border-primary/50 text-on-surface font-label-md text-label-md py-2 px-4 rounded transition-all duration-200 flex items-center gap-2"
            onClick={handleExportAll}
            type="button"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export
          </button>
        </div>
      </div>

      <div className="bg-surface-glass border border-border-subtle rounded-xl overflow-hidden flex flex-col">
        <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-4 border-b border-border-subtle bg-surface/50 font-label-sm text-label-sm text-on-surface-variant">
          <div className="col-span-3 lg:col-span-2">SESSION ID</div>
          <div className="col-span-4 lg:col-span-4">PROJECT / DESCRIPTION</div>
          <div className="col-span-2 lg:col-span-2 text-right">DURATION</div>
          <div className="col-span-2 lg:col-span-2">STATUS</div>
          <div className="col-span-1 lg:col-span-2 text-right">ACTIONS</div>
        </div>

        <div className="flex flex-col divide-y divide-border-subtle/50">
          {paged.length === 0 && (
            <div className="px-6 py-10 text-center font-body-md text-body-md text-on-surface-variant">
              No sessions match your filters.
            </div>
          )}
          {paged.map((s) => {
            const style = STATUS_STYLES[s.status];
            return (
              <div
                className="grid grid-cols-1 sm:grid-cols-12 gap-y-2 sm:gap-4 px-4 sm:px-6 py-4 hover:bg-surface-container-high/30 transition-colors group relative"
                key={s.id}
              >
                <div className="col-span-1 sm:col-span-3 lg:col-span-2 flex items-center gap-2">
                  <span className={`material-symbols-outlined text-sm ${style.iconClass}`}>{style.icon}</span>
                  <span className="font-label-md text-label-md text-on-surface">{s.id}</span>
                </div>
                <div className="col-span-1 sm:col-span-4 lg:col-span-4 flex flex-col justify-center">
                  <span className="font-body-md text-body-md text-on-surface">{s.project}</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{s.detail}</span>
                </div>
                <div className="col-span-1 sm:col-span-2 lg:col-span-2 flex items-center sm:justify-end">
                  <span className="font-label-md text-label-md text-on-surface-variant">{s.duration}</span>
                </div>
                <div className="col-span-1 sm:col-span-2 lg:col-span-2 flex items-center">
                  <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border w-fit ${style.badgeClass}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${style.dotClass}`} />
                    <span className={`font-label-sm text-label-sm ${style.textClass}`}>{s.status}</span>
                  </div>
                </div>
                <div className="col-span-1 sm:col-span-1 lg:col-span-2 flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container"
                    onClick={() => setLogsFor(s.id)}
                    title="View logs"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm">terminal</span>
                  </button>
                  <div className="relative">
                    <button
                      className="p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container"
                      onClick={() => setMenuFor((cur) => (cur === s.id ? null : s.id))}
                      title="More options"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">more_vert</span>
                    </button>
                    {menuFor === s.id && (
                      <div className="absolute right-0 mt-1 w-44 glass-card p-1 shadow-lg z-50">
                        <button
                          className="w-full text-left px-3 py-2 rounded font-label-sm text-label-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                          onClick={() => handleCopyId(s)}
                          type="button"
                        >
                          Copy session ID
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 rounded font-label-sm text-label-sm text-on-surface hover:bg-surface-container-highest transition-colors"
                          onClick={() => handleExportRow(s)}
                          type="button"
                        >
                          Export row
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle bg-surface/30">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} sessions
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

      {activeLogs && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setLogsFor(null)}
        >
          <div
            className="glass-card w-full max-w-2xl max-h-[70vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 h-12 border-b border-border-subtle">
              <span className="font-label-md text-label-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">terminal</span>
                {activeLogs.id} logs
              </span>
              <button
                className="text-on-surface-variant hover:text-on-surface"
                onClick={() => setLogsFor(null)}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-4 overflow-auto font-label-md text-label-sm text-on-surface-variant bg-terminal-black flex-1 space-y-1">
              {activeLogs.logs.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
