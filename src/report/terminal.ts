import type { DoctorReport } from "../codex/types.js";
import type { RuleMatch } from "../engine/matcher.js";
import type { Platform, Rule } from "../knowledge/schema.js";

function localize(rule: Rule, locale: string) {
  const l = rule.i18n[locale];
  return { title: l?.title ?? rule.title, summary: l?.summary ?? rule.summary, explanation: l?.explanation ?? rule.explanation, actions: l?.actions ?? rule.actions };
}

export interface TerminalRenderOptions { report?: DoctorReport; matches: RuleMatch[]; platform: Platform; locale: string; }

export function sanitizeTerminalText(value: string): string {
  return value
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
}

export function renderTerminal(options: TerminalRenderOptions): string {
  const zh = options.locale.toLowerCase().startsWith("zh");
  const out: string[] = ["Codex Triage", "─".repeat(56), `${zh ? "平台" : "Platform"}: ${options.platform}`];
  if (options.report) out.push(`Codex: ${options.report.codexVersion}`, `Doctor: ${options.report.overallStatus}`);
  out.push("");
  if (!options.matches.length) {
    out.push(zh ? "没有匹配到已知问题。" : "No known issue signatures matched.");
    out.push(zh ? "你仍可以用 --report 生成脱敏报告来提交新规则。" : "You can still generate a sanitized report with --report.");
    return out.join("\n");
  }
  out.push(zh ? `发现 ${options.matches.length} 个可能的问题` : `Found ${options.matches.length} possible issue(s)`, "");
  for (const match of options.matches) {
    const text = localize(match.rule, options.locale);
    out.push(`${match.rule.severity.toUpperCase()} · ${text.title}`, `${zh ? "匹配度" : "Confidence"}: ${match.confidence}%`, "", text.summary);
    if (text.explanation) out.push("", text.explanation);
    out.push("", zh ? "建议：" : "Suggested next steps:");
    text.actions.forEach((action, index) => out.push(`  ${index + 1}. ${action}`));
    if (match.rule.links.length) {
      out.push("", zh ? "相关链接：" : "Related:");
      match.rule.links.forEach((link) => out.push(`  - ${link.label ?? link.url}: ${link.url}`));
    }
    out.push("", "─".repeat(56));
  }
  return sanitizeTerminalText(out.join("\n"));
}
