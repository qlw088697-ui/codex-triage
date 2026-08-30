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
