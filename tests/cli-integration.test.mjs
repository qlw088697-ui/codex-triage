import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", windowsHide: true, ...options });
}

test("CLI sanitizes nested JSON and Markdown report output", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "codex-triage-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const inputPath = join(directory, "doctor.json");
  const outputPath = join(directory, "report.md");
  const key = "sk-proj-abcdefghijklmnopqrstuvwxyz123456";
  const input = {
    schemaVersion: 1,
    generatedAt: "now",
    overallStatus: "warning",
    codexVersion: "0.1.0",
    checks: {
      canary: {
        id: "canary",
        category: "test",
        status: "warning",
        summary: "email alice@example.com",
        details: { key },
        notes: ["C:\\Users\\alice\\secret"],
        issues: [{ severity: "warning", cause: "https://user:pass@example.com/path", fields: [] }],
        remediation: "token=private-value",
        durationMs: 0,
      },
    },
  };
  await writeFile(inputPath, JSON.stringify(input), "utf8");

  const jsonRun = run([inputPath, "--json"]);
  assert.equal(jsonRun.status, 0, jsonRun.stderr);
  const parsed = JSON.parse(jsonRun.stdout);
  assert.equal(parsed.schemaVersion, 1);
  for (const canary of [key, "alice", "user:pass", "private-value"]) {
    assert.equal(jsonRun.stdout.includes(canary), false, `JSON leaked ${canary}`);
  }

  const reportRun = run([inputPath, "--report", "--output", outputPath]);
  assert.equal(reportRun.status, 0, reportRun.stderr);
  const markdown = await readFile(outputPath, "utf8");
  for (const canary of [key, "alice", "user:pass", "private-value"]) {
    assert.equal(markdown.includes(canary), false, `Markdown leaked ${canary}`);
  }
});

test("CLI rejects malformed inputs and invalid argument combinations", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "codex-triage-invalid-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const malformed = join(directory, "malformed.json");
  const wrongSchema = join(directory, "wrong-schema.json");
  await writeFile(malformed, "{not-json", "utf8");
  await writeFile(wrongSchema, JSON.stringify({ name: "not a doctor report" }), "utf8");

  const invalidJson = run([malformed]);
  assert.equal(invalidJson.status, 1);
  assert.match(invalidJson.stderr, /invalid JSON input/i);

  const invalidSchema = run([wrongSchema]);
  assert.equal(invalidSchema.status, 1);
  assert.match(invalidSchema.stderr, /invalid doctor report/i);

  assert.equal(run([malformed, wrongSchema]).status, 1);
  assert.equal(run(["--output", "unused.md"]).status, 1);
  assert.equal(run(["--limit", "5x", malformed]).status, 1);
});

test("CLI exposes package version and accepts an explicit zero match limit", async (t) => {
  const version = run(["--version"]);
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), "1.16.0");

  const directory = await mkdtemp(join(tmpdir(), "codex-triage-limit-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const inputPath = join(directory, "doctor.json");
  const input = {
    schemaVersion: 1,
    generatedAt: "now",
    overallStatus: "warning",
    codexVersion: "0.1.0",
    checks: {
      websocket: {
        id: "network.websocket_reachability",
        category: "websocket",
        status: "warning",
        summary: "failed",
        details: {},
        durationMs: 0,
      },
    },
  };
  await writeFile(inputPath, JSON.stringify(input), "utf8");
  const result = run([inputPath, "--json", "--limit", "0"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).matches, []);
});

test("explain matches raw error text without a file", () => {
  const result = run(["explain", "CreateProcessAsUserW failed: 1312", "--platform", "windows", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.ok(parsed.matches.some((match) => match.rule.id === "windows-createprocess-error-1312"));
  assert.equal(parsed.report, undefined);

  const empty = run(["explain"]);
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /explain requires/i);
});

test("faq searches the offline knowledge base in en, zh, and JSON", () => {
  const en = run(["faq", "websocket", "--json"]);
  assert.equal(en.status, 0, en.stderr);
  const parsed = JSON.parse(en.stdout);
  assert.equal(parsed.mode, "faq");
  assert.equal(parsed.schemaVersion, 1);
  assert.ok(parsed.results.length, "websocket query should hit at least one rule");
  assert.ok(parsed.results.some((entry) => entry.id === "websocket-unreachable"));

  const zh = run(["faq", "握手超时", "--lang", "zh-CN", "--platform", "wsl"]);
  assert.equal(zh.status, 0, zh.stderr);
  assert.match(zh.stdout, /常见问题（离线检索）/);
  assert.match(zh.stdout, /app-server/);

  const listed = run(["faq"]);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /rule\(s\) in the knowledge base/);
});

test("faq rejects report and log options", () => {
  assert.equal(run(["faq", "--report"]).status, 1);
  assert.equal(run(["faq", "--log", "any.log"]).status, 1);
});

