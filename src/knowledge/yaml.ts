/**
 * Minimal dependency-free YAML subset parser for knowledge rules.
 *
 * Supports what rules realistically use: block mappings, block sequences,
 * compact mapping items inside sequences, flow collections, single/double
 * quoted and plain scalars, comments, and simple type inference for unquoted
 * scalars (numbers, true/false/null). Anything else - anchors, aliases, tags,
 * multi-line block scalars, directives - is rejected with a clear error
 * instead of being mis-parsed. Parsed output still passes through the strict
 * rule validator, so this parser only needs to be structurally correct, not
 * semantically aware.
 */

type Scalar = string | number | boolean | null;
type YamlValue = Scalar | YamlValue[] | { [key: string]: YamlValue };

class YamlError extends Error {}

interface Line {
  indent: number;
  content: string;
  number: number;
}

function isEscapedQuote(text: string, index: number): boolean {
  let backslashes = 0;
  while (index - backslashes - 1 >= 0 && text[index - backslashes - 1] === "\\") backslashes++;
  return backslashes % 2 === 1;
}

function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && !isEscapedQuote(line, i)) inDouble = !inDouble;
    else if (ch === "#" && !inSingle && !inDouble && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseLines(source: string): Line[] {
  const lines: Line[] = [];
  const raw = source.replace(/\r\n?/g, "\n").split("\n");
  for (let index = 0; index < raw.length; index++) {
    const original = raw[index];
    if (/^\t/.test(original)) throw new YamlError(`line ${index + 1}: tab indentation is not allowed`);
    const withoutComment = stripComment(original);
    if (!withoutComment.trim()) continue;
    if (/^\s*---\s*$/.test(withoutComment) || /^\s*\.\.\.\s*$/.test(withoutComment)) continue;
    if (/^\s*%/.test(withoutComment)) throw new YamlError(`line ${index + 1}: directives are not supported`);
    const trimmed = withoutComment.trim();
    if (trimmed.startsWith("!!") || trimmed.startsWith("&") || trimmed.startsWith("*")) {
      throw new YamlError(`line ${index + 1}: tags, anchors and aliases are not supported`);
    }
    if (trimmed === "|" || trimmed === ">" || /^[|>][+-]?\d*\s*$/.test(trimmed)) {
      throw new YamlError(`line ${index + 1}: multi-line block scalars are not supported`);
    }
    const indent = withoutComment.length - withoutComment.trimStart().length;
    lines.push({ indent, content: trimmed, number: index + 1 });
  }
  return lines;
}

function parseScalar(token: string, lineNumber: number): Scalar {
  const trimmed = token.trim();
  if (trimmed === "") throw new YamlError(`line ${lineNumber}: empty scalar value`);
  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'") || trimmed.length < 2) throw new YamlError(`line ${lineNumber}: unterminated single-quoted scalar`);
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  if (trimmed.startsWith('"')) {
    try {
      JSON.parse(trimmed);
    } catch {
      throw new YamlError(`line ${lineNumber}: unterminated or invalid double-quoted scalar`);
    }
    return JSON.parse(trimmed) as string;
  }
  if (/^[&*!]/.test(trimmed)) throw new YamlError(`line ${lineNumber}: tags, anchors and aliases are not supported`);
  if (trimmed === "null" || trimmed === "~" || trimmed === "Null" || trimmed === "NULL") return null;
  if (trimmed === "true" || trimmed === "True" || trimmed === "TRUE") return true;
  if (trimmed === "false" || trimmed === "False" || trimmed === "FALSE") return false;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
    const value = Number(trimmed);
    if (Number.isFinite(value)) return value;
  }
  return trimmed;
}

/** Finds the index of a closing flow bracket at depth 0, or -1. */
function findFlowEnd(text: string, open: string, close: string): number {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && !isEscapedQuote(text, i)) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

function findKeyColon(text: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && !isEscapedQuote(text, i)) inDouble = !inDouble;
    else if (ch === ":" && !inSingle && !inDouble) {
      const next = text[i + 1];
      if (next === undefined || next === " " || next === "\t") return i;
    }
  }
  return -1;
}

function splitFlowBody(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && !isEscapedQuote(body, i)) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") depth--;
      else if (ch === "," && depth === 0) {
        parts.push(body.slice(start, i));
        start = i + 1;
      }
    }
  }
  parts.push(body.slice(start));
  return parts.filter((part) => part.trim() !== "");
}

function parseFlowKey(token: string, lineNumber: number): string {
  const scalar = parseScalar(token, lineNumber);
  if (typeof scalar !== "string") throw new YamlError(`line ${lineNumber}: mapping keys must be strings`);
  return scalar;
}

function parseFlow(text: string, lineNumber: number): YamlValue {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    const end = findFlowEnd(trimmed, "[", "]");
    if (end !== trimmed.length - 1) throw new YamlError(`line ${lineNumber}: malformed flow sequence`);
    return splitFlowBody(trimmed.slice(1, end)).map((part) => parseFlow(part, lineNumber));
  }
  if (trimmed.startsWith("{")) {
    const end = findFlowEnd(trimmed, "{", "}");
    if (end !== trimmed.length - 1) throw new YamlError(`line ${lineNumber}: malformed flow mapping`);
    const result: { [key: string]: YamlValue } = {};
    for (const pair of splitFlowBody(trimmed.slice(1, end))) {
      const colon = findKeyColon(pair);
      if (colon === -1) throw new YamlError(`line ${lineNumber}: flow mapping entries need a "key: value" pair`);
      const key = parseFlowKey(pair.slice(0, colon), lineNumber);
      result[key] = parseFlow(pair.slice(colon + 1), lineNumber);
    }
    return result;
  }
  return parseScalar(trimmed, lineNumber);
}

