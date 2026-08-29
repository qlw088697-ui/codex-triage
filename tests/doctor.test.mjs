import test from "node:test";
import assert from "node:assert/strict";
import { parseDoctorReport } from "../dist/codex/doctor.js";

test("accepts current keyed checks shape", () => {
  const report = parseDoctorReport({ schemaVersion:1, generatedAt:"now", overallStatus:"warning", codexVersion:"0.148.0", checks:{"auth.credentials":{id:"auth.credentials",category:"auth",status:"warning",summary:"multiple auth env vars",details:{mode:"chatgpt"},remediation:null,durationMs:1}}});
  assert.equal(report.checks.length, 1);
  assert.equal(report.checks[0].details.mode, "chatgpt");
});

test("accepts legacy array checks shape", () => {
  const report = parseDoctorReport({ schemaVersion:1, generatedAt:"now", overallStatus:"ok", codexVersion:"0.144.0", checks:[{id:"installation",category:"install",status:"ok",summary:"fine",details:["managed by npm: true"],durationMs:0}]});
  assert.equal(report.checks[0].details["managed by npm"], "true");
});
