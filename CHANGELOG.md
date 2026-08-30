# Changelog

All notable changes to this project are documented here.

## [1.11.0] - 2026-08-30

### Added

- New usage category with `auth-usage-limit-reached` (openai/codex#12799, openai/codex#28908, openai/codex#32607): the usage-limit message with plan-confusion and known metering-bug guidance. Knowledge base: 44 rules.

## [1.10.0] - 2026-08-30

### Added

- New auth rule `auth-token-endpoint-403` (openai/codex#2414): OAuth token exchange blocked with 403 on the Windows + WSL callback path or by intercepting proxies.
- New macOS sandbox rules `sandbox-macos-ps-blocked` (openai/codex#4620) and `sandbox-macos-sourcekitd` (openai/codex#37430). Knowledge base: 43 rules.

## [1.9.0] - 2026-08-30

### Added

- New WSL rules: `wsl-state-database-damaged-on-mnt-c` (openai/codex#23251 - sharing Windows App state over /mnt/c corrupts the SQLite database; move CODEX_HOME to the native WSL filesystem) and `wsl-launcher-not-executable` (openai/codex#28074 - the WSL launcher binary loses its execute bit on fresh installs). Knowledge base: 38 rules.

## [1.8.0] - 2026-08-30

### Added

- New network rule `network-dns-resolution-failed` (openai/codex#12867, openai/codex#16782, openai/codex#18675, openai/codex#37063): DNS failures inside Codex with sandbox-vs-host triage.
- New install rule `update-stale-app-server` (openai/codex#23984, openai/codex#23001): doctor's app_server.status check after upgrades. Knowledge base: 38 rules.

## [1.7.0] - 2026-08-30

### Added

- New state rules for the two SQLite failure families: `state-db-locked` (openai/codex#28666, openai/codex#30105, openai/codex#20213, openai/codex#31426 - another Codex process holds the state_5.sqlite lock) and `state-db-malformed` (openai/codex#24030, openai/codex#30957, openai/codex#27363 - corrupted database, backup-first and let auto-recovery rebuild). Knowledge base: 36 rules.

## [1.6.0] - 2026-08-30

### Added

- New install rule `install-npm-eacces` (openai/codex#1480, openai/codex#21897, openai/codex#10342): npm global install or update fails with EACCES on root-owned prefixes.
- New macOS sandbox rules `sandbox-macos-sandbox-exec-missing` (openai/codex#591) and `sandbox-macos-network-access-ignored` (openai/codex#10390). Knowledge base: 34 rules.

## [1.5.0] - 2026-08-30

### Added

- New state rule `state-rollout-db-parity` (openai/codex#26132): doctor's rollout parity warning, with backup-first guidance.
- New search rule `search-rg-not-usable` (openai/codex#13542, openai/codex#22360): Windows ripgrep fallback to PowerShell search when a user-PATH rg.exe shadows the bundled binary.
- New MCP rules `mcp-login-no-auth-support` (openai/codex#34684) and `mcp-oauth-401-tools-list` (openai/codex#20009): the two most-reported MCP OAuth failure signatures. Knowledge base: 31 rules.

## [1.4.0] - 2026-08-30

### Added

- New config rules: `config-toml-parse-error` (openai/codex#19476, openai/codex#9770 - startup failure with the file/line/column signature, including the VSCode duplication and Windows backslash cases) and `config-service-tier-invalid` (openai/codex#27297 - macOS desktop update regression). Knowledge base: 27 rules.
- npm version badge in the README.

## [1.3.0] - 2026-08-30

### Added

- New auth rules: `auth-device-code-disabled` (openai/codex#9253 - headless login blocked by workspace policy) and `auth-401-stream-retry` (401 after retries means stale credentials, not rate limiting). The knowledge base now carries 25 rules.
- Release automation: the publish workflow now runs with a repository `NPM_TOKEN` secret, so a published GitHub release builds, verifies, and ships to npm with provenance.

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
