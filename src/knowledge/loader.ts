import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, join } from "node:path";
import { validateRule, type Rule } from "./schema.js";
import { parseYaml } from "./yaml.js";

export const DEFAULT_KNOWLEDGE_DIR = fileURLToPath(new URL("../../knowledge", import.meta.url));

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if ([".yml", ".yaml", ".json"].includes(extname(entry.name))) files.push(path);
  }
  return files.sort();
}

function parseRuleSource(source: string, path: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    // Not JSON: fall back to the YAML subset (JSON is itself valid YAML).
    try {
      return parseYaml(source);
    } catch (yamlError) {
      throw new Error(`${path} is neither valid JSON nor supported YAML: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`);
    }
  }
}

export async function loadRules(directory = DEFAULT_KNOWLEDGE_DIR): Promise<Rule[]> {
  const paths = await walk(directory);
  const rules = await Promise.all(paths.map(async (path) => {
    const source = await readFile(path, "utf8");
    try {
      return validateRule(parseRuleSource(source, path));
    } catch (error) {
      throw new Error(`Invalid knowledge rule ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) throw new Error(`Duplicate rule id: ${rule.id}`);
    seen.add(rule.id);
  }
  for (const rule of rules) {
    if (rule.replacedBy && !seen.has(rule.replacedBy)) {
      throw new Error(`Rule ${rule.id} references unknown replacedBy id: ${rule.replacedBy}`);
    }
  }
  return rules;
}
