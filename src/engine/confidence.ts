import type { RuleMatch } from "./matcher.js";

export function confidenceLabel(match: RuleMatch): "strong" | "likely" | "possible" {
  if (match.confidence >= 90) return "strong";
  if (match.confidence >= 75) return "likely";
  return "possible";
}
