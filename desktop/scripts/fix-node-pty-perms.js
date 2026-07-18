// node-pty ships prebuilt native binaries (including a `spawn-helper` used
// on macOS/Linux to fork the child process into a PTY). In some npm
// install/extraction environments the executable bit doesn't survive
// unpacking, which fails every pty.spawn() call with an opaque
// "posix_spawnp failed" error — observed firsthand while building Phase 5b
// (see docs/phase5-screen-awareness-proposal.md). This defensively restores
// +x after every install so metriq-wrap never breaks on a fresh clone.
const fs = require("node:fs");
const path = require("node:path");

const prebuildsDir = path.join(__dirname, "..", "node_modules", "node-pty", "prebuilds");
if (!fs.existsSync(prebuildsDir)) process.exit(0);

for (const arch of fs.readdirSync(prebuildsDir)) {
  const helper = path.join(prebuildsDir, arch, "spawn-helper");
  if (fs.existsSync(helper)) {
    fs.chmodSync(helper, 0o755);
  }
}
