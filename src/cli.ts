#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseDoctorReport, runCodexDoctor } from "./codex/doctor.js";
import type { DoctorReport } from "./codex/types.js";
import { matchRules } from "./engine/matcher.js";
import { topMatches } from "./engine/rank.js";
import { loadRules } from "./knowledge/loader.js";
import type { Platform } from "./knowledge/schema.js";
import { renderMarkdownReport } from "./report/markdown.js";
import { redactText } from "./report/redact.js";
import { renderTerminal } from "./report/terminal.js";

function detectPlatform(text = ""): Platform {
  const lower = text.toLowerCase();
  if (process.env.WSL_DISTRO_NAME || lower.includes("wsl")) return "wsl";
  if (lower.includes("windows sandbox") || lower.includes("createprocessasuserw")) return "windows";
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "linux";
}

function help(): string {
  return `codex-triage v0.1\n\nUsage:\n  codex-triage [doctor.json] [options]\n\nOptions:\n  --log <path>        Add a Codex/app log to the analysis\n  --report            Write codex-triage-report.md\n  --output <path>     Change the report output path\n  --json              Emit matches as JSON\n  --lang <locale>     en or zh-CN (default: en)\n  --knowledge <path>  Use a custom knowledge directory\n  --limit <n>         Maximum matches to show (default: 5)\n  -h, --help          Show this help\n`;
}

async function readInput(path: string): Promise<{ report?: DoctorReport; text: string }> {
  const text = await readFile(resolve(path), "utf8");
  try {
    return { report: parseDoctorReport(JSON.parse(text)), text };
  } catch {
    return { text };
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      log: { type: "string" },
      report: { type: "boolean", default: false },
      output: { type: "string" },
      json: { type: "boolean", default: false },
      lang: { type: "string", default: "en" },
      knowledge: { type: "string" },
      limit: { type: "string", default: "5" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(help());
    return;
  }

  let report: DoctorReport | undefined;
  let diagnosticText = "";

  if (positionals[0]) {
    const input = await readInput(positionals[0]);
    report = input.report;
    diagnosticText = input.text;
  } else {
    const result = runCodexDoctor();
    report = result.report;
    diagnosticText = result.diagnosticText;
  }

  if (values.log) {
    const log = await readFile(resolve(values.log), "utf8");
    diagnosticText = [diagnosticText, log].filter(Boolean).join("\n");
  }

  diagnosticText = redactText(diagnosticText);
  const platform = detectPlatform(diagnosticText);
  const rules = await loadRules(values.knowledge ? resolve(values.knowledge) : undefined);
  const limit = Number.parseInt(values.limit, 10) || 5;
  const matches = topMatches(matchRules(rules, { report, extraText: diagnosticText, platform }), limit);

  if (values.json) {
    console.log(JSON.stringify({ platform, report, matches }, null, 2));
  } else {
    console.log(renderTerminal({ report, matches, platform, locale: values.lang }));
  }

  if (values.report) {
    const path = resolve(values.output || "codex-triage-report.md");
    await writeFile(path, renderMarkdownReport({ report, matches, platform, locale: values.lang, diagnosticText }), "utf8");
    if (!values.json) console.log(`\nReport written: ${path}`);
  }
}

main().catch((error) => {
  console.error(`codex-triage: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
