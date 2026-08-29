import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extname, join } from "node:path";
import { validateRule, type Rule } from "./schema.js";

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

export async function loadRules(directory = DEFAULT_KNOWLEDGE_DIR): Promise<Rule[]> {
  const paths = await walk(directory);
  const rules = await Promise.all(paths.map(async (path) => {
    const source = await readFile(path, "utf8");
    try {
      // JSON is a valid YAML 1.2 subset. v0.1 deliberately uses this subset so the CLI has zero runtime dependencies.
      return validateRule(JSON.parse(source));
    } catch (error) {
      throw new Error(`Invalid knowledge rule ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) throw new Error(`Duplicate rule id: ${rule.id}`);
    seen.add(rule.id);
  }
  return rules;
}
