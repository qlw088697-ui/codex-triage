export type Platform = "windows" | "macos" | "linux" | "wsl";

/** Locales with full CLI UI strings; rule-level i18n falls back to English per field. */
export type Locale = "en" | "zh-CN" | "ja";
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
  codexVersions?: string[];
  lastVerified?: string;
  source?: string;
  deprecated?: boolean;
  deprecationReason?: string;
  replacedBy?: string;
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
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`${name} must be non-empty string[]`);
  const result = value as string[];
  if (new Set(result).size !== result.length) throw new Error(`${name} must not contain duplicates`);
  return result;
};
const req = (record: UnknownRecord, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || !value) throw new Error(`${key} must be a non-empty string`);
  return value;
};

const VERSION_EXPR = /^(>=|<=|>|<|=)?(\d+|\*)\.(\d+|\*)\.(\d+|\*)$/;

const versionExpressions = (value: unknown, name: string): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== "string")) throw new Error(`${name} must be a non-empty string[]`);
  for (const expr of value as string[]) {
    const match = VERSION_EXPR.exec(expr);
    if (!match) throw new Error(`${name} entries must look like 1.2.3, 1.2.*, 1.*.*, or >=1.2.3`);
    const [, op, , minor = "", patch = ""] = match;
    if (op && op !== "=" && (minor === "*" || patch === "*")) throw new Error(`${name} comparators cannot use wildcards`);
  }
  return value as string[];
};

const isoDate = (value: unknown, name: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must be an ISO date (YYYY-MM-DD)`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${name} must be a real calendar date`);
  return value;
};

const httpUrl = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !value) throw new Error(`${name} must be a non-empty string`);
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("unsupported protocol");
  } catch {
    throw new Error(`${name} must be a valid http(s) url`);
  }
  return value;
};

function parseCodexVersion(value: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
}

/** True when the reported Codex version satisfies any expression of the rule. */
export function codexVersionSatisfies(version: string | undefined, expressions: string[] | undefined): boolean {
  if (!expressions?.length) return true;
  if (!version) return false;
  const parsed = parseCodexVersion(version);
  if (!parsed) return false;
  return expressions.some((expr) => {
    const match = VERSION_EXPR.exec(expr);
    if (!match) return false;
    const [, op = "=", rawMajor, rawMinor = "0", rawPatch = "0"] = match;
    const target = [rawMajor, rawMinor, rawPatch].map((part) => (part === "*" ? -1 : Number(part)));
    if (op !== "=" && target.some((part) => part === -1)) return false;
    for (let i = 0; i < 3; i++) {
      const wanted = target[i];
      if (wanted === -1) return true;
      if (parsed[i] > wanted) return op === ">" || op === ">=";
      if (parsed[i] < wanted) return op === "<" || op === "<=";
    }
    return op === "=" || op === ">=" || op === "<=";
  });
}

type QuantifierKind = "none" | "bounded" | "unbounded";

function followingQuantifier(flat: string, index: number): QuantifierKind {
  const ch = flat[index];
  if (ch === "+" || ch === "*") return "unbounded";
  if (ch === "?") return "bounded";
  if (ch === "{") {
    const close = flat.indexOf("}", index);
    if (close === -1) return "none";
    return flat.slice(index, close + 1).includes(",") ? "unbounded" : "bounded";
  }
  return "none";
}

function braceIsRange(flat: string, index: number): boolean {
  const close = flat.indexOf("}", index);
  return close !== -1 && flat.slice(index, close + 1).includes(",");
}

/**
 * Reports whether a group can match the same span in more than one way.
 * Over-approximates on purpose: alternations, optional/variable quantifiers,
 * and nested groups with any internal ambiguity all count, so no
 * safe-but-ambiguous shape slips through a conservative static pass. Exact
 * repetition ({n}) is deterministic and does not count.
 */
function scanGroup(flat: string, open: number): { close: number; bearing: boolean } {
  let i = open + 1;
  if (flat[i] === "?") {
    i++;
    if (flat[i] === "<" || flat[i] === "'" || flat[i] === "P") {
      while (i < flat.length && flat[i] !== ">" && flat[i] !== "'") i++;
      if (i < flat.length) i++;
    }
  }
  let bearing = false;
  while (i < flat.length && flat[i] !== ")") {
    const ch = flat[i];
    if (ch === "(") {
      const nested = scanGroup(flat, i);
      i = nested.close + 1;
      if (nested.bearing || followingQuantifier(flat, i) === "unbounded") bearing = true;
      continue;
    }
    if (ch === "|") bearing = true;
    else if (ch === "+" || ch === "*" || ch === "?") bearing = true;
    else if (ch === "{" && braceIsRange(flat, i)) bearing = true;
    i++;
  }
  return { close: i, bearing };
}

/**
 * Conservative static check for classic catastrophic-backtracking shapes:
 * a group with internal ambiguity (quantifiers or alternation) that is itself
 * followed by an unbounded quantifier, e.g. (a+)+, (ab?)*, (.*)+, (a|b){2,}.
 * False positives are acceptable; affected rules can always be rewritten with
 * bounded or separated matchers.
 */
