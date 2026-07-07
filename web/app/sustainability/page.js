import { Fragment } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import OptimizationLogTable from "./OptimizationLogTable";

export const metadata = { title: "Sustainability" };

const METRIC_CARDS = [
  { label: "Water Conservation", icon: "water_drop", iconClass: "text-secondary", labelClass: "text-secondary", value: "14,205", unit: "gal", note: "Cooling water saved vs baseline", delta: "+12%" },
  { label: "Energy Efficiency", icon: "electric_bolt", iconClass: "text-tertiary", labelClass: "text-tertiary", value: "8,940", unit: "kWh", note: "Compute energy reduced", delta: "+18%" },
  { label: "Carbon Reduction", icon: "co2", iconClass: "text-primary", labelClass: "text-primary", value: "3.2", unit: "tons", note: "CO2 equivalent mitigated", delta: "+24%" },
];

const PIPELINE_NODES = [
  { icon: "model_training", title: "Optimized Prompts", note: "Context compression applied", accent: "primary" },
  { icon: "data_object", title: "Fewer Tokens", note: "-42% sequence length", accent: "secondary" },
  { icon: "memory_alt", title: "Reduced Compute", note: "Lower GPU utilization", accent: "secondary" },
];

const LOG_ROWS = [
  { project: "Alpha-Core-Refactor", tokens: "1.2M", compute: "-45.2", gain: "+28%", status: "Active" },
  { project: "Beta-Data-Pipeline", tokens: "850K", compute: "-32.0", gain: "+15%", status: "Completed" },
  { project: "Gamma-Model-Eval", tokens: "2.4M", compute: "-89.5", gain: "+42%", status: "Active" },
];

export default function SustainabilityPage() {
  return (
    <div className="flex min-h-screen bg-mesh">
      <Sidebar active="sustainability" />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <TopBar searchPlaceholder="Search…" />

        <div className="p-margin-mobile md:p-margin-desktop max-w-container-max mx-auto w-full">
          <div className="mb-stack-xl">
            <h2 className="font-headline-lg text-headline-lg mb-2">
              <span className="gradient-text">Environmental Impact</span> Metrics
            </h2>
            <p className="text-on-surface-variant font-body-lg text-body-lg max-w-2xl">
              Quantifying the resource efficiency of your AI operations. High-precision monitoring of computational waste reduction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-xl">
            {METRIC_CARDS.map((m) => (
              <div key={m.label} className="glass-panel rounded-xl p-6 relative overflow-hidden group hover:border-primary/50 transition-colors duration-300">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className={`material-symbols-outlined text-[100px] ${m.iconClass}`}>{m.icon}</span>
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                  <div>
                    <span className={`font-label-sm text-label-sm ${m.labelClass} uppercase tracking-widest block mb-2`}>
                      {m.label}
                    </span>
                    <h3 className="font-display text-[40px] leading-tight text-on-surface">
                      {m.value} <span className="text-body-md text-on-surface-variant font-normal">{m.unit}</span>
                    </h3>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-body-sm font-body-sm text-on-surface-variant">{m.note}</span>
                    <span className="inline-flex items-center gap-1 text-primary text-label-sm font-label-sm bg-primary/10 px-2 py-1 rounded">
                      <span className="material-symbols-outlined text-sm">trending_up</span> {m.delta}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-xl p-8 mb-stack-xl">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-subtle">
              <h3 className="font-headline-md text-headline-md">Efficiency Pipeline</h3>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">
                System Architecture
              </span>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-8 relative">
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-[2px] bg-surface-container-highest -z-10 -translate-y-1/2" />
              <div className="hidden md:block absolute top-1/2 left-0 w-[75%] h-[2px] bg-gradient-to-r from-primary to-secondary -z-10 -translate-y-1/2 shadow-[0_0_10px_rgba(75,226,119,0.5)]" />

              {PIPELINE_NODES.map((node, i) => (
                <Fragment key={node.title}>
                  <div className="flex flex-col items-center gap-4 bg-surface p-4 rounded-lg border border-border-subtle w-full md:w-64 z-10 relative">
                    <div
                      className={`w-12 h-12 rounded-full bg-surface-container-highest border flex items-center justify-center ${
                        node.accent === "primary"
                          ? "border-primary shadow-[0_0_15px_rgba(75,226,119,0.2)]"
                          : "border-secondary shadow-[0_0_15px_rgba(173,198,255,0.2)]"
                      }`}
                    >
                      <span className={`material-symbols-outlined ${node.accent === "primary" ? "text-primary" : "text-secondary"}`}>
                        {node.icon}
                      </span>
                    </div>
                    <div className="text-center">
                      <h4 className="font-label-md text-label-md font-bold mb-1">{node.title}</h4>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">{node.note}</p>
                    </div>
                  </div>
                  {i < PIPELINE_NODES.length - 1 && (
                    <span className="material-symbols-outlined text-on-surface-variant md:hidden rotate-90">arrow_forward</span>
                  )}
                </Fragment>
              ))}

              <span className="material-symbols-outlined text-on-surface-variant md:hidden rotate-90">arrow_forward</span>

              <div className="flex flex-col items-center gap-4 bg-primary-container p-4 rounded-lg border border-primary w-full md:w-64 z-10 relative">
                <div className="w-12 h-12 rounded-full bg-surface border border-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">public</span>
                </div>
                <div className="text-center">
                  <h4 className="font-label-md text-label-md font-bold text-on-primary-container mb-1">Lower Impact</h4>
                  <p className="font-body-sm text-body-sm text-on-primary-container/80">Sustainable AI Operations</p>
                </div>
              </div>
            </div>
          </div>

          <OptimizationLogTable rows={LOG_ROWS} />
        </div>
      </div>
    </div>
  );
}
