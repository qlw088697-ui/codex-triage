#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { parseDoctorReport, runCodexDoctor, type DoctorRunResult } from "./codex/doctor.js";
import type { DoctorReport } from "./codex/types.js";
import { matchRules } from "./engine/matcher.js";
import { searchRules } from "./engine/search.js";
import { topMatches } from "./engine/rank.js";
import { loadRules } from "./knowledge/loader.js";
import type { Platform } from "./knowledge/schema.js";
import { renderFaq, faqHitsToJson } from "./report/faq.js";
import { renderMarkdownReport } from "./report/markdown.js";
import { redactText, redactValue } from "./report/redact.js";
import { renderTerminal } from "./report/terminal.js";

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const SUPPORTED_PLATFORMS: Platform[] = ["windows", "macos", "linux", "wsl"];

function packageVersion(): string {
  try {
    const value = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: unknown };
    return typeof value.version === "string" ? value.version : "unknown";
  } catch {
    return "unknown";
  }
}

export function parsePlatform(value: string | undefined): Platform | undefined {
  if (value === undefined) return undefined;
  const normalized = value.toLowerCase() as Platform;
  if (!SUPPORTED_PLATFORMS.includes(normalized)) throw new Error(`--platform must be one of: ${SUPPORTED_PLATFORMS.join(", ")}`);
  return normalized;
}

export function detectPlatform(
  text = "",
  explicit?: Platform,
  runtimePlatform = process.platform,
  wslDistro = process.env.WSL_DISTRO_NAME,
): Platform {
  if (explicit) return explicit;
  if (wslDistro) return "wsl";
  if (runtimePlatform === "win32") return "windows";
  if (runtimePlatform === "darwin") return "macos";
  const lower = text.toLowerCase();
  if (lower.includes("createprocessasuserw") || lower.includes("windows sandbox")) return "windows";
  if (lower.includes("wsl mode") || lower.includes("wsl2")) return "wsl";
  return "linux";
}

export function normalizeLocale(value: string): "en" | "zh-CN" {
  const normalized = value.trim().toLowerCase().replace("_", "-");
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized === "zh-cn" || normalized === "zh-hans") return "zh-CN";
  throw new Error("--lang must be en or zh-CN");
}

