"use client";

import { downloadCSV } from "../lib/csv.js";
import { useToast } from "../components/ToastProvider";

export default function OptimizationLogTable({ rows }) {
  const { notify } = useToast();

  const handleExport = () => {
    downloadCSV("metriq-optimization-log.csv", rows);
    notify(`Exported ${rows.length} project(s) to CSV`);
  };

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="p-6 border-b border-border-subtle flex justify-between items-center">
        <h3 className="font-headline-md text-headline-md">Project Optimization Log</h3>
        <button
          className="px-4 py-2 bg-surface-container-highest border border-border-subtle rounded-md text-label-sm font-label-sm hover:bg-surface-bright transition-colors flex items-center gap-2"
          onClick={handleExport}
          type="button"
        >
          <span className="material-symbols-outlined text-sm">download</span> Export Data
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-container-lowest/50">
              <th className="p-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Project Name</th>
              <th className="p-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Tokens Saved</th>
              <th className="p-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Compute (h)</th>
              <th className="p-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Efficiency Gain</th>
              <th className="p-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Status</th>
            </tr>
          </thead>
          <tbody className="font-body-sm text-body-sm">
            {rows.map((row, i) => (
              <tr
                className={`hover:bg-surface-container-highest/40 transition-colors ${i < rows.length - 1 ? "border-b border-border-subtle" : ""}`}
                key={row.project}
              >
                <td className="p-4 font-label-md text-label-md">{row.project}</td>
                <td className="p-4 text-on-surface-variant">{row.tokens}</td>
                <td className="p-4 text-on-surface-variant">{row.compute}</td>
                <td className="p-4 text-primary">{row.gain}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-2 ${row.status === "Active" ? "text-primary" : "text-on-surface-variant"}`}>
                    <span className={`w-2 h-2 rounded-full ${row.status === "Active" ? "bg-primary animate-pulse" : "bg-surface-variant"}`} />
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
