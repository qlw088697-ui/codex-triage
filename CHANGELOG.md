# Changelog

All notable changes to this project are documented here.

## [1.2.0] - 2026-08-30

### Added

- New rule `mcp-server-path-unresolvable` (openai/codex#26132): doctor's `mcp.config` check reports a configured MCP server whose executable path cannot be resolved, including the WSL Windows-path case.
- Contributor tooling: `scripts/validate-rule.mjs` validates a single rule file (JSON or YAML) without running the full suite.

### Fixed

- `faq` no longer surfaces deprecated rules, matching the matcher's semantics.

## [1.1.0] - 2026-08-30

### Added

- Dependency-free YAML subset parser for knowledge rules: block mappings and sequences, compact `- key: value` items, flow collections, quoted and plain scalars, and comments. Anchors, aliases, tags, directives, and multi-line block scalars are rejected with clear errors. JSON remains fully supported and is tried first.
- Documentation updated to describe the accepted YAML subset.

## [1.0.0] - 2026-08-30

### Added

- Frozen rule schema contract ([docs/rule-schema.md](docs/rule-schema.md)): additive-only within 1.x, with a `schemaVersion` generation field validated at load time; all 22 bundled rules declare it explicitly.
- Frozen public API surface, enforced by a contract test (`tests/api-surface.test.mjs`).
- JSON output contract documented in [docs/json-output.md](docs/json-output.md).
- First version-constrained rule `wsl-stream-disconnected` (openai/codex#24511): WSL stream disconnections on Codex 0.129.0+, matched only inside its version range.
- Governance: [GOVERNANCE.md](GOVERNANCE.md) (review standards, release and contract decisions) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

### Changed

- Coverage gates remain in force; the fixture suite now synthesizes version evidence for version-constrained rules.

## [0.3.0] - 2026-08-30

### Added

- `codex-triage faq [query]`: deterministic offline search over rule titles, tags, summaries, and explanations in English and zh-CN; an empty query lists the whole knowledge base. Honors `--platform`, `--limit`, and `--json`.
- Duplicate-issue assistance: the Markdown report gains a "Before filing a new issue" section collecting known upstream issues from matched rules (`owner/repo#N` links).
- Stable JSON envelope: every `--json` output now carries `mode` (`doctor`, `file`, `explain`, `faq`) alongside `schemaVersion` and `platform`.
- stdin input: `codex-triage -` reads a doctor report and `codex-triage explain -` reads raw error text from stdin.

## [0.2.0] - 2026-08-30

### Added

- Rule schema v2: `codexVersions` constraints, `lastVerified`, `source`, `deprecated` with `deprecationReason`, and `replacedBy` references validated at load time.
- `codex-triage explain "<error>"` matches raw error text without a file.
- Per-rule regression fixtures: every bundled rule is verified against a synthesized positive, a near-miss negative, and a cross-platform negative.
- Coverage threshold gate (80% lines, 70% branches), credential-shaped secret scan, and pack-install smoke test, wired into CI.
- npm publish workflow with provenance, gated on releases and an npm environment.

### Security

- Reject catastrophic-backtracking regexes at rule load time.

## [0.1.1] - 2026-08-30

### Security

- Recursively redact nested JSON output and common credential formats.
- Redact user paths written with JSON-escaped separators (`C:\\Users\\…`, `\/home\/…`) and forward-slash variants.
- Prevent diagnostic text from escaping Markdown code fences.
- Sanitize terminal control sequences and restrict rule links to HTTP(S).

### Fixed

- Bind doctor constraints and text evidence to the same check.
- Exclude remediation and issue remedy text from diagnostic evidence.
- Reject malformed regexes, ambiguous matchers, empty rules, and invalid CLI options.
- Add a timeout and explicit error states for automatic `codex doctor` execution.
- Correct Chinese locale aliases, platform selection, zero match limits, and dynamic package version output.
- Correct knowledge-validation CI paths.

### Changed

- Add evidence paths and deterministic confidence scoring.
- Add public package exports and real Node.js types.
- Add reproducible dependency locking, cross-platform CI, release metadata, and expanded documentation.
- Expand the regression suite from 8 tests to comprehensive unit and CLI integration coverage.

## [0.1.0]

- Initial doctor parser, matcher, knowledge rules, redaction, terminal output, and Markdown reporting.
