// `metriq stats` — session analytics summary.
// `metriq history` — the full prompt log.
// `metriq reset` — start a fresh session.

import { load, summarize, reset as resetSession, SESSION_FILE } from "../core/session.js";
import { colors } from "../ui/colors.js";
import { banner, num, money, bar } from "../ui/format.js";
import { DEFAULT_PROVIDER, PROVIDERS } from "../../packages/core/config.js";

function truncate(s, n = 52) {
  s = String(s).replace(/\s+/g, " ");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function runStats(flags = {}) {
  const provider = flags.provider || DEFAULT_PROVIDER;
  const s = summarize(load(), provider);

  console.log("");
  console.log(banner());

  if (s.total === 0) {
    console.log(
      colors.gray(
        "\n  No prompts tracked yet. Run `metriq start` or `metriq analyze \"…\"`.\n"
      )
    );
    return 0;
  }

  const label = (PROVIDERS[provider] || PROVIDERS[DEFAULT_PROVIDER]).label;
  console.log(
    colors.gray(
      `  Session ${s.id} · since ${new Date(s.startedAt).toLocaleString()} · ${label}\n`
    )
  );

  const row = (k, v) => console.log(`  ${colors.gray(k.padEnd(20))}${v}`);
  row("Prompts analyzed", num(s.total));
  row("Broad prompts", `${num(s.broad)} ${colors.gray(`of ${num(s.total)}`)}`);
  row("Projected tokens", colors.cyan(num(s.projectedTokens)));
  row("Optimized tokens", num(s.optimizedTokens));
  row(
    "Tokens saved",
    colors.green(`~${num(s.savedTokens)}`) + colors.gray(`  (${s.savedPct}%)`)
  );
  row("Estimated $ saved", colors.green(money(s.dollarsSaved)));
  console.log(`  ${colors.gray("Savings".padEnd(20))}${bar(s.savedPct)}`);

  if (s.mostExpensive.length) {
    console.log("\n  " + colors.bold("Most expensive prompts"));
    for (const p of s.mostExpensive) {
      console.log(
        `  ${colors.yellow(String(num(p.projectedTokens)).padStart(7))}  ${colors.gray(
          truncate(p.prompt)
        )}`
      );
    }
  }

  if (s.biggestSavers.some((p) => p.savedTokens > 0)) {
    console.log("\n  " + colors.bold("Biggest savers"));
    for (const p of s.biggestSavers) {
      if (!p.savedTokens) continue;
      console.log(
        `  ${colors.green("-" + num(p.savedTokens)).padStart(18)}  ${colors.gray(
          truncate(p.prompt)
        )}`
      );
    }
  }

  console.log(colors.gray(`\n  Data: ${SESSION_FILE}\n`));
  return 0;
}

export function runHistory() {
  const session = load();
  const prompts = session.prompts || [];
  console.log("");
  console.log(banner());
  if (prompts.length === 0) {
    console.log(colors.gray("\n  No prompt history yet.\n"));
    return 0;
  }
  console.log("");
  prompts.forEach((p, i) => {
    const tag =
      p.rating === "broad"
        ? colors.red("BROAD")
        : p.rating === "moderate"
        ? colors.yellow("MOD ")
        : colors.green("OK  ");
    console.log(
      `  ${colors.gray(String(i + 1).padStart(3))}. [${tag}] ` +
        `${colors.cyan(String(num(p.projectedTokens)).padStart(6))}t  ` +
        colors.gray(truncate(p.prompt, 56))
    );
  });
  console.log("");
  return 0;
}

export function runReset() {
  resetSession();
  console.log(colors.green("\n  ✓ Session reset. A fresh session has begun.\n"));
  return 0;
}
