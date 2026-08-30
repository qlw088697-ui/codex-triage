import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDoctorReport } from "../dist/codex/doctor.js";
import { matchRules } from "../dist/engine/matcher.js";
import { loadRules } from "../dist/knowledge/loader.js";

const baseRule = {
  id: "example-rule",
  title: "Example",
  category: "test",
  severity: "high",
  match: { any: [{ contains: "TARGET_ERROR" }], all: [] },
  summary: "summary",
  actions: ["action"],
  links: [],
  tags: [],
  i18n: {},
};

const check = (id, status, summary, extra = {}) => ({
  id,
  category: id.split(".")[0],
  status,
  summary,
  details: {},
  notes: [],
  issues: [],
  durationMs: 0,
  ...extra,
});

const report = (...checks) => ({
  schemaVersion: 1,
  generatedAt: "now",
  overallStatus: checks.some((item) => item.status === "fail") ? "fail" : "warning",
  codexVersion: "0.1.0",
  checks,
});

test("scores an exact platform-specific signature strongly", () => {
  const rule = { ...baseRule, platforms: ["windows"] };
  const matches = matchRules([rule], { platform: "windows", extraText: "TARGET_ERROR" });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].confidence, 65);
});

test("does not match another platform", () => {
  const rule = { ...baseRule, platforms: ["windows"] };
  assert.equal(matchRules([rule], { platform: "linux", extraText: "TARGET_ERROR" }).length, 0);
});

test("does not bridge a doctor constraint to text from another check", () => {
  const rule = { ...baseRule, match: { ...baseRule.match, doctor: { checkIds: ["auth.check"], statuses: ["fail"] } } };
  const input = report(
    check("auth.check", "fail", "unrelated auth failure"),
    check("other.check", "warning", "TARGET_ERROR appears elsewhere"),
  );
  assert.equal(matchRules([rule], { report: input, platform: "linux" }).length, 0);
});

test("binds text evidence to the same constrained check", () => {
  const rule = { ...baseRule, match: { ...baseRule.match, doctor: { checkIds: ["auth.check"], statuses: ["fail"] } } };
  const input = report(check("auth.check", "fail", "auth failed", { details: { error: "TARGET_ERROR" } }));
  const [match] = matchRules([rule], { report: input, platform: "linux" });
  assert.equal(match.checkId, "auth.check");
  assert.ok(match.evidence.some((item) => item.path === "doctor.check[auth.check].details.error"));
});

test("ignores remediation and issue remedy as diagnostic evidence", () => {
  const rule = { ...baseRule, match: { ...baseRule.match, doctor: { checkIds: ["auth.check"], statuses: ["fail"] } } };
  const input = report(check("auth.check", "fail", "auth failed", {
    remediation: "TARGET_ERROR",
    issues: [{ severity: "fail", cause: "other", remedy: "TARGET_ERROR", fields: [] }],
  }));
  assert.equal(matchRules([rule], { report: input, platform: "linux" }).length, 0);
});

test("does not bridge constrained doctor evidence to extra log text", () => {
  const rule = { ...baseRule, match: { ...baseRule.match, doctor: { checkIds: ["auth.check"], statuses: ["fail"] } } };
  const input = report(check("auth.check", "fail", "auth failed"));
  assert.equal(matchRules([rule], { report: input, extraText: "TARGET_ERROR", platform: "linux" }).length, 0);
});

test("doctor-only exact check still matches", () => {
  const rule = { ...baseRule, match: { any: [], all: [], doctor: { checkIds: ["auth.check"], statuses: ["fail"] } } };
  const matches = matchRules([rule], { report: report(check("auth.check", "fail", "auth failed")), platform: "linux" });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].confidence, 65);
});

test("text-only rule matches extra log text", () => {
  const [match] = matchRules([baseRule], { extraText: "prefix TARGET_ERROR suffix", platform: "linux" });
  assert.equal(match.evidence[0].source, "log");
});

test("all matchers cannot be assembled across doctor checks", () => {
  const rule = { ...baseRule, match: { any: [], all: [{ contains: "FIRST" }, { contains: "SECOND" }] } };
  const split = report(check("one", "warning", "FIRST"), check("two", "warning", "SECOND"));
  assert.equal(matchRules([rule], { report: split, platform: "linux" }).length, 0);
  const together = report(check("one", "warning", "FIRST SECOND"));
  assert.equal(matchRules([rule], { report: together, platform: "linux" }).length, 1);
});

test("built-in remediation text no longer triggers proxy diagnosis", async () => {
  const rules = await loadRules();
  const value = JSON.parse(await readFile(new URL("../fixtures/doctor/current-object.json", import.meta.url), "utf8"));
  const matches = matchRules(rules, { report: parseDoctorReport(value), platform: "windows" });
  assert.equal(matches.some((item) => item.rule.id === "proxy-tls-dns"), false);
  assert.equal(matches.some((item) => item.rule.id === "websocket-unreachable"), true);
});

test("scoring is independent of matcher order", () => {
  const a = { contains: "ALPHA", weight: 20 };
  const b = { contains: "BETA", weight: 40 };
  const first = { ...baseRule, match: { any: [a, b], all: [] } };
  const second = { ...baseRule, match: { any: [b, a], all: [] } };
  const input = { extraText: "ALPHA BETA", platform: "linux" };
  assert.equal(matchRules([first], input)[0].confidence, matchRules([second], input)[0].confidence);
});

test("version-constrained rules match only compatible Codex versions", () => {
  const rule = { ...baseRule, codexVersions: [">=0.144.0"] };
  assert.equal(matchRules([rule], { extraText: "TARGET_ERROR", platform: "linux", codexVersion: "0.144.5" }).length, 1);
  assert.equal(matchRules([rule], { extraText: "TARGET_ERROR", platform: "linux", codexVersion: "0.143.9" }).length, 0);
  assert.equal(matchRules([rule], { extraText: "TARGET_ERROR", platform: "linux" }).length, 0);
  const wildcard = { ...baseRule, id: "wildcard-rule", codexVersions: ["0.143.*"] };
  assert.equal(matchRules([wildcard], { extraText: "TARGET_ERROR", platform: "linux", codexVersion: "0.143.2" }).length, 1);
});

test("deprecated rules are skipped", () => {
  const rule = { ...baseRule, deprecated: true, deprecationReason: "stale signature" };
  assert.equal(matchRules([rule], { extraText: "TARGET_ERROR", platform: "linux" }).length, 0);
});

test("bundled version-constrained rule matches only inside its range", async () => {
  const rules = await loadRules();
  const rule = rules.find((item) => item.id === "wsl-stream-disconnected");
  assert.ok(rule, "wsl-stream-disconnected rule must be bundled");
  const input = { extraText: "stream disconnected before completion: error sending request", platform: "wsl" };
  assert.equal(matchRules([rule], { ...input, codexVersion: "0.133.0" }).length, 1);
  assert.equal(matchRules([rule], { ...input, codexVersion: "0.128.0" }).length, 0, "0.128.0 predates the regression");
});
