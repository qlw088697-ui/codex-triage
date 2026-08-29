const secretPatterns: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[OPENAI_API_KEY]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[GITHUB_TOKEN]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[AWS_ACCESS_KEY_ID]"],
  [/\b(?:Bearer\s+)[A-Za-z0-9._~+\/-]{16,}=*/gi, "Bearer [TOKEN]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[JWT]"],
];

export function redactText(input: string): string {
  let output = input;
  for (const [pattern, replacement] of secretPatterns) output = output.replace(pattern, replacement);

  output = output
    .replace(/([A-Za-z]:\\Users\\)[^\\\r\n]+/gi, "$1[USER]")
    .replace(/(\/Users\/)[^/\r\n]+/g, "$1[USER]")
    .replace(/(\/home\/)[^/\r\n]+/g, "$1[USER]")
    .replace(/([?&](?:token|key|secret|code)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]");

  return output;
}
