import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRules } from "../dist/knowledge/loader.js";
import { parseDoctorReport, runCodexDoctor } from "../dist/codex/doctor.js";

const baseCheck = { id: "c", category: "cat", status: "ok", summary: "fine", durationMs: 0 };

test("doctor report rejects malformed structure", () => {
  assert.throws(() => parseDoctorReport(null), /must be an object/);
  assert.throws(() => parseDoctorReport({ schemaVersion: -1 }), /schemaVersion/);
  assert.throws(() => parseDoctorReport({ schemaVersion: 1.5, generatedAt: "now", overallStatus: "ok", codexVersion: "0", checks: {} }), /schemaVersion/);
  assert.throws(() => parseDoctorReport({ schemaVersion: 1, overallStatus: "ok", codexVersion: "0", checks: {} }), /generatedAt/);
  assert.throws(() => parseDoctorReport({ schemaVersion: 1, generatedAt: "now", overallStatus: "catastrophic", codexVersion: "0", checks: {} }), /invalid doctor status/);
  assert.throws(() => parseDoctorReport({ schemaVersion: 1, generatedAt: "now", overallStatus: "ok", codexVersion: "0" }), /checks must be an object or array/);
  assert.throws(() => parseDoctorReport({ schemaVersion: 1, generatedAt: "now", overallStatus: "ok", codexVersion: "0", checks: 7 }), /checks must be an object or array/);
});

test("doctor check validation covers details, issues, durations, and optional fields", () => {
  const report = (check) => parseDoctorReport({ schemaVersion: 1, generatedAt: "now", overallStatus: "ok", codexVersion: "0", checks: { c: check } });

  assert.throws(() => report({ ...baseCheck, details: { bad: 5 } }), /detail bad must be a string or string\[\]/);
  assert.throws(() => report({ ...baseCheck, details: "nope" }), /details must be an object/);
  const withArrayDetail = report({ ...baseCheck, details: { list: ["a", "b"] } });
  assert.deepEqual(withArrayDetail.checks[0].details.list, ["a", "b"]);

  assert.throws(() => report({ ...baseCheck, issues: "nope" }), /issues must be an array/);
  assert.throws(() => report({ ...baseCheck, issues: [{ severity: "ok", cause: 3 }] }), /must be a string/);
  assert.throws(() => report({ ...baseCheck, issues: [{ severity: "ok", cause: "c", fields: [7] }] }), /fields must be strings/);
  const withIssue = report({ ...baseCheck, issues: [{ severity: "warning", cause: "cause", measured: null, expected: "x", remedy: null, fields: ["f"] }] });
  assert.equal(withIssue.checks[0].issues[0].measured, null);
  assert.equal(withIssue.checks[0].issues[0].fields[0], "f");

  assert.throws(() => report({ ...baseCheck, durationMs: -1 }), /durationMs must be a non-negative number/);
  const withNullRemediation = report({ ...baseCheck, remediation: null });
  assert.equal(withNullRemediation.checks[0].remediation, null);
  assert.throws(() => report({ ...baseCheck, notes: [5] }), /notes must be string\[\]/);
  assert.throws(() => report({ id: 3, category: "cat", status: "ok", summary: "fine" }), /field id must be a string/);
});

test("legacy details split keys, merge duplicates, and keep bare notes", () => {
  const report = parseDoctorReport({
    schemaVersion: 1, generatedAt: "now", overallStatus: "ok", codexVersion: "0",
    checks: [{ id: "c", category: "cat", status: "ok", summary: "fine", durationMs: 0, details: ["a: 1", "a: 2", "no colon here", ": bad", "b: x"] }],
  });
  assert.equal(report.checks[0].details.a[0], "1");
  assert.equal(report.checks[0].details.a[1], "2");
  assert.equal(report.checks[0].details.note_1, "no colon here");
  assert.equal(report.checks[0].details.b, "x");
  assert.throws(() => parseDoctorReport({
    schemaVersion: 1, generatedAt: "now", overallStatus: "ok", codexVersion: "0",
    checks: [{ id: "c", category: "cat", status: "ok", summary: "fine", durationMs: 0, details: [5] }],
  }), /legacy doctor details must be string\[\]/);
});

test("runCodexDoctor validates timeout and degrades gracefully when codex is unavailable", () => {
  assert.throws(() => runCodexDoctor(0), /timeout must be a positive integer/);
  assert.throws(() => runCodexDoctor(1.5), /timeout must be a positive integer/);

  const result = runCodexDoctor(1000);
  if (result.report) {
    // A real codex executable answered within the budget; the parse must be a valid report.
    assert.ok(Array.isArray(result.report.checks));
    return;
  }
  assert.ok(result.diagnosticText.length > 0);
  if (result.timedOut) {
    assert.match(result.diagnosticText, /timed out after 1000ms/);
  } else {
    assert.match(result.diagnosticText, /command not found|failed to start|exited with code/);
  }
});

test("loadRules surfaces invalid YAML, invalid rules, duplicate ids, and unknown replacedBy", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "codex-triage-loader-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const badYaml = join(dir, "sub");
  await mkdir(badYaml, { recursive: true });
  await writeFile(join(badYaml, "broken.yml"), "a: [unclosed\n  b: :", "utf8");
  await assert.rejects(() => loadRules(dir), /neither valid JSON nor supported YAML/);
  await rm(join(badYaml, "broken.yml"));

  await writeFile(join(dir, "invalid.json"), JSON.stringify({ schemaVersion: 2, id: "x" }), "utf8");
  await assert.rejects(() => loadRules(dir), /Invalid knowledge rule/);
  await rm(join(dir, "invalid.json"));

  const rule = (id) => JSON.stringify({ schemaVersion: 2, id, title: "t", category: "test", severity: "low", match: { any: [{ contains: "x" }], all: [] }, summary: "s", actions: ["a"], tags: ["t"], i18n: {} });
  await writeFile(join(dir, "a.json"), rule("same"), "utf8");
  await writeFile(join(dir, "b.json"), rule("same"), "utf8");
  await assert.rejects(() => loadRules(dir), /Duplicate rule id: same/);

  await writeFile(join(dir, "b.json"), JSON.stringify({ schemaVersion: 2, id: "child", title: "t", category: "test", severity: "low", match: { any: [{ contains: "x" }], all: [] }, summary: "s", actions: ["a"], tags: ["t"], i18n: {}, replacedBy: "ghost" }), "utf8");
  await assert.rejects(() => loadRules(dir), /unknown replacedBy id: ghost/);

  await writeFile(join(dir, "ignore-me.txt"), "not a rule", "utf8");
  await writeFile(join(dir, "b.json"), rule("child"), "utf8");
  const rules = await loadRules(dir);
  assert.deepEqual(rules.map((r) => r.id).sort(), ["child", "same"]);
});
