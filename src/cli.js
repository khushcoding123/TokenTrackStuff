// Argument parsing and command dispatch for the `metriq` CLI.

import { runAnalyze } from "./commands/analyze.js";
import { runStart } from "./commands/start.js";
import { runStats, runHistory, runReset } from "./commands/stats.js";
import { runTrace } from "./commands/trace.js";
import { colors } from "./ui/colors.js";
import { banner } from "./ui/format.js";
import { PROVIDERS, DEFAULT_PROVIDER } from "../packages/core/config.js";

const VERSION = "0.1.0";

// Minimal flag parser: separates --flags (and --key value) from positionals.
function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (key.startsWith("no-")) {
        flags[key.slice(3)] = false;
      } else if (key === "json" || key === "help" || key === "version") {
        flags[key] = true;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

function printHelp() {
  const c = colors;
  console.log(`
${banner()}

${c.bold("USAGE")}
  metriq <command> [options]

${c.bold("COMMANDS")}
  ${c.cyan("start")}                 Launch the interactive terminal companion (REPL)
  ${c.cyan("trace")}                 Start token tracking: read your AI agents' usage and
                        open a live localhost dashboard
  ${c.cyan("analyze")} ${c.gray('"<prompt>"')}   Analyze a single prompt and suggest a focused rewrite
  ${c.cyan("stats")}                 Show token-savings analytics for this session
  ${c.cyan("history")}               List every prompt analyzed this session
  ${c.cyan("reset")}                 Clear the current session and start fresh
  ${c.cyan("help")}                  Show this help

${c.bold("OPTIONS")}
  ${c.gray("--provider <id>")}       Pricing model for $ estimates ${c.gray(
    `(default: ${DEFAULT_PROVIDER})`
  )}
                        ${c.gray(Object.keys(PROVIDERS).join(", "))}
  ${c.gray("--json")}                Machine-readable output (analyze)
  ${c.gray("--no-scan")}             Skip the project file scan
  ${c.gray("--no-track")}            Don't record this prompt in the session
  ${c.gray("--version")}             Print version

${c.bold("EXAMPLES")}
  ${c.gray("$")} metriq analyze ${c.gray('"Fix the dashboard bug"')}
  ${c.gray("$")} metriq analyze ${c.gray('"add auth"')} --provider claude-opus
  ${c.gray("$")} metriq start
  ${c.gray("$")} metriq stats
`);
}

export function run(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);

  if (flags.version) {
    console.log(`metriq ${VERSION}`);
    return 0;
  }

  const command = positionals[0] || (flags.help ? "help" : "help");

  switch (command) {
    case "analyze": {
      const prompt = positionals.slice(1).join(" ");
      return runAnalyze(prompt, flags);
    }
    case "start":
      return runStart(flags);
    case "trace":
      return runTrace(flags);
    case "stats":
      return runStats(flags);
    case "history":
      return runHistory(flags);
    case "reset":
      return runReset(flags);
    case "help":
      printHelp();
      return 0;
    default:
      console.error(
        colors.red(`Unknown command: ${command}`) +
          "\n  Run " +
          colors.cyan("metriq help") +
          " to see available commands."
      );
      return 1;
  }
}
