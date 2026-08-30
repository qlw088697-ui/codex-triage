import type { Rule } from "../knowledge/schema.js";

export interface FaqHit {
  rule: Rule;
  score: number;
}

interface SearchField {
  text: string;
  weight: number;
}

function fieldsFor(rule: Rule, locale: "en" | "zh-CN"): SearchField[] {
  const localized = rule.i18n[locale];
  const fields: SearchField[] = [
    { text: rule.title, weight: 3 },
    { text: rule.summary, weight: 2 },
    { text: rule.explanation ?? "", weight: 1 },
  ];
  if (localized) {
    fields.push(
      { text: localized.title ?? "", weight: 3 },
      { text: localized.summary ?? "", weight: 2 },
      { text: localized.explanation ?? "", weight: 1 },
    );
  }
  return fields;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((token) => token.length > 1);
}

/**
 * Deterministic offline search over the bundled knowledge base. Both the base
 * (English) and the requested locale's fields are searched, so Chinese queries
 * hit zh titles and English queries keep working under --lang zh-CN. Every
 * query token must appear somewhere; the score is the summed field-weight of
 * its appearances plus a bonus when the whole phrase matches a summary.
 */
export function searchRules(rules: Rule[], query: string, locale: "en" | "zh-CN"): FaqHit[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return rules
      .map((rule) => ({ rule, score: 0 }))
      .sort((a, b) => a.rule.category.localeCompare(b.rule.category) || a.rule.id.localeCompare(b.rule.id));
  }

  const tokens = tokenize(trimmed);
  if (!tokens.length) return [];
  const lowerPhrase = trimmed.toLowerCase();

  const hits: FaqHit[] = [];
  for (const rule of rules) {
    const fields = fieldsFor(rule, locale);
    const tagText = rule.tags.join("\n").toLowerCase();
    let score = 0;
    let allTokensFound = true;
    for (const token of tokens) {
      let tokenScore = 0;
      for (const field of fields) {
        if (field.text.toLowerCase().includes(token)) tokenScore += field.weight;
      }
      if (tagText.includes(token)) tokenScore += 3;
      if (tokenScore === 0) allTokensFound = false;
      score += tokenScore;
    }
    if (!allTokensFound) continue;
    const phraseInTitle = rule.title.toLowerCase().includes(lowerPhrase);
    const phraseInSummary = rule.summary.toLowerCase().includes(lowerPhrase)
      || (rule.i18n[locale]?.summary ?? "").toLowerCase().includes(lowerPhrase);
    if (phraseInTitle) score += 20;
    if (phraseInSummary) score += 10;
    if (score > 0) hits.push({ rule, score });
  }

  return hits.sort((a, b) =>
    b.score - a.score
    || a.rule.category.localeCompare(b.rule.category)
    || a.rule.id.localeCompare(b.rule.id)
  );
}
