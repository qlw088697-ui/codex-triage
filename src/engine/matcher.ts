import type { DoctorCheck, DoctorReport } from "../codex/types.js";
import type { Platform, Rule } from "../knowledge/schema.js";

export interface MatchInput {
  report?: DoctorReport;
  extraText?: string;
  platform: Platform;
}

export interface RuleMatch {
  rule: Rule;
  confidence: number;
  reasons: string[];
}

function stringifyDoctor(report?: DoctorReport): string {
  if (!report) return "";
  const parts = [report.codexVersion, report.overallStatus];
  for (const check of report.checks) {
    parts.push(check.id, check.category, check.status, check.summary, check.remediation ?? "");
    for (const [key, value] of Object.entries(check.details)) {
      parts.push(key, ...(Array.isArray(value) ? value : [value]));
    }
    parts.push(...check.notes);
    for (const issue of check.issues) {
      parts.push(issue.cause, issue.measured ?? "", issue.expected ?? "", issue.remedy ?? "", ...(issue.fields ?? []));
    }
  }
  return parts.join("\n");
}

function textMatcherMatches(text: string, matcher: { contains?: string; regex?: string; flags?: string }): boolean {
  if (matcher.contains) return text.toLowerCase().includes(matcher.contains.toLowerCase());
  if (matcher.regex) {
    try {
      return new RegExp(matcher.regex, matcher.flags ?? "i").test(text);
    } catch {
      return false;
    }
  }
  return false;
}

function checkMatchesDoctorConstraint(check: DoctorCheck, doctor: NonNullable<Rule["match"]["doctor"]>): boolean {
  if (doctor.checkIds?.length && !doctor.checkIds.includes(check.id)) return false;
  if (doctor.categories?.length && !doctor.categories.includes(check.category)) return false;
  if (doctor.statuses?.length && !doctor.statuses.includes(check.status)) return false;
  return true;
}

function doctorConstraintMatches(report: DoctorReport | undefined, rule: Rule): DoctorCheck | undefined {
  const doctor = rule.match.doctor;
  if (!doctor || !report) return undefined;
  return report.checks.find((check) => checkMatchesDoctorConstraint(check, doctor));
}

export function matchRules(rules: Rule[], input: MatchInput): RuleMatch[] {
  const text = [stringifyDoctor(input.report), input.extraText ?? ""].filter(Boolean).join("\n");
  const results: RuleMatch[] = [];

  for (const rule of rules) {
    if (rule.platforms?.length && !rule.platforms.includes(input.platform)) continue;

    const anyMatches = rule.match.any.filter((matcher) => textMatcherMatches(text, matcher));
    if (rule.match.any.length && anyMatches.length === 0) continue;

    const allMatches = rule.match.all.filter((matcher) => textMatcherMatches(text, matcher));
    if (allMatches.length !== rule.match.all.length) continue;

    const doctorCheck = doctorConstraintMatches(input.report, rule);
    if (rule.match.doctor && !doctorCheck) continue;

    const hasSignal = anyMatches.length > 0 || allMatches.length > 0 || Boolean(doctorCheck);
    if (!hasSignal) continue;

    let confidence = 0;
    const reasons: string[] = [];

    const matchedText = [...anyMatches, ...allMatches];
    for (let i = 0; i < matchedText.length; i += 1) {
      const matcher = matchedText[i];
      const weight = matcher.weight ?? (i === 0 ? 50 : 10);
      confidence += weight;
      reasons.push(matcher.contains ? `matched text: ${matcher.contains}` : `matched regex: ${matcher.regex}`);
    }

    if (doctorCheck) {
      confidence += 25;
      reasons.push(`doctor: ${doctorCheck.id}=${doctorCheck.status}`);
    }
    if (rule.platforms?.length) {
      confidence += 15;
      reasons.push(`platform: ${input.platform}`);
    }

    confidence = Math.max(55, Math.min(99, confidence));
    results.push({ rule, confidence, reasons });
  }

  const severityRank = { high: 3, medium: 2, low: 1 } as const;
  return results.sort((a, b) =>
    b.confidence - a.confidence || severityRank[b.rule.severity] - severityRank[a.rule.severity]
  );
}
