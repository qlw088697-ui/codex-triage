#!/usr/bin/env node
// Citation freshness sweep: checks every upstream issue cited by bundled rules
// and reports rules whose cited issues were closed as completed (fixed) - the
// signal that a rule may need version-bounding or deprecation.
//
// Usage:
//   node scripts/check-citations.mjs            # report only, always exit 0
//   GITHUB_TOKEN=... node scripts/check-citations.mjs --strict
//     --strict: exit 1 when any rule's PRIMARY source issue is closed as completed
//
// Requires GITHUB_TOKEN (or gh auth) for useful rate limits; unauthenticated
// tokens cap at 60 requests/hour.
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const strict = process.argv.includes("--strict");
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

async function github(path) {
  const headers = { "User-Agent": "codex-triage-citation-sweep", Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(`https://api.github.com${path}`, { headers });
  if (!resp.ok) throw new Error(`${path}: HTTP ${resp.status}`);
  return resp.json();
}

async function collectRules(dir, out) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collectRules(path, out);
    else if ([".yml", ".yaml", ".json"].includes(extname(entry.name))) {
      const rule = JSON.parse(await readFile(path, "utf8"));
      out.push({ id: rule.id, source: rule.source, links: (rule.links || []).map((l) => l.url) });
    }
  }
}

const rules = [];
await collectRules(new URL("../knowledge", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), rules);

const issueIds = new Set();
for (const rule of rules) {
  for (const url of [rule.source, ...rule.links]) {
    const m = /^https:\/\/github\.com\/openai\/codex\/issues\/(\d+)$/.exec(url || "");
    if (m) issueIds.add(Number(m[1]));
  }
}

console.log(`cited upstream issues: ${issueIds.size} across ${rules.length} rules`);
const closedCompleted = new Map();
let checked = 0;
for (const id of [...issueIds].sort((a, b) => a - b)) {
  let issue;
  try {
    issue = await github(`/repos/openai/codex/issues/${id}`);
  } catch (error) {
    console.warn(`  warn: #${id} fetch failed (${error.message})`);
    continue;
  }
  checked += 1;
  if (issue.state === "closed" && issue.state_reason === "completed") {
    closedCompleted.set(id, issue.closed_at || "unknown date");
  }
}

const findings = [];
for (const rule of rules) {
  const sourceId = /^https:\/\/github\.com\/openai\/codex\/issues\/(\d+)$/.exec(rule.source || "")?.[1];
  if (sourceId && closedCompleted.has(Number(sourceId))) {
    findings.push({ id: rule.id, issue: Number(sourceId), closedAt: closedCompleted.get(Number(sourceId)), primary: true });
  }
  for (const url of rule.links || []) {
    const m = /^https:\/\/github\.com\/openai\/codex\/issues\/(\d+)$/.exec(url);
    if (m && closedCompleted.has(Number(m[1]))) {
      findings.push({ id: rule.id, issue: Number(m[1]), closedAt: closedCompleted.get(Number(m[1])), primary: false });
    }
  }
}

console.log(`checked: ${checked} issues, ${closedCompleted.size} closed as completed`);
if (findings.length) {
  console.log("rules citing completed (fixed) issues - consider version-bounding or a fixed-upstream note:");
  for (const f of findings.sort((a, b) => (a.primary === b.primary ? 0 : a.primary ? -1 : 1))) {
    console.log(`  ${f.primary ? "PRIMARY" : "link   "} ${f.id} <- openai/codex#${f.issue} (closed ${f.closedAt})`);
  }
} else {
  console.log("no rules cite completed issues");
}

if (strict && findings.some((f) => f.primary)) {
  console.error("strict: primary sources closed as completed - update or deprecate the rules above");
  process.exit(1);
}
