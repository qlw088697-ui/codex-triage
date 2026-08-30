#!/usr/bin/env node
// Validates a single knowledge rule file (strict JSON or the supported YAML
// subset) without running the whole test suite. Intended for rule authors:
//   node scripts/validate-rule.mjs path/to/rule.yml
import { readFileSync } from "node:fs";
import { validateRule } from "../dist/knowledge/schema.js";
import { parseYaml } from "../dist/knowledge/yaml.js";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/validate-rule.mjs <rule-file>");
  process.exit(1);
}

let value;
const source = readFileSync(path, "utf8");
try {
  value = JSON.parse(source);
} catch {
  try {
    value = parseYaml(source);
  } catch (yamlError) {
    console.error(`invalid: ${path} is neither valid JSON nor supported YAML: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`);
    process.exit(1);
  }
}

try {
  const rule = validateRule(value);
  const flags = [rule.severity, `category ${rule.category}`];
  if (rule.platforms?.length) flags.push(`platforms: ${rule.platforms.join(", ")}`);
  if (rule.codexVersions?.length) flags.push(`codexVersions: ${rule.codexVersions.join(", ")}`);
  if (rule.deprecated) flags.push("deprecated");
  console.log(`${rule.id}: valid (${flags.join(", ")})`);
} catch (error) {
  console.error(`invalid: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
