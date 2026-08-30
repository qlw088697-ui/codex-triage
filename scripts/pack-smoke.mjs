#!/usr/bin/env node
// Verifies the published tarball actually installs and runs: npm pack,
// global install, then execute the CLI binary and check its version.
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const expected = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

function run(command, options = {}) {
  const result = spawnSync(command, { cwd: root, encoding: "utf8", shell: true, ...options });
  if (result.status !== 0) {
    console.error(`pack smoke test failed at: ${command}`);
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }
  return result;
}

const pack = run("npm pack --json --ignore-scripts");
// --ignore-scripts keeps lifecycle output out of stdout; fall back to the last
// JSON array in case npm still prints banners on some platforms.
const start = pack.stdout.lastIndexOf("\n[");
const payload = start === -1 ? pack.stdout : pack.stdout.slice(start + 1);
const [tarball] = JSON.parse(payload).map((entry) => entry.filename);
if (!tarball) {
  console.error("pack smoke test failed: npm pack produced no tarball");
  process.exit(1);
}

try {
  run(`npm install -g ${tarball}`);
  const version = run("codex-triage --version");
  const actual = version.stdout.trim();
  if (actual !== expected) {
    console.error(`pack smoke test failed: installed CLI reported ${actual}, expected ${expected}`);
    process.exit(1);
  }
  const help = run("codex-triage --help");
  if (!/Usage:/.test(help.stdout)) {
    console.error("pack smoke test failed: --help output does not contain usage text");
    process.exit(1);
  }
  console.log(`pack smoke test passed: codex-triage@${expected} installs and runs`);
} finally {
  spawnSync("npm uninstall -g codex-triage", { cwd: root, encoding: "utf8", shell: true });
  rmSync(join(root, tarball), { force: true });
}
