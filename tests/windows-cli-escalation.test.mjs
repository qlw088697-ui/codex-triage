import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { matchRules } from "../dist/engine/matcher.js";
import { loadRules } from "../dist/knowledge/loader.js";

test("matches Windows CLI escalation sandbox issue #41161", async () => {
  const rules = await loadRules();

  const log = await readFile(
    new URL(
      "../fixtures/logs/windows-cli-escalation-stays-sandboxed.txt",
      import.meta.url
    ),
    "utf8"
  );

  const matches = matchRules(rules, {
    platform: "windows",
    extraText: log
  });

  const match = matches.find(
    ({ rule }) =>
      rule.id === "windows-cli-escalation-stays-sandboxed"
  );

  assert.ok(match, "expected #41161 rule to match fixture");
  assert.ok(match.confidence >= 90);
});

test("does not match #41161 rule on Linux", async () => {
  const rules = await loadRules();

  const log = await readFile(
    new URL(
      "../fixtures/logs/windows-cli-escalation-stays-sandboxed.txt",
      import.meta.url
    ),
    "utf8"
  );

  const matches = matchRules(rules, {
    platform: "linux",
    extraText: log
  });

  assert.equal(
    matches.some(
      ({ rule }) =>
        rule.id === "windows-cli-escalation-stays-sandboxed"
    ),
    false
  );
});
