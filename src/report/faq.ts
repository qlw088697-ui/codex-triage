import type { FaqHit } from "../engine/search.js";
import { sanitizeTerminalText } from "./terminal.js";

function localize(rule: FaqHit["rule"], locale: string) {
  const l = rule.i18n[locale];
  return { title: l?.title ?? rule.title, summary: l?.summary ?? rule.summary };
}

export function renderFaq(input: { hits: FaqHit[]; query: string; locale: "en" | "zh-CN" }): string {
  const zh = input.locale === "zh-CN";
  const out: string[] = [
    zh ? "常见问题（离线检索）" : "Codex Triage FAQ (offline)",
    "─".repeat(56),
  ];
  if (input.query.trim()) {
    out.push(`${zh ? "查询" : "Query"}: ${input.query.trim()}`);
  }
  out.push("");
  if (!input.hits.length) {
    out.push(
      zh ? "没有检索到相关条目。" : "No matching entries found.",
      zh ? "换用更短的关键词，或用 --report 生成脱敏报告提交新规则。" : "Try shorter keywords, or generate a sanitized report with --report to propose a new rule.",
    );
    return sanitizeTerminalText(out.join("\n"));
  }
  if (!input.query.trim()) {
    out.push(zh ? `知识库共 ${input.hits.length} 条规则：` : `${input.hits.length} rule(s) in the knowledge base:`, "");
  }
  for (const hit of input.hits) {
    const text = localize(hit.rule, input.locale);
    const scoreSuffix = hit.score > 0 ? ` · ${zh ? "相关度" : "relevance"} ${hit.score}` : "";
    out.push(`${hit.rule.severity.toUpperCase()} · ${text.title}${scoreSuffix}`);
    out.push(`  ${text.summary}`);
    out.push(`  ${zh ? "分类" : "Category"}: ${hit.rule.category}${hit.rule.tags.length ? ` · ${zh ? "标签" : "Tags"}: ${hit.rule.tags.join(", ")}` : ""}`);
    const actions = (hit.rule.i18n[input.locale]?.actions ?? hit.rule.actions).slice(0, 2);
    actions.forEach((action, index) => out.push(`  ${index + 1}. ${action}`));
    for (const link of hit.rule.links) {
      out.push(`  - ${link.label ?? link.url}: ${link.url}`);
    }
    out.push("", "─".repeat(56));
  }
  return sanitizeTerminalText(out.join("\n"));
}

export interface FaqResultJson {
  id: string;
  title: string;
  severity: string;
  category: string;
  score: number;
  summary: string;
  tags: string[];
  links: Array<{ type: string; url: string; label?: string }>;
}

export function faqHitsToJson(hits: FaqHit[], locale: "en" | "zh-CN"): FaqResultJson[] {
  return hits.map(({ rule, score }) => ({
    id: rule.id,
    title: rule.i18n[locale]?.title ?? rule.title,
    severity: rule.severity,
    category: rule.category,
    score,
    summary: rule.i18n[locale]?.summary ?? rule.summary,
    tags: rule.tags,
    links: rule.links,
  }));
}
