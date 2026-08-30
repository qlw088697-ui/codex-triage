#!/usr/bin/env node
// Scans first-party files for credential-shaped strings before they reach git.
// tests/ and fixtures/ are excluded because they intentionally contain fake
// canary values; everything else that ships or is published must be clean.
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { secretPatterns } from "../dist/report/redact.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const INCLUDE = ["src", "knowledge", "docs", "scripts", ".github", "README.md", "CHANGELOG.md", "SECURITY.md", "CONTRIBUTING.md", "package.json", "tsconfig.json"];
const SKIP_EXTENSIONS = [".png", ".jpg", ".ico", ".zip"];

async function* walk(entry) {
  const absolute = join(root, entry);
  if (!(await stat(absolute)).isDirectory()) {
    yield entry;
    return;
  }
  const entries = await readdir(absolute, { withFileTypes: true });
  for (const item of entries) {
    const relative = join(entry, item.name);
    if (item.isDirectory()) yield* walk(relative);
    else if (!SKIP_EXTENSIONS.includes(item.name.slice(item.name.lastIndexOf(".")))) yield relative;
  }
}

async function* targets() {
  for (const entry of INCLUDE) yield* walk(entry);
}

let hits = 0;
for await (const relative of targets()) {
  const content = await readFile(join(root, relative), "utf8");
  const lines = content.split("\n");
  for (const [index, line] of lines.entries()) {
    for (const [pattern] of secretPatterns) {
      if (pattern.test(line)) {
        hits += 1;
        console.error(`${relative}:${index + 1}: value matches ${pattern.source}`);
      }
      pattern.lastIndex = 0;
    }
  }
}
if (hits) {
  console.error(`secret scan failed: ${hits} suspicious value(s) found`);
  process.exit(1);
}
console.log("secret scan passed: no credential-shaped values in first-party files");
