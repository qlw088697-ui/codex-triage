import { spawnSync } from "node:child_process";
import type { DoctorCheck, DoctorDetailValue, DoctorIssue, DoctorReport, DoctorStatus } from "./types.js";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`doctor field ${key} must be a string`);
  return value;
}

function optionalString(record: UnknownRecord, key: string): string | null | undefined {
  const value = record[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") throw new Error(`doctor field ${key} must be a string or null`);
  return value;
}

function status(value: unknown): DoctorStatus {
  if (value === "ok" || value === "warning" || value === "fail") return value;
  throw new Error(`invalid doctor status: ${String(value)}`);
}

function parseIssue(value: unknown): DoctorIssue {
  if (!isRecord(value)) throw new Error("doctor issue must be an object");
  const fields = value.fields === undefined ? [] : value.fields;
  if (!Array.isArray(fields) || fields.some((field) => typeof field !== "string")) throw new Error("doctor issue fields must be strings");
  return {
    severity: status(value.severity),
    cause: requiredString(value, "cause"),
    measured: optionalString(value, "measured"),
    expected: optionalString(value, "expected"),
    remedy: optionalString(value, "remedy"),
    fields: fields as string[],
  };
}

function parseIssues(value: unknown): DoctorIssue[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("doctor issues must be an array");
  return value.map(parseIssue);
}

function parseDetails(value: unknown): Record<string, DoctorDetailValue> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error("doctor details must be an object");
  const result: Record<string, DoctorDetailValue> = {};
  for (const [key, detail] of Object.entries(value)) {
    if (typeof detail === "string") result[key] = detail;
    else if (Array.isArray(detail) && detail.every((item) => typeof item === "string")) result[key] = detail as string[];
    else throw new Error(`doctor detail ${key} must be a string or string[]`);
  }
  return result;
}

function normalizeLegacyDetails(details: unknown): Record<string, DoctorDetailValue> {
  if (details === undefined) return {};
  if (!Array.isArray(details) || details.some((detail) => typeof detail !== "string")) throw new Error("legacy doctor details must be string[]");
  const result: Record<string, DoctorDetailValue> = {};
  let noteIndex = 0;
  for (const raw of details as string[]) {
    const split = raw.indexOf(": ");
    if (split < 1) {
      result[`note_${++noteIndex}`] = raw;
      continue;
    }
    const key = raw.slice(0, split).trim();
    const detail = raw.slice(split + 2);
    const previous = result[key];
    if (previous === undefined) result[key] = detail;
    else if (Array.isArray(previous)) previous.push(detail);
    else result[key] = [previous, detail];
  }
  return result;
}

function parseCheck(value: unknown, legacy: boolean): DoctorCheck {
  if (!isRecord(value)) throw new Error("doctor check must be an object");
  const notesValue = value.notes ?? [];
  if (!Array.isArray(notesValue) || notesValue.some((note) => typeof note !== "string")) throw new Error("doctor notes must be string[]");
  const duration = value.durationMs ?? 0;
  if (typeof duration !== "number" || duration < 0) throw new Error("durationMs must be a non-negative number");
  return {
    id: requiredString(value, "id"),
    category: requiredString(value, "category"),
    status: status(value.status),
    summary: requiredString(value, "summary"),
    details: legacy ? normalizeLegacyDetails(value.details) : parseDetails(value.details),
    notes: notesValue as string[],
    issues: parseIssues(value.issues),
    remediation: optionalString(value, "remediation"),
    durationMs: duration,
  };
}

export function parseDoctorReport(value: unknown): DoctorReport {
  if (!isRecord(value)) throw new Error("doctor report must be an object");
  const schemaVersion = value.schemaVersion;
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion) || schemaVersion < 0) throw new Error("schemaVersion must be a non-negative integer");
  const checksValue = value.checks;
  let checks: DoctorCheck[];
  if (Array.isArray(checksValue)) checks = checksValue.map((check) => parseCheck(check, true));
  else if (isRecord(checksValue)) checks = Object.values(checksValue).map((check) => parseCheck(check, false));
  else throw new Error("checks must be an object or array");
  return {
    schemaVersion,
    generatedAt: requiredString(value, "generatedAt"),
    overallStatus: status(value.overallStatus),
    codexVersion: requiredString(value, "codexVersion"),
    checks,
  };
}

export interface DoctorRunResult {
  report?: DoctorReport;
  diagnosticText: string;
  exitCode: number | null;
  timedOut?: boolean;
  parseError?: string;
}

export function runCodexDoctor(timeoutMs = 15_000): DoctorRunResult {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error("doctor timeout must be a positive integer");
  const result = spawnSync("codex", ["doctor", "--json"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: timeoutMs,
    killSignal: "SIGTERM",
    windowsHide: true,
  });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    const notFound = code === "ENOENT";
    const timedOut = code === "ETIMEDOUT";
    const diagnosticText = notFound
      ? "codex: command not found"
      : timedOut
        ? `codex doctor timed out after ${timeoutMs}ms`
        : `codex doctor failed to start: ${result.error.message}`;
    return { diagnosticText, exitCode: result.status, timedOut };
  }
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const diagnosticText = [stdout, stderr].filter(Boolean).join("\n").trim();
  if (!stdout.trim()) {
    return { diagnosticText: diagnosticText || `codex doctor exited with code ${result.status ?? "unknown"} and produced no JSON`, exitCode: result.status };
  }
  try {
    return { report: parseDoctorReport(JSON.parse(stdout)), diagnosticText, exitCode: result.status };
  } catch (error) {
    return {
      diagnosticText,
      exitCode: result.status,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}
