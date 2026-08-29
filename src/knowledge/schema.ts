export type Platform = "windows" | "macos" | "linux" | "wsl";
export type Severity = "low" | "medium" | "high";
export type DoctorStatus = "ok" | "warning" | "fail";

export interface TextMatcher { contains?: string; regex?: string; flags?: string; weight?: number; }
export interface DoctorMatcher { checkIds?: string[]; categories?: string[]; statuses?: DoctorStatus[]; }
export interface LocalizedRule { title?: string; summary?: string; explanation?: string; actions?: string[]; }
export interface RuleLink { type: "github_issue" | "docs" | "other"; url: string; label?: string; }
export interface Rule {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  platforms?: Platform[];
  match: { any: TextMatcher[]; all: TextMatcher[]; doctor?: DoctorMatcher };
  summary: string;
  explanation?: string;
  actions: string[];
  links: RuleLink[];
  tags: string[];
  i18n: Record<string, LocalizedRule>;
}

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown, name: string): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`${name} must be string[]`);
  return value as string[];
};
const req = (record: UnknownRecord, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || !value) throw new Error(`${key} must be a non-empty string`);
  return value;
};

function textMatcher(value: unknown): TextMatcher {
  if (!isRecord(value)) throw new Error("text matcher must be an object");
  const contains = typeof value.contains === "string" ? value.contains : undefined;
  const regex = typeof value.regex === "string" ? value.regex : undefined;
  if (!contains && !regex) throw new Error("text matcher requires contains or regex");
  const weight = value.weight === undefined ? undefined : Number(value.weight);
  if (weight !== undefined && (!Number.isInteger(weight) || weight < 1 || weight > 80)) throw new Error("matcher weight must be 1..80");
  return { contains, regex, flags: typeof value.flags === "string" ? value.flags : undefined, weight };
}

export function validateRule(value: unknown): Rule {
  if (!isRecord(value)) throw new Error("rule must be an object");
  const id = req(value, "id");
  if (!/^[a-z0-9][a-z0-9-]+$/.test(id)) throw new Error("invalid rule id");
  const severity = value.severity;
  if (severity !== "low" && severity !== "medium" && severity !== "high") throw new Error("invalid severity");
  const platforms = strings(value.platforms, "platforms") as Platform[] | undefined;
  if (platforms?.some((p) => !["windows","macos","linux","wsl"].includes(p))) throw new Error("invalid platform");
  if (!isRecord(value.match)) throw new Error("match must be an object");
  const anyRaw = value.match.any ?? [];
  const allRaw = value.match.all ?? [];
  if (!Array.isArray(anyRaw) || !Array.isArray(allRaw)) throw new Error("match.any/all must be arrays");
  let doctor: DoctorMatcher | undefined;
  if (value.match.doctor !== undefined) {
    if (!isRecord(value.match.doctor)) throw new Error("match.doctor must be an object");
    const statuses = strings(value.match.doctor.statuses, "doctor.statuses") as DoctorStatus[] | undefined;
    if (statuses?.some((s) => !["ok","warning","fail"].includes(s))) throw new Error("invalid doctor status");
    doctor = { checkIds: strings(value.match.doctor.checkIds, "doctor.checkIds"), categories: strings(value.match.doctor.categories, "doctor.categories"), statuses };
  }
  const actions = strings(value.actions, "actions");
  if (!actions?.length) throw new Error("actions must contain at least one item");
  const links: RuleLink[] = [];
  const linksRaw = value.links ?? [];
  if (!Array.isArray(linksRaw)) throw new Error("links must be an array");
  for (const link of linksRaw) {
    if (!isRecord(link)) throw new Error("link must be an object");
    const type = link.type;
    if (type !== "github_issue" && type !== "docs" && type !== "other") throw new Error("invalid link type");
    const url = req(link, "url");
    try { new URL(url); } catch { throw new Error(`invalid url: ${url}`); }
    links.push({ type, url, label: typeof link.label === "string" ? link.label : undefined });
  }
  const i18n: Record<string, LocalizedRule> = {};
  const i18nRaw = value.i18n ?? {};
  if (!isRecord(i18nRaw)) throw new Error("i18n must be an object");
  for (const [locale, localized] of Object.entries(i18nRaw)) {
    if (!isRecord(localized)) throw new Error(`i18n.${locale} must be an object`);
    i18n[locale] = { title: typeof localized.title === "string" ? localized.title : undefined, summary: typeof localized.summary === "string" ? localized.summary : undefined, explanation: typeof localized.explanation === "string" ? localized.explanation : undefined, actions: strings(localized.actions, `i18n.${locale}.actions`) };
  }
  return {
    id, title: req(value, "title"), category: req(value, "category"), severity, platforms,
    match: { any: anyRaw.map(textMatcher), all: allRaw.map(textMatcher), doctor },
    summary: req(value, "summary"), explanation: typeof value.explanation === "string" ? value.explanation : undefined,
    actions, links, tags: strings(value.tags, "tags") ?? [], i18n,
  };
}
