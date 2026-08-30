export const secretPatterns: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[OPENAI_API_KEY]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[GITHUB_TOKEN]"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "[GITHUB_TOKEN]"],
  [/\bglpat-[A-Za-z0-9_-]{16,}\b/g, "[GITLAB_TOKEN]"],
  [/\bnpm_[A-Za-z0-9]{20,}\b/g, "[NPM_TOKEN]"],
  [/\bxox[baprs]-[A-Za-z0-9-]{16,}\b/g, "[SLACK_TOKEN]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[AWS_ACCESS_KEY_ID]"],
  [/\b(?:Bearer\s+)[A-Za-z0-9._~+\/-]{16,}=*/gi, "Bearer [TOKEN]"],
  [/\b((?:Proxy-)?Authorization\s*:\s*Basic\s+)[A-Za-z0-9+/=]{8,}/gi, "$1[TOKEN]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[JWT]"],
];

export function redactText(input: string): string {
  let output = input;
  for (const [pattern, replacement] of secretPatterns) output = output.replace(pattern, replacement);

  // User-directory patterns tolerate JSON-escaped separators (e.g. C:\\Users\\alice in a
  // raw log/JSON dump) and forward-slash variants so escaped input cannot bypass redaction.
  output = output
    .replace(/(https?:\/\/)[^\s\/:@]+:[^\s\/@]+@/gi, "$1[USER]:[PASSWORD]@")
    .replace(/([A-Za-z]:\\+Users\\+)[^\\\r\n]+/gi, "$1[USER]")
    .replace(/([A-Za-z]:\/+Users\/+)[^\/\\\r\n]+/gi, "$1[USER]")
    .replace(/(\\?\/Users\\?\/)[^\/\\\r\n]+/g, "$1[USER]")
    .replace(/(\\?\/home\\?\/)[^\/\\\r\n]+/g, "$1[USER]")
    .replace(/([?&#](?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|token|key|secret|code)=)[^&#\s]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|secret)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");

  return output;
}

/** Recursively redacts every string in a JSON-like value without mutating the input. */
export function redactValue<T>(value: T): T {
  if (typeof value === "string") return redactText(value) as T;
  if (Array.isArray(value)) return value.map((item) => redactValue(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redactValue(item)])
    ) as T;
  }
  return value;
}
