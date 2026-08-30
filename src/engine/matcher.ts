import type { DoctorCheck, DoctorReport } from "../codex/types.js";
import { codexVersionSatisfies } from "../knowledge/schema.js";
import type { DoctorMatcher, Platform, Rule, TextMatcher } from "../knowledge/schema.js";

export interface MatchInput {
  report?: DoctorReport;
  extraText?: string;
  platform: Platform;
  codexVersion?: string;
}

export interface MatchEvidence {
  source: "doctor" | "log" | "platform";
  path: string;
  signal: string;
  weight: number;
}

export interface RuleMatch {
  rule: Rule;
  confidence: number;
  reasons: string[];
  evidence: MatchEvidence[];
  checkId?: string;
}

interface EvidenceField { path: string; text: string; }
interface EvidenceDocument {
  source: "doctor" | "log";
  path: string;
  fields: EvidenceField[];
  check?: DoctorCheck;
}

function checkEvidence(check: DoctorCheck): EvidenceDocument {
  const root = `doctor.check[${check.id}]`;
  const fields: EvidenceField[] = [{ path: `${root}.summary`, text: check.summary }];
  for (const [key, value] of Object.entries(check.details)) {
    const values = Array.isArray(value) ? value : [value];
    fields.push({ path: `${root}.details.${key}`, text: [key, ...values].join("\n") });
  }
  check.notes.forEach((note, index) => fields.push({ path: `${root}.notes[${index}]`, text: note }));
  check.issues.forEach((issue, index) => {
    const issueRoot = `${root}.issues[${index}]`;
    fields.push({ path: `${issueRoot}.cause`, text: issue.cause });
    if (issue.measured) fields.push({ path: `${issueRoot}.measured`, text: issue.measured });
    if (issue.expected) fields.push({ path: `${issueRoot}.expected`, text: issue.expected });
    if (issue.fields?.length) fields.push({ path: `${issueRoot}.fields`, text: issue.fields.join("\n") });
  });
  return { source: "doctor", path: root, fields, check };
}

function matcherWeight(matcher: TextMatcher, kind: "any" | "all"): number {
  return matcher.weight ?? (kind === "any" ? 65 : 35);
}

function matcherSignal(matcher: TextMatcher): string {
  return matcher.contains ? `contains:${matcher.contains}` : `regex:${matcher.regex}`;
}

function fieldMatches(field: EvidenceField, matcher: TextMatcher): boolean {
  if (matcher.contains) return field.text.toLowerCase().includes(matcher.contains.toLowerCase());
  if (!matcher.regex) return false;
  return new RegExp(matcher.regex, matcher.flags ?? "i").test(field.text);
}

function findEvidence(document: EvidenceDocument, matcher: TextMatcher, kind: "any" | "all"): MatchEvidence | undefined {
  const field = document.fields.find((candidate) => fieldMatches(candidate, matcher));
  if (!field) return undefined;
  return {
    source: document.source,
    path: field.path,
    signal: matcherSignal(matcher),
    weight: matcherWeight(matcher, kind),
  };
}

function checkMatchesDoctorConstraint(check: DoctorCheck, doctor: DoctorMatcher): boolean {
  if (doctor.checkIds?.length && !doctor.checkIds.includes(check.id)) return false;
  if (doctor.categories?.length && !doctor.categories.includes(check.category)) return false;
  if (doctor.statuses?.length && !doctor.statuses.includes(check.status)) return false;
  return true;
}

function doctorBaseWeight(doctor: DoctorMatcher): number {
  return doctor.checkIds?.length ? 65 : 30;
}

function evaluateDocument(rule: Rule, document: EvidenceDocument): RuleMatch | undefined {
  const anyEvidence = rule.match.any
    .map((matcher) => findEvidence(document, matcher, "any"))
    .filter((item): item is MatchEvidence => Boolean(item));
  if (rule.match.any.length && !anyEvidence.length) return undefined;

  const allEvidence = rule.match.all
    .map((matcher) => findEvidence(document, matcher, "all"));
  if (allEvidence.some((item) => !item)) return undefined;

  const evidence: MatchEvidence[] = [...anyEvidence, ...allEvidence as MatchEvidence[]];
  const reasons = evidence.map((item) => `matched ${item.signal} at ${item.path}`);
  let confidence = 0;

  if (rule.match.doctor && document.check) {
    const weight = doctorBaseWeight(rule.match.doctor);
    evidence.unshift({
      source: "doctor",
      path: `${document.path}.status`,
      signal: `${document.check.id}=${document.check.status}`,
      weight,
    });
    reasons.unshift(`doctor: ${document.check.id}=${document.check.status}`);
    confidence += weight;
  }

  if (anyEvidence.length) confidence += Math.min(65, anyEvidence.reduce((sum, item) => sum + item.weight, 0));
  confidence += (allEvidence as MatchEvidence[]).reduce((sum, item) => sum + item.weight, 0);
  confidence = Math.max(1, Math.min(99, confidence));

  return { rule, confidence, reasons, evidence, checkId: document.check?.id };
}

function candidateDocuments(rule: Rule, input: MatchInput): EvidenceDocument[] {
  const doctor = rule.match.doctor;
  if (doctor) {
    if (!input.report) return [];
    return input.report.checks
      .filter((check) => checkMatchesDoctorConstraint(check, doctor))
      .map(checkEvidence);
  }

  const documents: EvidenceDocument[] = [];
  if (input.extraText) {
    documents.push({ source: "log", path: "log", fields: [{ path: "log", text: input.extraText }] });
  }
  if (input.report) documents.push(...input.report.checks.map(checkEvidence));
  return documents;
}

export function matchRules(rules: Rule[], input: MatchInput): RuleMatch[] {
  const results: RuleMatch[] = [];

  for (const rule of rules) {
    if (rule.platforms?.length && !rule.platforms.includes(input.platform)) continue;
    if (rule.deprecated) continue;
    if (!codexVersionSatisfies(input.codexVersion, rule.codexVersions)) continue;
    const candidates = candidateDocuments(rule, input);
    const matches = candidates
      .map((candidate) => evaluateDocument(rule, candidate))
      .filter((match): match is RuleMatch => Boolean(match));
    if (!matches.length) continue;
    matches.sort((a, b) => b.confidence - a.confidence || (a.checkId ?? "").localeCompare(b.checkId ?? ""));
    results.push(matches[0]);
  }

  const severityRank = { high: 3, medium: 2, low: 1 } as const;
  return results.sort((a, b) =>
    b.confidence - a.confidence || severityRank[b.rule.severity] - severityRank[a.rule.severity]
  );
}