export function parseIntegerOption(value: string, name: string, minimum: number, maximum: number): number {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function help(): string {
  return `codex-triage v${packageVersion()}\n\nUsage:\n  codex-triage [doctor.json] [options]\n  codex-triage explain "<error text>" [options]\n  codex-triage faq [query] [options]\n\nUse "-" as the input path (codex-triage -) or as the explain text (explain -) to read from stdin.\n\nOptions:\n  --log <path>             Add a Codex/app log to the analysis\n  --report                 Write codex-triage-report.md\n  --output <path>          Change the report output path\n  --json                   Emit sanitized matches as JSON\n  --lang <locale>          en or zh-CN (default: en)\n  --platform <platform>    windows, macos, linux, or wsl\n  --knowledge <path>       Use a custom knowledge directory\n  --limit <n>              Maximum matches/entries to show, 0..100 (default: 5)\n  --doctor-timeout <ms>    Timeout for codex doctor, 1000..120000 (default: 15000)\n  -v, --version            Show the package version\n  -h, --help               Show this help\n`;
}

async function readTextFile(path: string): Promise<string> {
  const absolute = resolve(path);
  const metadata = await stat(absolute);
  if (!metadata.isFile()) throw new Error(`input is not a file: ${absolute}`);
  if (metadata.size > MAX_INPUT_BYTES) throw new Error(`input exceeds ${MAX_INPUT_BYTES} bytes: ${absolute}`);
  return readFile(absolute, "utf8");
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function parseDoctorText(text: string, origin: string): { report?: DoctorReport; text: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    if (origin === "-" || extname(origin).toLowerCase() === ".json") {
      throw new Error(`invalid JSON input ${origin}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { text };
  }
  try {
    return { report: parseDoctorReport(value), text };
  } catch (error) {
    throw new Error(`invalid doctor report ${origin}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function readInput(path: string): Promise<{ report?: DoctorReport; text: string }> {
  return parseDoctorText(await readTextFile(path), path);
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    options: {
      log: { type: "string" },
      report: { type: "boolean", default: false },
      output: { type: "string" },
      json: { type: "boolean", default: false },
      lang: { type: "string", default: "en" },
      platform: { type: "string" },
      knowledge: { type: "string" },
      limit: { type: "string", default: "5" },
      "doctor-timeout": { type: "string", default: "15000" },
      version: { type: "boolean", short: "v", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(help());
    return 0;
  }
  if (values.version) {
    console.log(packageVersion());
    return 0;
  }
  if (positionals[0] === "explain" || positionals[0] === "faq") {
    // subcommand modes: no single-input restriction applies
  } else if (positionals.length > 1) {
    throw new Error("only one doctor report or text input may be provided");
  }
  if (values.output && !values.report) throw new Error("--output requires --report");

  const locale = normalizeLocale(values.lang);
  const explicitPlatform = parsePlatform(values.platform);
  const limit = parseIntegerOption(values.limit, "--limit", 0, 100);
  const doctorTimeout = parseIntegerOption(values["doctor-timeout"], "--doctor-timeout", 1000, 120000);

  let report: DoctorReport | undefined;
  let diagnosticText = "";
  let doctorResult: DoctorRunResult | undefined;
  let mode: "doctor" | "file" | "explain" | "faq";

  if (positionals[0] === "explain") {
    mode = "explain";
    const rest = positionals.slice(1);
    diagnosticText = rest.length === 1 && rest[0] === "-" ? (await readStdin()).trim() : rest.join(" ").trim();
    if (!diagnosticText) {
      throw new Error('explain requires error text, e.g. codex-triage explain "CreateProcessAsUserW failed: 1312"');
    }
  } else if (positionals[0] === "faq") {
    mode = "faq";
    if (values.report) throw new Error("--report is not available in faq mode");
    if (values.log) throw new Error("--log is not available in faq mode");
  } else if (positionals[0]) {
    mode = "file";
    if (positionals[0] === "-") {
      ({ report, text: diagnosticText } = parseDoctorText(await readStdin(), "-"));
    } else {
      const input = await readInput(positionals[0]);
      report = input.report;
      diagnosticText = input.text;
    }
  } else {
    mode = "doctor";
    doctorResult = runCodexDoctor(doctorTimeout);
    report = doctorResult.report;
    diagnosticText = doctorResult.diagnosticText;
  }

  if (values.log) {
    const log = await readTextFile(values.log);
    diagnosticText = [diagnosticText, log].filter(Boolean).join("\n");
  }

  diagnosticText = redactText(diagnosticText);
  const platform = detectPlatform(diagnosticText, explicitPlatform);
  const rules = await loadRules(values.knowledge ? resolve(values.knowledge) : undefined);

  if (mode === "faq") {
    const query = positionals.slice(1).join(" ").trim();
    const scoped = rules.filter((rule) => !rule.platforms?.length || rule.platforms.includes(platform));
    const hits = searchRules(scoped, query, locale).slice(0, limit);
    if (values.json) {
      console.log(JSON.stringify(redactValue({ schemaVersion: 1, mode, platform, query, results: faqHitsToJson(hits, locale) }), null, 2));
    } else {
      console.log(renderFaq({ hits, query, locale }));
    }
    return 0;
  }

  const matches = topMatches(
    matchRules(rules, { report, extraText: diagnosticText, platform, codexVersion: report?.codexVersion }),
    limit,
  );
  const safeReport = report ? redactValue(report) : undefined;
  const safeMatches = redactValue(matches);

  if (values.json) {
    console.log(JSON.stringify(redactValue({ schemaVersion: 1, mode, platform, report: safeReport, matches: safeMatches }), null, 2));
  } else {
    console.log(renderTerminal({ report: safeReport, matches: safeMatches, platform, locale }));
  }

  if (values.report) {
    const path = resolve(values.output || "codex-triage-report.md");
    await writeFile(path, renderMarkdownReport({ report: safeReport, matches: safeMatches, platform, locale, diagnosticText }), "utf8");
    if (!values.json) console.log(`\nReport written: ${path}`);
  }

  return doctorResult && !doctorResult.report ? 2 : 0;
}

const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  main().then((exitCode) => { process.exitCode = exitCode; }).catch((error) => {
    console.error(`codex-triage: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
