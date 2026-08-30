import test from "node:test";
import assert from "node:assert/strict";
import { parseYaml } from "../dist/knowledge/yaml.js";
import { loadRules } from "../dist/knowledge/loader.js";
import { readFile } from "node:fs/promises";

// Minimal YAML serializer for the round-trip test: covers every shape a rule
// can contain (nested mappings, sequences of mappings, quoted/plain scalars).
function toYaml(value, indent = 0) {
  const pad = "  ".repeat(indent);
  if (value === null) return "null";
  if (typeof value === "string") return quote(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return value.map((item) => {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const rendered = toYaml(item, indent + 1);
        const lines = rendered.split("\n");
        const inner = "  ".repeat(indent + 1);
        const first = lines[0].startsWith(inner) ? lines[0].slice(inner.length) : lines[0];
        return `${pad}- ${first}\n${lines.slice(1).join("\n")}`;
      }
      return `${pad}- ${toYaml(item, indent + 1)}`;
    }).join("\n");
  }
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  return entries.map(([key, item]) => {
    if (typeof item === "object" && item !== null && (!Array.isArray(item) || item.length)) {
      return `${pad}${quote(key)}:\n${toYaml(item, indent + 1)}`;
    }
    if (Array.isArray(item)) {
      if (!item.length) return `${pad}${quote(key)}: []`;
      const rendered = toYaml(item, indent);
      return `${pad}${quote(key)}:\n${rendered}`;
    }
    return `${pad}${quote(key)}: ${toYaml(item, indent)}`;
  }).join("\n");
}

function quote(text) {
  // Conservative plain style: anything with spaces, colons, hashes, or
  // number/bool/null shapes gets double-quoted so it round-trips exactly.
  if (/^[\w./-]+$/.test(text) && !/^(true|false|null|~)$/i.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) {
    return text;
  }
  return JSON.stringify(text);
}

test("every bundled rule survives a JSON-to-YAML-to-object round trip", async () => {
  const rules = await loadRules();
  const directory = new URL("../knowledge/", import.meta.url);
  let count = 0;
  for (const path of ["auth/auth-initialization-failed.yml", "network/proxy-tls-dns.yml", "sandbox/windows-createprocess-error-1312.yml", "wsl/wsl-bwrap-missing.yml", "wsl/wsl-stream-disconnected.yml"]) {
    const source = await readFile(new URL(path, directory), "utf8");
    const original = JSON.parse(source);
    const asYaml = toYaml(original);
    const parsed = parseYaml(asYaml);
    assert.deepEqual(parsed, original, `${path} must round-trip through YAML unchanged`);
    count++;
  }
  assert.ok(count >= 5);
});

test("parses block mappings, sequences, comments, and scalar types", () => {
  const source = [
    "# leading comment",
    "id: example-rule          # trailing comment",
    "severity: high",
    "weight: 65",
    "disabled: false",
    "notes: null",
    "tags:",
    "  - alpha",
    "  - beta",
    "match:",
    "  any:",
    "    - contains: hello world",
    "      weight: 40",
    "    - regex: 'a|b'",
    "explanation: 'single ''quoted'' value'",
    "label: \"double \\\"quoted\\\" value\"",
  ].join("\n");
  assert.deepEqual(parseYaml(source), {
    id: "example-rule",
    severity: "high",
    weight: 65,
    disabled: false,
    notes: null,
    tags: ["alpha", "beta"],
    match: {
      any: [
        { contains: "hello world", weight: 40 },
        { regex: "a|b" },
      ],
    },
    explanation: "single 'quoted' value",
    label: 'double "quoted" value',
  });
});

test("parses same-indent sequences and flow collections", () => {
  assert.deepEqual(parseYaml("actions:\n- one\n- two\n"), { actions: ["one", "two"] });
  assert.deepEqual(parseYaml("tags: [windows, sandbox]\n"), { tags: ["windows", "sandbox"] });
  assert.deepEqual(parseYaml('codexVersions: [">=0.129.0"]\n'), { codexVersions: [">=0.129.0"] });
  assert.deepEqual(parseYaml("doctor: { checkIds: [a], statuses: [fail] }\n"), { doctor: { checkIds: ["a"], statuses: ["fail"] } });
});

test("keeps special characters in quoted scalars", () => {
  assert.deepEqual(parseYaml('title: "a: b # c"\n'), { title: "a: b # c" });
  assert.deepEqual(parseYaml("title: 'pass: word'\n"), { title: "pass: word" });
  assert.deepEqual(parseYaml("label: openai/codex#31768\n"), { label: "openai/codex#31768" });
  assert.deepEqual(parseYaml("expr: >=1.2.3\n"), { expr: ">=1.2.3" });
});

test("rejects unsupported YAML constructs with clear errors", () => {
  assert.throws(() => parseYaml("a:\n\tb: 1\n"), /tab indentation/i);
  assert.throws(() => parseYaml("a: &anchor 1\n"), /anchors/i);
  assert.throws(() => parseYaml("a: !!tag 1\n"), /tags/i);
  assert.throws(() => parseYaml("a: |\n  text\n"), /block scalars/i);
  assert.throws(() => parseYaml('a: "unterminated\n'), /double-quoted/i);
  assert.throws(() => parseYaml("a: 'unterminated\n"), /single-quoted/i);
  assert.throws(() => parseYaml("just text\n"), /key: value/i);
  assert.throws(() => parseYaml(""), /empty/i);
  assert.throws(() => parseYaml("a: 1\nb\n"), /key: value/i);
  assert.throws(() => parseYaml("a: b: c\n"), /quote the value/i);
});
