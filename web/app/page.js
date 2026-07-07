import InstallCommand from "./InstallCommand";
import BeforeAfter from "./BeforeAfter";

const NPM_URL = "https://www.npmjs.com/package/@kkothari/tokenpilot";

export default function Home() {
  return (
    <>
      {/* NAV */}
      <nav className="nav">
        <div className="container nav-inner">
          <a className="brand" href="#top">
            <span className="brand-mark">›</span>
            <span>TokenPilot</span>
          </a>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#tools">Supported tools</a>
            <a href="#pricing">Pricing</a>
            <a href={NPM_URL} target="_blank" rel="noreferrer">
              npm ↗
            </a>
          </div>
          <a className="btn btn-primary btn-sm" href="#install">
            Get started
          </a>
        </div>
      </nav>

      {/* HERO */}
      <header id="top" className="hero">
        <div className="container">
          <span className="pill">
            <span className="dot" />
            Terminal-first · zero config · works offline
          </span>
          <h1>
            Focus your prompts.
            <br />
            <span className="accent">Save your tokens.</span>
          </h1>
          <p className="sub">
            TokenPilot is a terminal-first AI assistant that analyzes your
            coding prompts <em>before</em> they reach Cursor or Claude Code —
            flagging broad prompts, estimating token cost, and rewriting vague
            asks into focused ones.
          </p>
          <div id="install" className="hero-cta">
            <InstallCommand />
          </div>
          <p className="hero-note">
            Requires Node 18+. Or install globally:{" "}
            <code>npm i -g @kkothari/tokenpilot</code>
          </p>
        </div>
      </header>

      {/* STATS */}
      <section className="container">
        <div className="stats">
          <div className="stat">
            <div className="num">84%</div>
            <div className="label">fewer tokens on broad prompts</div>
          </div>
          <div className="stat">
            <div className="num">5+</div>
            <div className="label">AI coding tools supported</div>
          </div>
          <div className="stat">
            <div className="num">0</div>
            <div className="label">config or API keys needed</div>
          </div>
          <div className="stat">
            <div className="num">&lt;1s</div>
            <div className="label">analysis, fully offline</div>
          </div>
        </div>
      </section>

      {/* BEFORE / AFTER DEMO */}
      <section className="section" id="demo">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">See it in action</div>
            <h2>One vague prompt. One focused rewrite.</h2>
            <p>
              Broad prompts make your AI search the whole codebase and burn
              context. TokenPilot rewrites them to point at the exact files —
              before you ever hit enter.
            </p>
          </div>
          <BeforeAfter />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">How it works</div>
            <h2>Lives in your terminal, not another tab</h2>
            <p>
              Install once, then run alongside your coding session. The web
              dashboard is only for long-term analytics.
            </p>
          </div>
          <div className="grid grid-3 steps">
            <div className="card step">
              <div className="num">1</div>
              <h3>Install &amp; start</h3>
              <p>
                Run <code>tokenpilot start</code> in your project. It scans your
                files and begins tracking your session instantly.
              </p>
            </div>
            <div className="card step">
              <div className="num">2</div>
              <h3>Paste a prompt</h3>
              <p>
                Before you send a prompt to your AI tool, drop it in. TokenPilot
                scores its breadth and projects its token cost.
              </p>
            </div>
            <div className="card step">
              <div className="num">3</div>
              <h3>Send the focused version</h3>
              <p>
                Copy the rewritten prompt — scoped to real files, with guards
                against unnecessary refactors — and get better results for less.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">What it catches</div>
            <h2>The patterns that quietly waste tokens</h2>
          </div>
          <div className="grid grid-3">
            <Feature icon="🎯" title="Broad-prompt detection">
              Flags vague verbs, whole-codebase scope, and missing file
              references that trigger expensive full-project searches.
            </Feature>
            <Feature icon="🧮" title="Token &amp; cost estimation">
              Projects how many tokens a prompt will burn once your AI starts
              exploring — with a dollar estimate per provider.
            </Feature>
            <Feature icon="📁" title="File relevance suggestions">
              Scans your project and names the exact files most likely involved,
              so the rewrite is concrete, not generic.
            </Feature>
            <Feature icon="✍️" title="Focused rewrites">
              Preserves your intent, adds a starting point and a scope guard,
              and asks the AI to report back — the smallest useful change.
            </Feature>
            <Feature icon="📊" title="Session tracking">
              Every prompt, its breadth, and tokens saved are logged locally so
              you can see your impact over time.
            </Feature>
            <Feature icon="🔁" title="Duplicate detection">
              Spots near-identical prompts from earlier in your session so your
              AI doesn&apos;t repeat work you&apos;ve already paid for.
            </Feature>
          </div>
        </div>
      </section>

      {/* TOOLS */}
      <section className="section" id="tools">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Works with your stack</div>
            <h2>Tool-agnostic by design</h2>
            <p>
              TokenPilot optimizes the prompt, not the tool — so it helps no
              matter what you paste it into.
            </p>
          </div>
          <div className="grid grid-4">
            {["Claude Code", "Cursor", "Codex", "Gemini CLI", "Aider", "Windsurf", "Copilot", "Cline"].map(
              (t) => (
                <div className="tool" key={t}>
                  <span className="tdot" />
                  {t}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="section" id="pricing">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Pricing</div>
            <h2>Start free. Upgrade when it pays for itself.</h2>
          </div>
          <div className="pricing">
            <PriceCard
              tier="Hobby"
              amount="$0"
              per="/ forever"
              tagline="Everything you need in the terminal."
              cta="Install now"
              ctaHref="#install"
              features={[
                "Prompt analysis & rewrites",
                "Token & cost estimation",
                "File relevance suggestions",
                "Local session tracking",
                "All AI tools supported",
              ]}
            />
            <PriceCard
              featured
              tier="Pro"
              amount="$9"
              per="/ month"
              tagline="For developers who live in the terminal."
              cta="Start free trial"
              ctaHref="#install"
              features={[
                "Everything in Hobby",
                "Cloud dashboard & analytics",
                "Cross-project trends",
                "AI-powered rewrites",
                "Prompt history sync",
              ]}
            />
            <PriceCard
              tier="Team"
              amount="$29"
              per="/ user / mo"
              tagline="Shared insights across your whole team."
              cta="Contact us"
              ctaHref="#install"
              features={[
                "Everything in Pro",
                "Team-wide savings reports",
                "Shared prompt playbooks",
                "SSO & admin controls",
                "Priority support",
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container">
        <div className="cta-band">
          <h2>Stop paying for prompts that wander.</h2>
          <p>Install TokenPilot and focus your very next prompt.</p>
          <div className="hero-cta">
            <InstallCommand />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <a className="brand" href="#top">
              <span className="brand-mark">›</span>
              <span>TokenPilot</span>
            </a>
            <p className="muted">
              Grammarly for AI coding prompts — built for the terminal.
            </p>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#demo">Demo</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <a href={NPM_URL} target="_blank" rel="noreferrer">
                npm package
              </a>
              <a href="#install">Install</a>
              <a href="#tools">Supported tools</a>
            </div>
          </div>
        </div>
        <div className="container" style={{ marginTop: 32 }}>
          <p className="muted">© {new Date().getFullYear()} TokenPilot</p>
        </div>
      </footer>
    </>
  );
}

function Feature({ icon, title, children }) {
  return (
    <div className="card">
      <div className="icon">{icon}</div>
      <h3 dangerouslySetInnerHTML={{ __html: title }} />
      <p>{children}</p>
    </div>
  );
}

function PriceCard({ tier, amount, per, tagline, features, cta, ctaHref, featured }) {
  return (
    <div className={`price-card${featured ? " featured" : ""}`}>
      {featured && <div className="price-badge">Most popular</div>}
      <div className="tier">{tier}</div>
      <div className="amount">
        {amount} <span>{per}</span>
      </div>
      <div className="tagline">{tagline}</div>
      <ul>
        {features.map((f) => (
          <li key={f}>
            <span className="check">✓</span>
            {f}
          </li>
        ))}
      </ul>
      <a className={`btn ${featured ? "btn-primary" : "btn-ghost"}`} href={ctaHref}>
        {cta}
      </a>
    </div>
  );
}