function isSequenceEntry(content: string): boolean {
  return content.startsWith("- ") || content === "-";
}

function parseBlock(lines: Line[], start: number, indent: number): { value: YamlValue; next: number } {
  if (start >= lines.length) throw new YamlError("unexpected end of input");
  if (lines[start].indent !== indent) {
    throw new YamlError(`line ${lines[start].number}: inconsistent indentation`);
  }

  if (isSequenceEntry(lines[start].content)) {
    const sequence: YamlValue[] = [];
    let index = start;
    while (index < lines.length && lines[index].indent === indent && isSequenceEntry(lines[index].content)) {
      const line = lines[index];
      const rest = line.content === "-" ? "" : line.content.slice(2).trim();
      if (rest === "") {
        // Bare "-": the item body is the following, deeper block.
        if (index + 1 < lines.length && lines[index + 1].indent > indent) {
          const nested = parseBlock(lines, index + 1, lines[index + 1].indent);
          sequence.push(nested.value);
          index = nested.next;
        } else {
          sequence.push(null);
          index++;
        }
        continue;
      }
      const colon = findKeyColon(rest);
      if (colon !== -1 && !rest.startsWith("{") && !rest.startsWith("[")) {
        // Compact mapping item: the rest of this line is the first key of a
        // mapping whose continuation lines live at exactly indent + 2.
        const itemIndent = indent + 2;
        const subLines: Line[] = [{ indent: 0, content: rest, number: line.number }];
        let cursor = index + 1;
        while (cursor < lines.length && lines[cursor].indent >= itemIndent) {
          subLines.push({ indent: lines[cursor].indent - itemIndent, content: lines[cursor].content, number: lines[cursor].number });
          cursor++;
        }
        const parsed = parseBlock(subLines, 0, 0);
        if (parsed.next < subLines.length) {
          throw new YamlError(`line ${subLines[parsed.next].number}: unexpected indentation inside a compact mapping item`);
        }
        sequence.push(parsed.value);
        index = cursor;
        continue;
      }
      if (rest.startsWith("[") || rest.startsWith("{")) {
        sequence.push(parseFlow(rest, line.number));
        index++;
        continue;
      }
      if (rest.startsWith("- ")) throw new YamlError(`line ${line.number}: nested inline sequences are not supported`);
      sequence.push(parseScalar(rest, line.number));
      index++;
    }
    return { value: sequence, next: index };
  }

  const mapping: { [key: string]: YamlValue } = {};
  let index = start;
  while (index < lines.length && lines[index].indent === indent) {
    const line = lines[index];
    if (isSequenceEntry(line.content)) {
      throw new YamlError(`line ${line.number}: unexpected sequence entry inside a mapping`);
    }
    const colon = findKeyColon(line.content);
    if (colon === -1) throw new YamlError(`line ${line.number}: expected a "key: value" mapping entry`);
    const key = parseFlowKey(line.content.slice(0, colon), line.number);
    const rest = line.content.slice(colon + 1).trim();
    if (rest !== "") {
      if (rest.startsWith("[") || rest.startsWith("{")) {
        mapping[key] = parseFlow(rest, line.number);
        index++;
        continue;
      }
      if (/^[|>][+-]?\d*$/.test(rest)) throw new YamlError(`line ${line.number}: multi-line block scalars are not supported`);
      if (findKeyColon(rest) !== -1 && !rest.startsWith("'") && !rest.startsWith('"')) {
        throw new YamlError(`line ${line.number}: unexpected ": " inside a scalar value; quote the value`);
      }
      mapping[key] = parseScalar(rest, line.number);
      index++;
      continue;
    }
    // Bare "key:" - the value is a nested block (deeper indent), a sequence at
    // the same indent as the key, or null.
    const next = index + 1 < lines.length ? lines[index + 1] : undefined;
    if (next && next.indent > indent) {
      const nested = parseBlock(lines, index + 1, next.indent);
      mapping[key] = nested.value;
      index = nested.next;
      continue;
    }
    if (next && next.indent === indent && isSequenceEntry(next.content)) {
      const nested = parseBlock(lines, index + 1, indent);
      mapping[key] = nested.value;
      index = nested.next;
      continue;
    }
    mapping[key] = null;
    index++;
  }
  return { value: mapping, next: index };
}

/** Parses the YAML subset used by knowledge rules into a plain JS value. */
export function parseYaml(source: string): unknown {
  const lines = parseLines(source);
  if (!lines.length) throw new YamlError("document is empty");
  const result = parseBlock(lines, 0, lines[0].indent);
  if (result.next < lines.length) {
    throw new YamlError(`line ${lines[result.next].number}: unexpected content after the top-level block`);
  }
  return result.value;
}
