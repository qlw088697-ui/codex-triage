# Rule schema reference (v1, stable)

This document is the normative contract for knowledge rules starting with codex-triage 1.0.

**Compatibility promise:** within the 1.x series the schema only gains optional fields. Required fields never change meaning, and existing valid rules keep loading unchanged. A breaking change requires a new `schemaVersion` generation and a major release. Loaders reject rules whose `schemaVersion` is newer than the generation they support — that refusal is intentional.

Rules are stored with a `.yml`, `.yaml`, or `.json` extension. Since 1.1 a file may be strict JSON or the supported YAML subset: block mappings, block sequences (including compact `- key: value` items), flow collections, single/double quoted or plain scalars, and comments. Anchors, aliases, tags, directives, and multi-line block scalars are rejected with a clear error instead of being mis-parsed. Plain scalars containing `": "` must be quoted.

## Example

```json
{
  "schemaVersion": 2,
  "id": "windows-createprocess-error-1312",
  "title": "Windows sandbox cannot spawn a process (error 1312)",
  "category": "sandbox",
  "severity": "high",
  "platforms": ["windows"],
  "codexVersions": [">=0.129.0"],
  "lastVerified": "2026-08-30",
  "source": "https://github.com/openai/codex/issues/24511",
  "match": {
    "any": [{ "contains": "CreateProcessAsUserW failed: 1312" }],
    "all": [],
    "doctor": { "checkIds": ["sandbox.launch"], "statuses": ["fail"] }
  },
  "summary": "One-line description of the symptom.",
  "explanation": "Optional longer context.",
  "actions": ["First safe step.", "Second safe step."],
  "links": [{ "type": "github_issue", "url": "https://github.com/openai/codex/issues/31768", "label": "openai/codex#31768" }],
  "tags": ["windows", "sandbox"],
  "i18n": {
    "zh-CN": {
      "title": "中文标题",
      "summary": "中文一句话描述。",
      "explanation": "可选的中文补充说明。",
      "actions": ["中文建议步骤。"]
    }
  }
}
```

## Fields

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `schemaVersion` | integer | optional | Must be `2` when present; other generations are rejected at load time |
| `id` | string | yes | Lowercase `[a-z0-9-]`, at least two characters, unique across the knowledge base |
| `title` | string | yes | English display title |
| `category` | string | yes | Free-form group name (`auth`, `sandbox`, `network`, `wsl`, …) |
| `severity` | string | yes | One of `low`, `medium`, `high` |
| `platforms` | string[] | optional | Subset of `windows`, `macos`, `linux`, `wsl`; absent means all platforms |
| `codexVersions` | string[] | optional | Version expressions (below); OR-combined |
| `lastVerified` | string | optional | ISO date `YYYY-MM-DD`, must be a real calendar date |
| `source` | string | optional | Public http(s) URL documenting the signature |
| `deprecated` | boolean | optional | Deprecated rules are never matched |
| `deprecationReason` | string | required when `deprecated: true` | Why the rule is retired |
| `replacedBy` | string | optional | Rule id that supersedes this one; must exist in the knowledge base and cannot be self-referential |
| `match` | object | yes | See matching model below |
| `summary` | string | yes | One-line symptom description |
| `explanation` | string | optional | Longer context |
| `actions` | string[] | yes | At least one safe next step |
| `links` | object[] | optional | `type` is `github_issue`, `docs`, or `other`; `url` must be http(s); optional `label` |
| `tags` | string[] | optional | Must be non-empty strings without duplicates (bundled rules require tags) |
| `i18n` | object | optional | Locale keys (`zh-CN`) with `title`, `summary`, `explanation`, `actions`; bundled rules require complete `zh-CN` |

## Matching model

`match` requires at least one signal: `any`, `all`, or `doctor`.

- `any`: array of text matchers; one hit is enough.
- `all`: array of text matchers; every hit must occur inside the same evidence document (one doctor check, or the attached log).
- `doctor`: structural constraint with `checkIds`, `categories`, and/or `statuses`; at least one of `checkIds`/`categories` is required. When present, text signals and status must come from the same check.

Each text matcher must specify exactly one of:

- `contains`: literal substring, case-insensitive, at most 1000 characters;
- `regex`: JavaScript regular expression, at most 512 characters, compiled at load time, flags limited to unique `i`, `m`, `s`, `u`. Patterns that look like catastrophic backtracking (an ambiguous group followed by an unbounded quantifier, e.g. `(a+)+`) are rejected.
- optional `weight`: integer 1..80 that biases the confidence score.

Matched evidence paths are reported so every diagnosis points at the exact field that triggered it. Remediation text is never used as diagnostic evidence.

## Version expressions

`codexVersions` entries follow `(\d+|\*)\.(\d+|\*)\.(\d+|\*)` with an optional comparator prefix `>=`, `>`, `<=`, `<`, or `=`:

- `0.144.*` — any patch release of 0.144;
- `1.*.*` — any 1.x release;
- `>=0.129.0` — 0.129.0 or newer; comparators cannot contain wildcards;
- `=1.2.3` — exactly 1.2.3.

Expressions are OR-combined. A rule is skipped when the reported Codex version satisfies none of the expressions, and also when the analysis has no version evidence (for example `explain` on raw text). Use `0.144.*` for minor-scoped compatibility instead of paired comparators.

## Loader guarantees

At load time the loader rejects duplicate rule ids, unknown `replacedBy` references, malformed regexes, catastrophic-backtracking regexes, non-http(s) URLs, duplicate matchers, ambiguous matchers, empty doctor constraints, and rules without a diagnostic signal. `tests/rule-fixtures.test.mjs` additionally proves every bundled rule against a positive fixture, a near-miss negative fixture, and a cross-platform negative fixture.
