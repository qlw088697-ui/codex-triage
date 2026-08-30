import test from "node:test";
import assert from "node:assert/strict";
import { codexVersionSatisfies, validateRule } from "../dist/knowledge/schema.js";

const base = {
  id: "schema-test",
  title: "Schema test",
  category: "test",
  severity: "low",
  match: { any: [{ contains: "signal" }] },
  summary: "summary",
  actions: ["action"],
};

test("rejects invalid regex and flags during rule loading", () => {
  assert.throws(() => validateRule({ ...base, match: { any: [{ regex: "[" }] } }), /invalid regex/i);
  assert.throws(() => validateRule({ ...base, match: { any: [{ regex: "ok", flags: "g" }] } }), /flags/i);
  assert.throws(() => validateRule({ ...base, match: { any: [{ regex: "ok", flags: "ii" }] } }), /flags/i);
});

test("rejects ambiguous, empty, duplicate, and signal-less matchers", () => {
  assert.throws(() => validateRule({ ...base, match: { any: [{ contains: "x", regex: "x" }] } }), /exactly one/i);
  assert.throws(() => validateRule({ ...base, match: { any: [{ contains: "" }] } }), /exactly one/i);
  assert.throws(() => validateRule({ ...base, match: {} }), /requires text matchers/i);
  assert.throws(() => validateRule({ ...base, match: { doctor: { statuses: ["fail"] } } }), /checkIds or categories/i);
  assert.throws(() => validateRule({ ...base, match: { any: [{ contains: "x" }, { contains: "x" }] } }), /duplicated/i);
});

test("restricts links to http and https", () => {
  assert.throws(() => validateRule({ ...base, links: [{ type: "other", url: "javascript:alert(1)" }] }), /http\(s\)/i);
});

test("rejects catastrophic backtracking regexes at load time", () => {
  const risky = [
    "(a+)+b",
    "(ab?)*c",
    "(.*)+x",
    "(?:a|b){2,}",
    "(?:v\\d+\\.){2,}",
    "((a?))+x",
  ];
  for (const pattern of risky) {
    assert.throws(() => validateRule({ ...base, match: { any: [{ regex: pattern }] } }), /backtracking/i, pattern);
  }
  const safe = [
    "(a+)?b",
    "[a-z]+\\d{4}",
    "(?:failed|timed out)",
    "(\\d{1,3}\\.){3}\\d{1,3}",
    "(?:[0-9a-f]{2}:)+",
    "(a{2}){3}",
    "literal{brace",
  ];
  for (const pattern of safe) {
    assert.doesNotThrow(() => validateRule({ ...base, match: { any: [{ regex: pattern }] } }), pattern);
  }
});

test("accepts v2 metadata fields", () => {
  const rule = validateRule({
    ...base,
    codexVersions: [">=0.144.0", "0.143.*"],
    lastVerified: "2026-08-30",
    source: "https://github.com/openai/codex/issues/1",
    deprecated: true,
    deprecationReason: "superseded by a narrower rule",
    replacedBy: "schema-test-two",
  });
  assert.deepEqual(rule.codexVersions, [">=0.144.0", "0.143.*"]);
  assert.equal(rule.lastVerified, "2026-08-30");
  assert.equal(rule.source, "https://github.com/openai/codex/issues/1");
  assert.equal(rule.deprecated, true);
  assert.equal(rule.replacedBy, "schema-test-two");
});

test("rejects invalid v2 metadata", () => {
  assert.throws(() => validateRule({ ...base, codexVersions: ["1.2"] }), /codexVersions/i);
  assert.throws(() => validateRule({ ...base, codexVersions: [">=1.2.*"] }), /wildcards/i);
  assert.throws(() => validateRule({ ...base, codexVersions: [] }), /non-empty/i);
  assert.throws(() => validateRule({ ...base, lastVerified: "2026-13-01" }), /date/i);
  assert.throws(() => validateRule({ ...base, lastVerified: "2026-02-30" }), /calendar date/i);
  assert.throws(() => validateRule({ ...base, source: "ftp://example.com/x" }), /http\(s\)/i);
  assert.throws(() => validateRule({ ...base, deprecated: true }), /deprecationReason/i);
  assert.throws(() => validateRule({ ...base, deprecationReason: "x" }), /deprecated/i);
  assert.throws(() => validateRule({ ...base, replacedBy: "schema-test" }), /itself/i);
});

test("codex version expression semantics", () => {
  assert.equal(codexVersionSatisfies("0.144.5", ["0.144.*"]), true);
  assert.equal(codexVersionSatisfies("0.145.0", ["0.144.*"]), false);
  assert.equal(codexVersionSatisfies("0.144.5", [">=0.144.0"]), true);
  assert.equal(codexVersionSatisfies("0.143.9", [">=0.144.0"]), false);
  assert.equal(codexVersionSatisfies("0.143.9", ["<0.144.0"]), true);
  assert.equal(codexVersionSatisfies("0.144.1", ["<0.144.0"]), false);
  assert.equal(codexVersionSatisfies("1.2.3", ["=1.2.3"]), true);
  assert.equal(codexVersionSatisfies("1.2.4", ["=1.2.3"]), false);
  assert.equal(codexVersionSatisfies("bogus", ["1.2.3"]), false);
  assert.equal(codexVersionSatisfies(undefined, ["1.2.3"]), false);
  assert.equal(codexVersionSatisfies("0.1.0", undefined), true);
  assert.equal(codexVersionSatisfies("0.1.0", []), true);
});

test("rule schemaVersion is pinned to the current generation", () => {
  assert.doesNotThrow(() => validateRule({ ...base, schemaVersion: 2 }));
  assert.throws(() => validateRule({ ...base, schemaVersion: 1 }), /schemaVersion/i);
  assert.throws(() => validateRule({ ...base, schemaVersion: 3 }), /schemaVersion/i);
  assert.throws(() => validateRule({ ...base, schemaVersion: "2" }), /schemaVersion/i);
});
