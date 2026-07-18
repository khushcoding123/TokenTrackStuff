#!/usr/bin/env node
// Thin CLI entry: `metriq-wrap claude` / `metriq-wrap codex` in place of the
// real binary. See desktop/src/pty-wrapper.js for the actual logic and
// docs/phase5-screen-awareness-proposal.md for what this is and isn't.
require("../src/pty-wrapper").run(process.argv.slice(2));
