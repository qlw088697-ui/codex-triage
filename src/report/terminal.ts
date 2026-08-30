import type { DoctorReport } from "../codex/types.js";
import type { RuleMatch } from "../engine/matcher.js";
import type { Platform, Rule } from "../knowledge/schema.js";

function localize(rule: Rule, locale: string) {
  const l = rule.i18n[locale];
  return { title: l?.title ?? rule.title, summary: l?.summary ?? rule.summary, explanation: l?.explanation ?? rule.explanation, actions: l?.actions ?? rule.actions };
}

const UI = {
  en: {
    platform: "Platform",
    none: "No known issue signatures matched.",
    hint: "You can still generate a sanitized report with --report.",
    found: (n: number) => `Found ${n} possible issue(s)`,
    confidence: "Confidence",
    steps: "Suggested next steps:",
    related: "Related:",
  },
  "zh-CN": {
    platform: "平台",
    none: "没有匹配到已知问题。",
    hint: "你仍可以用 --report 生成脱敏报告来提交新规则。",
    found: (n: number) => `发现 ${n} 个可能的问题`,
    confidence: "匹配度",
    steps: "建议：",
    related: "相关链接：",
  },
  ja: {
    platform: "プラットフォーム",
    none: "既知の問題シグネチャには一致しませんでした。",
    hint: "--report を付けるとサニタイズ済みレポートを生成でき、新しいルールの提案に使えます。",
    found: (n: number) => `可能性のある問題が ${n} 件見つかりました`,
    confidence: "信頼度",
    steps: "推奨される次のステップ:",
    related: "関連リンク:",
  },
} as const;

function uiStrings(locale: string) {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("zh")) return UI["zh-CN"];
  if (normalized.startsWith("ja")) return UI.ja;
  return UI.en;
}

export interface TerminalRenderOptions { report?: DoctorReport; matches: RuleMatch[]; platform: Platform; locale: string; }

export function sanitizeTerminalText(value: string): string {
  return value
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
}

export function renderTerminal(options: TerminalRenderOptions): string {
  const t = uiStrings(options.locale);
  const out: string[] = ["Codex Triage", "─".repeat(56), `${t.platform}: ${options.platform}`];
  if (options.report) out.push(`Codex: ${options.report.codexVersion}`, `Doctor: ${options.report.overallStatus}`);
  out.push("");
  if (!options.matches.length) {
    out.push(t.none);
    out.push(t.hint);
    return out.join("\n");
  }
  out.push(t.found(options.matches.length), "");
  for (const match of options.matches) {
    const text = localize(match.rule, options.locale);
    out.push(`${match.rule.severity.toUpperCase()} · ${text.title}`, `${t.confidence}: ${match.confidence}%`, "", text.summary);
    if (text.explanation) out.push("", text.explanation);
    out.push("", t.steps);
    text.actions.forEach((action, index) => out.push(`  ${index + 1}. ${action}`));
    if (match.rule.links.length) {
      out.push("", t.related);
      match.rule.links.forEach((link) => out.push(`  - ${link.label ?? link.url}: ${link.url}`));
    }
    out.push("", "─".repeat(56));
  }
  return sanitizeTerminalText(out.join("\n"));
}
