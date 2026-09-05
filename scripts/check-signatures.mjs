#!/usr/bin/env node
// Signature audit: reports match signatures used by more than one bundled rule.
// Duplicates are not always wrong - platform scoping or legitimately different
// diagnoses can share a marker (e.g. two missing-helper rules matching ENOENT
// on macos vs wsl) - so this is informational and always exits 0.
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

async function collectRules(dir, out) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collectRules(path, out);
    else if ([".yml", ".yaml", ".json"].includes(extname(entry.name))) {
      const rule = JSON.parse(await readFile(path, "utf8"));
      out.push(rule);
    }
  }
}

const rules = [];
await collectRules(new URL("../knowledge", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), rules);

const signatures = new Map();
for (const rule of rules) {
  const add = (matcher, kind) => {
    const key = matcher.contains ? `contains: ${matcher.contains.trim().toLowerCase()}` : `regex: ${matcher.regex}`;
    if (!signatures.has(key)) signatures.set(key, []);
    signatures.get(key).push(`${rule.id} (${rule.platforms?.join("/") || "all platforms"})`);
  };
  for (const m of rule.match.any || []) add(m, "any");
  for (const m of rule.match.all || []) add(m, "all");
}

const duplicates = [...signatures.entries()].filter(([, users]) => users.length > 1);
if (!duplicates.length) {
  console.log(`no duplicate signatures across ${rules.length} rules`);
} else {
  console.log(`duplicate signatures across ${rules.length} rules (verify platform scoping):`);
  for (const [key, users] of duplicates.sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${key}\n    -> ${users.join(", ")}`);
  }
}
