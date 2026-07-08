// `metriq analyze "<prompt>"` — analyze one prompt and suggest a focused
// rewrite. Supports --json for programmatic use and --no-scan to skip the disk
// scan.

import { optimize } from "../../packages/core/rewrite.js";
import { scanProjectContext } from "../../packages/core/scanner.js";
import { renderAnalysis, banner } from "../ui/format.js";
import { colors } from "../ui/colors.js";
import { record } from "../core/session.js";
import { DEFAULT_PROVIDER } from "../../packages/core/config.js";

export function runAnalyze(prompt, flags = {}) {
  if (!prompt || !prompt.trim()) {
    console.error(
      colors.red("No prompt provided.") +
        '  Usage: metriq analyze "your prompt here"'
    );
    return 1;
  }

  const provider = flags.provider || DEFAULT_PROVIDER;
  const projectContext =
    flags.scan === false
      ? { files: [], candidates: [], confidence: "low", subsystem: "" }
      : scanProjectContext(prompt, process.cwd());

  const result = optimize(prompt, { projectContext });

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          prompt,
          breadthScore: result.analysis.breadthScore,
          rating: result.analysis.rating,
          projectedTokens: result.analysis.projectedTokens,
          promptTokens: result.analysis.promptTokens,
          explorationTokens: result.analysis.explorationTokens,
          issues: result.analysis.issues,
          relevantFiles: projectContext.files,
          confidence: projectContext.confidence,
          candidates: projectContext.candidates,
          suggestion: result.focused.text,
          optimizedTokens: result.rewrittenAnalysis.projectedTokens,
          savedTokens: result.savedTokens,
          savedPct: result.savedPct,
        },
        null,
        2
      )
    );
  } else {
    console.log(banner());
    console.log(
      renderAnalysis(result.analysis, {
        optimize: result,
        projectContext,
        provider,
      })
    );
  }

  // Track it (best-effort) unless disabled.
  if (flags.track !== false) {
    record({
      prompt,
      breadthScore: result.analysis.breadthScore,
      rating: result.analysis.rating,
      projectedTokens: result.analysis.projectedTokens,
      optimizedTokens: result.rewrittenAnalysis.projectedTokens,
      savedTokens: result.savedTokens,
    });
  }

  return 0;
}
