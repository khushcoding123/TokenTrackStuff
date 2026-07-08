// `metriq start` — the always-on terminal companion.
//
// Opens an interactive REPL that analyzes every prompt you paste before you
// send it to your AI coding tool, shows a focused rewrite, and tracks running
// token savings for the session. This is the primary metriq experience.
//
// (Account linking / browser auth is stubbed for the MVP — see the note printed
// on launch. Analysis and tracking work fully offline today.)

import readline from "node:readline";
import { optimize } from "../../packages/core/rewrite.js";
import { scanProjectContext } from "../../packages/core/scanner.js";
import { renderAnalysis, banner, num, money } from "../ui/format.js";
import { colors } from "../ui/colors.js";
import { load, record, summarize } from "../core/session.js";
import { DEFAULT_PROVIDER } from "../../packages/core/config.js";

export function runStart(flags = {}) {
  const provider = flags.provider || DEFAULT_PROVIDER;

  console.log("");
  console.log(banner());
  console.log(
    colors.gray("  Paste a prompt.")
  );
  console.log(
    colors.gray("  ") +
      colors.cyan(":stats") +
      colors.gray("  ") +
      colors.cyan(":clear") +
      colors.gray("  ") +
      colors.cyan(":quit") +
      colors.gray("")
  );
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.cyan("metriq") + colors.gray(" › "),
  });

  // Keep an in-memory history for duplicate detection within this REPL.
  const history = (load().prompts || []).map((p) => p.prompt);

  rl.prompt();

  rl.on("line", (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // REPL commands.
    if (input === ":quit" || input === ":q" || input === ":exit") {
      rl.close();
      return;
    }
    if (input === ":clear" || input === ":cls") {
      console.clear();
      rl.prompt();
      return;
    }
    if (input === ":stats") {
      printMiniStats(provider);
      rl.prompt();
      return;
    }

    // Analyze the prompt.
    const projectContext =
      flags.scan === false
        ? { files: [], candidates: [], confidence: "low", subsystem: "" }
        : scanProjectContext(input, process.cwd());
    const result = optimize(input, { projectContext, history });

    console.log(
      renderAnalysis(result.analysis, {
        optimize: result,
        projectContext,
        provider,
      })
    );

    history.push(input);
    record({
      prompt: input,
      breadthScore: result.analysis.breadthScore,
      rating: result.analysis.rating,
      projectedTokens: result.analysis.projectedTokens,
      optimizedTokens: result.rewrittenAnalysis.projectedTokens,
      savedTokens: result.savedTokens,
    });

    rl.prompt();
  });

  rl.on("close", () => {
    const s = summarize(load(), provider);
    console.log("");
    console.log(
      colors.gray("  Session ended · ") +
        `${num(s.total)} prompts analyzed, ` +
        colors.green(`~${num(s.savedTokens)} tokens saved`) +
        colors.gray(` (≈ ${money(s.dollarsSaved)})`)
    );
    console.log("");
    process.exit(0);
  });
}

function printMiniStats(provider) {
  const s = summarize(load(), provider);
  console.log("");
  console.log(
    colors.bold("  This session  ") +
      colors.gray(`${num(s.total)} prompts · ${num(s.broad)} broad`)
  );
  console.log(
    `  Projected ${colors.cyan(num(s.projectedTokens))} tokens · ` +
      colors.green(`saved ~${num(s.savedTokens)} (${s.savedPct}%)`) +
      colors.gray(` ≈ ${money(s.dollarsSaved)}`)
  );
  console.log("");
}
