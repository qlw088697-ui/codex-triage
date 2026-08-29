import type { RuleMatch } from "./matcher.js";

export function topMatches(matches: RuleMatch[], limit = 5): RuleMatch[] {
  return matches.slice(0, Math.max(0, limit));
}