test("explain and file inputs read from stdin via dash", () => {
  const explainStdin = run(["explain", "-", "--platform", "windows", "--json"], { input: "CreateProcessAsUserW failed: 1312\n" });
  assert.equal(explainStdin.status, 0, explainStdin.stderr);
  const explainJson = JSON.parse(explainStdin.stdout);
  assert.equal(explainJson.mode, "explain");
  assert.ok(explainJson.matches.some((match) => match.rule.id === "windows-createprocess-error-1312"));

  const doctorJson = JSON.stringify({
    schemaVersion: 1,
    generatedAt: "now",
    overallStatus: "warning",
    codexVersion: "0.1.0",
    checks: {
      network: { id: "network.websocket_reachability", category: "websocket", status: "warning", summary: "failed", details: {}, notes: [], issues: [], durationMs: 0 },
    },
  });
  const fileStdin = run(["-", "--json"], { input: doctorJson });
  assert.equal(fileStdin.status, 0, fileStdin.stderr);
  const parsed = JSON.parse(fileStdin.stdout);
  assert.equal(parsed.mode, "file");
  assert.ok(parsed.report);
  assert.ok(parsed.matches.some((match) => match.rule.id === "websocket-unreachable"));

  const badStdin = run(["-"], { input: "{not-json" });
  assert.equal(badStdin.status, 1);
  assert.match(badStdin.stderr, /invalid JSON input -/i);

  const fileMode = run(["explain", "CreateProcessAsUserW failed: 1312", "--platform", "windows", "--json"]);
  assert.equal(JSON.parse(fileMode.stdout).mode, "explain");
});

test("markdown report lists known upstream issues before filing duplicates", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "codex-triage-issues-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = join(directory, "report.md");
  const result = run(["explain", "CreateProcessAsUserW failed: 1312", "--platform", "windows", "--report", "--output", outputPath]);
  assert.equal(result.status, 0, result.stderr);
  const markdown = await readFile(outputPath, "utf8");
  assert.match(markdown, /## Before filing a new issue/);
  assert.match(markdown, /openai\/codex#31768/);
  assert.match(markdown, /avoid filing a duplicate/);
});

test("faq and matching both exclude deprecated rules", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "codex-triage-faq-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const active = {
    schemaVersion: 2, id: "faq-active-rule", title: "Quantum flux identified", category: "test", severity: "low",
    match: { any: [{ contains: "quantum flux" }] }, summary: "Active rule summary.", actions: ["Do the thing."],
    tags: ["test"], i18n: {},
  };
  const retired = {
    schemaVersion: 2, id: "faq-deprecated-rule", title: "Old quantum flux wisdom", category: "test", severity: "low",
    deprecated: true, deprecationReason: "stale signature", match: { any: [{ contains: "quantum flux" }] },
    summary: "Old summary.", actions: ["Legacy step."], tags: ["test"], i18n: {},
  };
  await writeFile(join(directory, "active.yml"), JSON.stringify(active), "utf8");
  await writeFile(join(directory, "old.yml"), JSON.stringify(retired), "utf8");

  const faq = run(["--knowledge", directory, "faq", "quantum", "--json"]);
  assert.equal(faq.status, 0, faq.stderr);
  const results = JSON.parse(faq.stdout).results.map((entry) => entry.id);
  assert.deepEqual(results, ["faq-active-rule"]);

  const explain = run(["--knowledge", directory, "explain", "quantum flux detected", "--json"]);
  assert.equal(explain.status, 0, explain.stderr);
  const matchIds = JSON.parse(explain.stdout).matches.map((match) => match.rule.id);
  assert.deepEqual(matchIds, ["faq-active-rule"]);
});

test("explain supports --codex-version evidence for version-constrained rules", () => {
  const azureError = "Invalid 'input[0].tools[0].description': empty string. Expected a string with minimum length 1, but got an empty string instead.";

  const withEvidence = run(["explain", azureError, "--codex-version", "0.147.0", "--json"]);
  assert.equal(withEvidence.status, 0, withEvidence.stderr);
  const withJson = JSON.parse(withEvidence.stdout);
  assert.equal(withJson.codexVersion, "0.147.0");
  assert.ok(withJson.matches.some((match) => match.rule.id === "provider-azure-empty-functions-description"), JSON.stringify(withJson.matches));

  const withoutEvidence = run(["explain", azureError, "--json"]);
  assert.equal(withoutEvidence.status, 0, withoutEvidence.stderr);
  const withoutJson = JSON.parse(withoutEvidence.stdout);
  assert.equal(withoutJson.codexVersion, undefined);
  assert.ok(!withoutJson.matches.some((match) => match.rule.id === "provider-azure-empty-functions-description"));

  const invalid = run(["explain", azureError, "--codex-version", "latest"]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /codex-version/i);

  const faqRejected = run(["faq", "azure", "--codex-version", "0.147.0"]);
  assert.equal(faqRejected.status, 1);
  assert.match(faqRejected.stderr, /not available in faq mode/i);
});
