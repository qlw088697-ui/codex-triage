#!/usr/bin/env node
// Scaffolds a new knowledge rule with every required field and zh-CN/ja stubs.
//   node scripts/rule-new.mjs <category> <rule-id> "<English title>"
// The generated file loads and validates immediately; replace the TODO
// placeholders with the real signature, guidance, and upstream evidence.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRule } from "../dist/knowledge/schema.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const [category, id, title] = process.argv.slice(2);

function fail(message) {
  console.error(`rule-new: ${message}`);
  process.exit(1);
}

if (!category || !id || !title) fail('usage: node scripts/rule-new.mjs <category> <rule-id> "<English title>"');
if (!/^[a-z0-9-]+$/.test(category)) fail("category must be lowercase letters, digits, or dashes");
if (!/^[a-z0-9][a-z0-9-]+$/.test(id)) fail("rule id must be lowercase letters/digits/dashes, at least two characters");
if (id.startsWith(category + "-") === false && category !== "misc") {
  console.error(`rule-new: hint: bundled rules usually prefix the id with the category ("${category}-...")`);
}

const dir = join(root, "knowledge", category);
const path = join(dir, `${id}.yml`);
if (existsSync(path)) fail(`rule file already exists: ${path}`);

const template = {
  schemaVersion: 2,
  id,
  title,
  category,
  severity: "medium",
  match: {
    any: [{ contains: "TODO: paste the distinctive error signature here" }],
    all: [],
  },
  summary: "TODO: one-line description of the symptom.",
  actions: ["TODO: first safe next step for the user."],
  links: [{ type: "github_issue", url: "https://github.com/openai/codex/issues/0", label: "openai/codex#TODO" }],
  tags: [category],
  i18n: {
    "zh-CN": {
      title: "TODO：中文标题",
      summary: "TODO：一句话中文症状描述。",
      actions: ["TODO：给用户的第一条安全建议。"],
    },
    ja: {
      title: "TODO: 日本語タイトル",
      summary: "TODO: 症状を一文で。",
      actions: ["TODO: ユーザーへの最初の安全な次のステップ。"],
    },
  },
};

const source = JSON.stringify(template, null, 2) + "\n";
try {
  validateRule(JSON.parse(source));
} catch (error) {
  fail(`generated template failed validation: ${error instanceof Error ? error.message : String(error)}`);
}

mkdirSync(dir, { recursive: true });
writeFileSync(path, source, "utf8");
console.log(`created ${path}`);
console.log("next steps:");
console.log("  1. Replace every TODO with the real signature, guidance, zh-CN/ja text, and the public upstream issue link.");
console.log(`  2. Validate: node scripts/validate-rule.mjs knowledge/${category}/${id}.yml`);
console.log("  3. npm test (the fixture suite exercises the new rule automatically).");
console.log("  4. Open a PR referencing the upstream issue.");
