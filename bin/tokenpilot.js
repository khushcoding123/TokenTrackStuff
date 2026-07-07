#!/usr/bin/env node
// TokenPilot CLI entry point.
import { run } from "../src/cli.js";

const code = run();
if (typeof code === "number" && code !== 0) {
  process.exitCode = code;
}
