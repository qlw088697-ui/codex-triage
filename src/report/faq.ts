import type { FaqHit } from "../engine/search.js";
import type { Locale } from "../knowledge/schema.js";
import { sanitizeTerminalText } from "./terminal.js";

function localize(rule: FaqHit["rule"], locale: string) {
  const l = rule.i18n[locale];
  return { title: l?.title ?? rule.title, summary: l?.summary ?? rule.summary };
}

const UI = {
  en: {
    title: "Codex Triage FAQ (offline)",
    query: "Query",
    none: "No matching entries found.",
    hint: "Try shorter keywords, or generate a sanitized report with --report to propose a new rule.",
    listing: (n: number) => `${n} rule(s) in the knowledge base:`,
    relevance: "relevance",
    category: "Category",
    tags: "Tags",
  },
  "zh-CN": {
    title: "常见问题（离线检索）",
    query: "查询",
    none: "没有检索到相关条目。",
    hint: "换用更短的关键词，或用 --report 生成脱敏报告提交新规则。",
    listing: (n: number) => `知识库共 ${n} 条规则：`,
    relevance: "相关度",
    category: "分类",
    tags: "标签",
  },
  ja: {
    title: "よくある質問（オフライン検索）",
    query: "検索語",
    none: "一致する項目が見つかりませんでした。",
    hint: "短いキーワードに変えるか、--report でサニタイズ済みレポートを生成して新しいルールを提案してください。",
    listing: (n: number) => `ナレッジベースには ${n} 件のルールがあります:`,
    relevance: "関連度",
    category: "カテゴリ",
    tags: "タグ",
  },
} as const;

function uiStrings(locale: string) {
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("zh")) return UI["zh-CN"];
  if (normalized.startsWith("ja")) return UI.ja;
  return UI.en;
}

export function renderFaq(input: { hits: FaqHit[]; query: string; locale: Locale }): string {
  const t = uiStrings(input.locale);
  const out: string[] = [t.title, "─".repeat(56)];
  if (input.query.trim()) {
    out.push(`${t.query}: ${input.query.trim()}`);
  }
  out.push("");
  if (!input.hits.length) {
    out.push(t.none, t.hint);
    return sanitizeTerminalText(out.join("\n"));
  }
  if (!input.query.trim()) {
    out.push(t.listing(input.hits.length), "");
  }
  for (const hit of input.hits) {
    const text = localize(hit.rule, input.locale);
    const scoreSuffix = hit.score > 0 ? ` · ${t.relevance} ${hit.score}` : "";
    out.push(`${hit.rule.severity.toUpperCase()} · ${text.title}${scoreSuffix}`);
    out.push(`  ${text.summary}`);
    out.push(`  ${t.category}: ${hit.rule.category}${hit.rule.tags.length ? ` · ${t.tags}: ${hit.rule.tags.join(", ")}` : ""}`);
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

export function faqHitsToJson(hits: FaqHit[], locale: Locale): FaqResultJson[] {
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
