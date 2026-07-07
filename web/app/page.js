import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

export const metadata = { title: "Overview — Metriq" };

const METRICS = [
  { label: "Total Tokens Intercepted", value: "1.42B", note: "+12% this week", noteIcon: "trending_up", tone: "primary" },
  { label: "Current Run Rate", value: "$4,209", note: "Estimated monthly", tone: "muted" },
  { label: "Net Savings", value: "$1,150", note: "Real-time compression", noteIcon: "verified", tone: "primary" },
  { label: "System Efficiency", value: "98.4%", note: "12ms avg latency", noteIcon: "speed", tone: "muted" },
];

const CHART_BARS = [
  { raw: 40, optimized: 25 },
  { raw: 60, optimized: 35 },
  { raw: 45, optimized: 20 },
  { raw: 80, optimized: 45 },
  { raw: 55, optimized: 30 },
  { raw: 90, optimized: 50 },
  { raw: 70, optimized: 40 },
];

const LOG_LINES = [
  { time: "14:02:01", tag: "INFO", tagClass: "text-tertiary", text: "Connection established to upstream router us-east-1.", dim: true },
  { time: "14:02:03", tag: "EXEC", tagClass: "text-primary", text: "Intercepting payload id=req_8f72a. Analyzing syntax…" },
  { time: "14:02:04", tag: "COMP", tagClass: "text-secondary", text: "Redundant context removed. Tokens: 4,092 → 1,204.", highlight: true },
  { time: "14:02:04", tag: "EXEC", tagClass: "text-primary", text: "Routing to cost-optimal node (Llama-3-70b-instruct)." },
  { time: "14:02:08", tag: "INFO", tagClass: "text-tertiary", text: "Response received in 340ms. Returning to client.", dim: true },
  { time: "14:02:11", tag: "EXEC", tagClass: "text-primary", text: "Intercepting payload id=req_9a11b. Analyzing syntax…" },
  { time: "14:02:12", tag: "COMP", tagClass: "text-secondary", text: "Semantic deduplication applied. Tokens: 8,192 → 3,450.", highlight: true },
];

export default function OverviewPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar active="overview" />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] bg-secondary-container/5 rounded-full blur-[100px]" />
        </div>

        <TopBar searchPlaceholder="Search resources…" />

        <main className="flex-1 w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-stack-xl z-10 relative">
          <section className="pt-24 pb-16 md:pt-32 md:pb-24 flex flex-col items-start gap-stack-lg border-b border-border-subtle/50">
            <h1 className="font-display text-headline-lg-mobile md:text-display text-on-background max-w-3xl leading-tight tracking-tight">
              Optimize every prompt before it costs you.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mb-stack-md">
              Real-time token analysis and routing engine. Intercept, compress, and dispatch LLM queries with sub-millisecond latency.
            </p>
            <a
              className="bg-primary/10 border border-primary text-primary px-6 py-3 rounded-lg font-label-md text-label-md hover:bg-primary/20 transition-all duration-300 flex items-center gap-2 group backdrop-blur-sm"
              href="/prompt-studio"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">bolt</span>
              Optimize Prompt
            </a>
          </section>

          <section className="py-stack-xl flex flex-col md:flex-row gap-stack-lg md:gap-0 border-b border-border-subtle/50">
            {METRICS.map((m, i) => (
              <div
                key={m.label}
                className={`flex-1 flex flex-col gap-unit px-0 md:px-gutter ${
                  i < METRICS.length - 1 ? "md:border-r border-border-subtle/50" : ""
                }`}
              >
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
                <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                  {m.noteIcon && <span className="material-symbols-outlined text-[14px]">{m.noteIcon}</span>}
                  {m.note}
                </span>
              </div>
            ))}
          </section>

          <section className="pt-stack-xl grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            <div className="lg:col-span-7 flex flex-col gap-stack-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-md text-headline-md text-on-background">Compression Yield</h3>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant">
                    <span className="w-2 h-2 rounded-full bg-surface-variant" /> Raw
                  </span>
                  <span className="flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Optimized
                  </span>
                </div>
              </div>

              <div className="h-64 flex items-end justify-between gap-1 mt-4 relative">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                  <div className="w-full border-b border-border-subtle" />
                  <div className="w-full border-b border-border-subtle" />
                  <div className="w-full border-b border-border-subtle" />
                  <div className="w-full border-b border-border-subtle" />
                </div>
                {CHART_BARS.map((bar, i) => (
                  <div key={i} className="relative flex gap-unit w-full h-full items-end cursor-pointer">
                    <div
                      className="w-1/2 bg-surface-variant/50 rounded-t-sm hover:bg-surface-variant transition-colors"
                      style={{ height: `${bar.raw}%` }}
                    />
                    <div
                      className="w-1/2 bg-primary/70 rounded-t-sm hover:bg-primary transition-colors"
                      style={{ height: `${bar.optimized}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col h-full pl-0 lg:pl-gutter border-l-0 lg:border-l border-border-subtle/30 mt-stack-xl lg:mt-0">
              <div className="flex items-center justify-between mb-stack-md">
                <h3 className="font-headline-md text-headline-md text-on-background flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">terminal</span>
                  Live Engine Feed
                </h3>
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              </div>

              <div className="flex flex-col gap-2 font-label-md text-label-sm md:text-label-md text-on-surface-variant overflow-y-auto max-h-[300px] leading-relaxed">
                {LOG_LINES.map((line, i) => (
                  <div key={i} className={`flex items-start gap-3 ${line.dim ? "opacity-60" : ""}`}>
                    <span className="text-border-subtle shrink-0">{line.time}</span>
                    <span className={`${line.tagClass} shrink-0`}>[{line.tag}]</span>
                    <span className={`break-all ${line.highlight ? "text-on-background" : ""}`}>{line.text}</span>
                  </div>
                ))}
                <div className="flex items-start gap-3">
                  <span className="text-border-subtle shrink-0 animate-pulse text-primary">_</span>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
