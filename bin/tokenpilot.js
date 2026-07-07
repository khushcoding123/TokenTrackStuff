#!/usr/bin/env node
// metriq CLI entry point.
import { run } from "../src/cli.js";

const code = run();
if (typeof code === "number" && code !== 0) {
  process.exitCode = code;
}
