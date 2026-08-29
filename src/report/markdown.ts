import type { DoctorReport } from "../codex/types.js";
import type { RuleMatch } from "../engine/matcher.js";
import type { Platform, Rule } from "../knowledge/schema.js";
import { redactText } from "./redact.js";

function localize(rule: Rule, locale: string) {
  const l = rule.i18n[locale];
  return {
    title: l?.title ?? rule.title,
    summary: l?.summary ?? rule.summary,
    explanation: l?.explanation ?? rule.explanation,
    actions: l?.actions ?? rule.actions,
  };
}

export function renderMarkdownReport(input: {
  report?: DoctorReport;
  matches: RuleMatch[];
  platform: Platform;
  locale: string;
  diagnosticText?: string;
}): string {
  const lines: string[] = [
    "# Codex Triage Report",
    "",
    "> Generated locally by codex-triage. Review before sharing.",
    "",
    `- Platform: ${input.platform}`,
    `- Codex version: ${input.report?.codexVersion ?? "unknown"}`,
    `- Doctor status: ${input.report?.overallStatus ?? "unavailable"}`,
    `- Doctor schema: ${input.report?.schemaVersion ?? "unavailable"}`,
    "",
    "## Matches",
    "",
  ];

  if (!input.matches.length) lines.push("No known signatures matched.", "");
  for (const match of input.matches) {
    const text = localize(match.rule, input.locale);
    lines.push(`### ${text.title}`, "", `- Severity: ${match.rule.severity}`, `- Confidence: ${match.confidence}%`, "", text.summary, "");
    if (text.explanation) lines.push(text.explanation, "");
    lines.push("Suggested next steps:", "");
    text.actions.forEach((action, index) => lines.push(`${index + 1}. ${action}`));
    if (match.rule.links.length) {
      lines.push("", "Related:", "");
      match.rule.links.forEach((link) => lines.push(`- ${link.label ?? link.url}: ${link.url}`));
    }
    lines.push("");
  }

  if (input.report) {
    lines.push("## Doctor checks", "");
    for (const check of input.report.checks) {
      lines.push(`### ${check.id}`, "", `- Category: ${check.category}`, `- Status: ${check.status}`, `- Summary: ${check.summary}`);
      if (check.remediation) lines.push(`- Remediation: ${check.remediation}`);
      lines.push("");
    }
  }

  if (input.diagnosticText) {
    lines.push("## Additional diagnostic text", "", "```text", redactText(input.diagnosticText).slice(0, 20000), "```", "");
  }

  lines.push("## Privacy", "", "codex-triage applies an additional local redaction pass, but no automatic redactor can guarantee removal of every private value. Review this report before posting it publicly.", "");
  return redactText(lines.join("\n"));
}
