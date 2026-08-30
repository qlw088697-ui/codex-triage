# Rule authoring

A useful rule answers four questions:

1. What exact observation identifies the problem?
2. Which doctor check and platforms are affected?
3. Which safe next steps distinguish likely causes?
4. Which public issue or document supports the guidance?

## File format

Since 1.1, rule files may use strict JSON or the supported YAML subset (block mappings and sequences, flow collections, quoted or plain scalars, comments). Anchors, aliases, tags, directives, and multi-line block scalars are rejected. Quote any plain scalar that contains `": "`. The loader tries JSON first and falls back to the YAML subset; run `npm test` to confirm a proposed rule parses and loads.

## Optional metadata (validated at load time)

- `codexVersions`: array of version expressions such as `0.144.*`, `>=0.145.0`, or `=1.2.3`. Expressions are OR-combined. A rule is skipped when the reported Codex version satisfies none of them, or when the analysis has no version evidence. Comparators (`>=`, `>`, `<=`, `<`) cannot use wildcards; use `0.144.*` for minor-scoped compatibility instead of range pairs.
- `lastVerified`: ISO date `YYYY-MM-DD` of the last human verification.
- `source`: public http(s) URL documenting the signature.
- `deprecated` plus a required `deprecationReason`, and an optional `replacedBy` rule id that must exist in the knowledge base. Deprecated rules are never matched.
- `platforms`: restricts a rule to `windows`, `macos`, `linux`, or `wsl`.

## Fixture tests

`tests/rule-fixtures.test.mjs` exercises every bundled rule against three synthesized cases: a positive fixture built from your own matchers, a near-miss negative fixture, and, when the rule is platform-scoped, a cross-platform negative fixture. If your rule uses a `regex` matcher, add one satisfying sample string to the `regexSamples` map in that test file; otherwise the suite fails with a clear message.

## Matching guidance

- Prefer an exact `contains` signature for distinctive errors.
- Use regex only for variable portions, keep it short, and avoid nested quantifiers; the loader rejects catastrophic-backtracking shapes such as `(a+)+`.
- Use `match.doctor.checkIds` when a stable check ID exists; category-only constraints are weaker.
- `any` means one signal is sufficient; `all` means every signal must occur in the same evidence document.
- Do not match generic advice from remediation text.
- Add at least one near-miss negative test to prevent false positives.
- Treat confidence as an evidence score, not proof of root cause.

## Safety guidance

Actions should be reversible and read-only where possible. Do not recommend deleting databases, lowering operating-system security, disabling endpoint protection, changing firewall policy, or bypassing sandboxing as an automatic first step.

Every rule must have tags and complete `zh-CN` title, summary, and actions. Links must use HTTP(S), and public upstream evidence is preferred.
