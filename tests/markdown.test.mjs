import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdownReport } from "../dist/report/markdown.js";

test("diagnostic text cannot escape its Markdown fence", () => {
  const diagnosticText = "before\n```\n![remote](https://example.invalid/pixel)\n```\nafter";
  const output = renderMarkdownReport({ matches: [], platform: "linux", locale: "en", diagnosticText });
  assert.match(output, /````text\n/);
  assert.match(output, /\n````\n\n## Privacy/);
});

test("Markdown report applies final redaction", () => {
  const output = renderMarkdownReport({ matches: [], platform: "linux", locale: "en", diagnosticText: "sk-abcdefghijklmnopqrstuvwxyz" });
  assert.equal(output.includes("sk-abcdefghijklmnopqrstuvwxyz"), false);
});

test("report handles explain mode, dedupes shared issue links, and survives inner backticks", () => {
  const rule = (id, title, url) => ({
    id, title, severity: "high", category: "test",
    summary: "s", explanation: "", actions: ["a"], links: url ? [{ type: "github_issue", url, label: "openai/codex#1" }] : [], tags: [], i18n: {},
  });
  const match = (r) => ({ rule: r, confidence: 50, reasons: [], evidence: [] });

  const noReport = renderMarkdownReport({ matches: [match(rule("a", "Only match", "https://github.com/openai/codex/issues/1"))], platform: "windows", locale: "en" });
  assert.match(noReport, /Doctor status: unavailable/);
  assert.equal(noReport.includes("## Doctor checks"), false);
  assert.equal(noReport.includes("## Before filing a new issue"), true);

  const shared = "https://github.com/openai/codex/issues/1";
  const deduped = renderMarkdownReport({
    matches: [match(rule("a", "First", shared)), match(rule("b", "Second", shared))],
    platform: "windows", locale: "en",
  });
  assert.equal(deduped.split("openai/codex#1 —").length - 1, 1);

  const ticked = renderMarkdownReport({ matches: [], platform: "windows", locale: "en", diagnosticText: "value `x` and ``` block" });
  assert.match(ticked, /````text\n/);
});