function hasCatastrophicQuantifier(pattern: string): boolean {
  const flat = pattern.replace(/\\./g, "\u0000").replace(/\[[^\]]*\]/g, "\u0000");
  let i = 0;
  while (i < flat.length) {
    if (flat[i] === "(") {
      const group = scanGroup(flat, i);
      i = group.close + 1;
      if (group.bearing && followingQuantifier(flat, i) === "unbounded") return true;
      continue;
    }
    i++;
  }
  return false;
}

function textMatcher(value: unknown): TextMatcher {
  if (!isRecord(value)) throw new Error("text matcher must be an object");
  const contains = typeof value.contains === "string" && value.contains.trim() ? value.contains : undefined;
  const regex = typeof value.regex === "string" && value.regex.trim() ? value.regex : undefined;
  if (Boolean(contains) === Boolean(regex)) throw new Error("text matcher requires exactly one of contains or regex");
  if (contains && contains.length > 1000) throw new Error("contains matcher is too long");
  const flags = typeof value.flags === "string" ? value.flags : undefined;
  if (flags && (!/^[imsu]+$/.test(flags) || new Set(flags).size !== flags.length)) throw new Error("regex flags may contain unique i, m, s, or u only");
  if (regex) {
    if (regex.length > 512) throw new Error("regex matcher is too long");
    try { new RegExp(regex, flags ?? "i"); } catch (error) {
      throw new Error(`invalid regex matcher: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (hasCatastrophicQuantifier(regex)) {
      throw new Error("regex matcher risks catastrophic backtracking; avoid quantifying a group that already contains quantifiers or alternation");
    }
  }
  const weight = value.weight === undefined ? undefined : Number(value.weight);
  if (weight !== undefined && (!Number.isInteger(weight) || weight < 1 || weight > 80)) throw new Error("matcher weight must be 1..80");
  return { contains, regex, flags, weight };
}

export function validateRule(value: unknown): Rule {
  if (!isRecord(value)) throw new Error("rule must be an object");
  if (value.schemaVersion !== undefined && value.schemaVersion !== 2) {
    throw new Error("unsupported rule schemaVersion (expected 2)");
  }
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
  const any = anyRaw.map(textMatcher);
  const all = allRaw.map(textMatcher);
  const matcherKey = (matcher: TextMatcher) => JSON.stringify([matcher.contains, matcher.regex, matcher.flags ?? "i"]);
  const matcherKeys = [...any, ...all].map(matcherKey);
  if (new Set(matcherKeys).size !== matcherKeys.length) throw new Error("matchers must not be duplicated");
  let doctor: DoctorMatcher | undefined;
  if (value.match.doctor !== undefined) {
    if (!isRecord(value.match.doctor)) throw new Error("match.doctor must be an object");
    const statuses = strings(value.match.doctor.statuses, "doctor.statuses") as DoctorStatus[] | undefined;
    if (statuses?.some((s) => !["ok","warning","fail"].includes(s))) throw new Error("invalid doctor status");
    const checkIds = strings(value.match.doctor.checkIds, "doctor.checkIds");
    const categories = strings(value.match.doctor.categories, "doctor.categories");
    if (!checkIds?.length && !categories?.length) throw new Error("match.doctor requires checkIds or categories");
    doctor = { checkIds, categories, statuses };
  }
  if (!any.length && !all.length && !doctor) throw new Error("match requires text matchers or a doctor constraint");
  const actions = strings(value.actions, "actions");
  if (!actions?.length) throw new Error("actions must contain at least one item");
  const links: RuleLink[] = [];
  const linksRaw = value.links ?? [];
  if (!Array.isArray(linksRaw)) throw new Error("links must be an array");
  for (const link of linksRaw) {
    if (!isRecord(link)) throw new Error("link must be an object");
    const type = link.type;
    if (type !== "github_issue" && type !== "docs" && type !== "other") throw new Error("invalid link type");
    const url = httpUrl(link.url, "link url");
    links.push({ type, url, label: typeof link.label === "string" ? link.label : undefined });
  }
  const deprecated = value.deprecated === undefined ? undefined : value.deprecated;
  if (deprecated !== undefined && typeof deprecated !== "boolean") throw new Error("deprecated must be a boolean");
  const deprecationReason = typeof value.deprecationReason === "string" && value.deprecationReason.trim() ? value.deprecationReason : undefined;
  if (deprecated === true && !deprecationReason) throw new Error("deprecationReason is required when deprecated is true");
  if (deprecationReason && deprecated !== true) throw new Error("deprecationReason requires deprecated: true");
  const replacedBy = typeof value.replacedBy === "string" && value.replacedBy ? value.replacedBy : undefined;
  if (replacedBy) {
    if (replacedBy === id) throw new Error("replacedBy cannot reference the rule itself");
    if (!/^[a-z0-9][a-z0-9-]+$/.test(replacedBy)) throw new Error("replacedBy must look like a rule id");
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
    codexVersions: versionExpressions(value.codexVersions, "codexVersions"),
    lastVerified: isoDate(value.lastVerified, "lastVerified"),
    source: value.source === undefined ? undefined : httpUrl(value.source, "source"),
    deprecated, deprecationReason, replacedBy,
    match: { any, all, doctor },
    summary: req(value, "summary"), explanation: typeof value.explanation === "string" ? value.explanation : undefined,
    actions, links, tags: strings(value.tags, "tags") ?? [], i18n,
  };
}
