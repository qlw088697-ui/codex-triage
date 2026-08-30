import test from "node:test";
import assert from "node:assert/strict";
import { matchRules } from "../dist/engine/matcher.js";
import { loadRules } from "../dist/knowledge/loader.js";

// One satisfying sample per regex used by a bundled rule. When a new rule adds
// a regex matcher, add its sample here so the fixture tests stay exhaustive.
const regexSamples = new Map([
  ["certificate|custom CA|ECONNRESET|connection refused|dns|proxy", "TLS certificate"],
  ["sandbox helper.*(missing|not found)|codex-windows-sandbox.*(missing|not found)|module could not be found", "sandbox helper module missing"],
  ["CodexSandbox(?:Offline|Online)", "CodexSandboxOffline"],
]);

function matcherSample(matcher) {
  if (matcher.contains) return matcher.contains;
  const sample = regexSamples.get(matcher.regex);
  if (!sample) throw new Error(`rule fixture test needs a regex sample for: ${matcher.regex}`);
  return sample;
}

function ruleTextSample(rule) {
  return [...rule.match.any, ...rule.match.all].map(matcherSample).join(" | ");
}

// Version-constrained rules are skipped without version evidence, so fixtures
// derive a satisfying version from the constraint itself (equality always
// satisfies >=, wildcards, and exact expressions; range-below expressions are
// not used by bundled rules).
function fixtureCodexVersion(rule) {
  if (!rule.codexVersions?.length) return undefined;
  const match = /(\d+\.\d+\.\d+)/.exec(rule.codexVersions[0]);
  return match ? match[1] : undefined;
}

function positiveInput(rule, platform) {
  const doctor = rule.match.doctor;
  if (!doctor) return { extraText: ruleTextSample(rule), platform, codexVersion: fixtureCodexVersion(rule) };
  const check = {
    id: doctor.checkIds?.[0] ?? "triage.synthetic.check",
    category: doctor.categories?.[0] ?? (doctor.checkIds?.[0] ?? "triage.check").split(".")[0],
    status: doctor.statuses?.[0] ?? "fail",
    summary: ruleTextSample(rule),
    details: {},
    notes: [],
    issues: [],
    remediation: null,
    durationMs: 0,
  };
  return {
    report: { schemaVersion: 1, generatedAt: "now", overallStatus: check.status, codexVersion: fixtureCodexVersion(rule) ?? "0.0.0", checks: [check] },
    platform,
    codexVersion: fixtureCodexVersion(rule),
  };
}

function nearMissInput(rule, platform) {
  const doctor = rule.match.doctor;
  if (!doctor) {
    return {
      extraText: "completely unrelated system message",
      platform,
      // A version outside every declared constraint is an additional near-miss
      // dimension for version-constrained rules.
      codexVersion: rule.codexVersions?.length ? "0.0.1" : undefined,
    };
  }
  const statuses = doctor.statuses ?? [];
  const excluded = ["ok", "warning", "fail"].find((status) => !statuses.includes(status));
  const baseCheck = {
    id: doctor.checkIds?.[0] ?? "triage.synthetic.check",
    category: doctor.categories?.[0] ?? "triage",
    summary: ruleTextSample(rule),
    details: {},
    notes: [],
    issues: [],
    remediation: null,
    durationMs: 0,
  };
  let check;
  if (excluded) {
    check = { ...baseCheck, status: excluded };
  } else if (doctor.checkIds?.length) {
    check = { ...baseCheck, id: "triage.unrelated.check", status: statuses[0] };
  } else {
    check = { ...baseCheck, category: "triage.unrelated", status: statuses[0] };
  }
  return {
    report: { schemaVersion: 1, generatedAt: "now", overallStatus: check.status, codexVersion: "0.0.0", checks: [check] },
    platform,
  };
}

const otherPlatform = { windows: "linux", linux: "windows", wsl: "windows", macos: "windows" };

test("every rule matches its synthesized positive evidence", async () => {
  const rules = await loadRules();
  assert.ok(rules.length >= 22, "expected the full bundled rule set");
  for (const rule of rules) {
    const platform = rule.platforms?.[0] ?? "linux";
    const matches = matchRules(rules, positiveInput(rule, platform));
    assert.ok(
      matches.some((match) => match.rule.id === rule.id),
      `${rule.id} failed to match its positive fixture`,
    );
    const match = matches.find((item) => item.rule.id === rule.id);
    assert.ok(match.evidence.length, `${rule.id} produced no evidence entries`);
    if (rule.match.doctor) {
      assert.ok(
        match.evidence.some((item) => item.path.startsWith("doctor.check[")),
        `${rule.id} evidence is not bound to a doctor check`,
      );
    }
  }
});

test("every rule rejects its near-miss evidence", async () => {
  const rules = await loadRules();
  for (const rule of rules) {
    const matches = matchRules(rules, nearMissInput(rule, rule.platforms?.[0] ?? "linux"));
    assert.equal(
      matches.some((match) => match.rule.id === rule.id),
      false,
      `${rule.id} matched its near-miss fixture`,
    );
  }
});

test("platform-scoped rules reject unrelated platforms", async () => {
  const rules = await loadRules();
  const scoped = rules.filter((rule) => rule.platforms?.length);
  assert.ok(scoped.length, "expected at least one platform-scoped rule");
  for (const rule of scoped) {
    const platform = otherPlatform[rule.platforms[0]] ?? "macos";
    const matches = matchRules(rules, positiveInput(rule, platform));
    assert.equal(
      matches.some((match) => match.rule.id === rule.id),
      false,
      `${rule.id} matched on platform ${platform}`,
    );
  }
});
