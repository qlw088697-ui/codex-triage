# Changelog

All notable changes to this project are documented here.

## [1.20.0] - 2026-08-31

### Added

- Two more Windows sandbox rules with hard error signatures: `windows-apply-patch-helper-stall` (openai/codex#41492 - apply_patch stalls after one or two successful patches while reads and commands keep working) and `windows-sandbox-provision-helper-unknown` (openai/codex#41715 - provisioning fails before any command with helper_unknown_error; doctor's CrowdStrike/EDR flag is the strongest documented correlation).

### Changed

- `windows-sandbox-helper-missing` now also matches `orchestrator_helper_launch_failed` and documents openai/codex#41411: Repair, Reset, auto-update, and a Windows restart were all verified insufficient, so capture logs instead of reinstalling repeatedly. Knowledge base: 57 rules across 12 categories.

## [1.19.0] - 2026-08-30

### Added

- Japanese (`--lang ja`) as a full third locale: all 55 bundled rules now carry complete ja title/summary/explanation/actions, the terminal and FAQ renderers speak Japanese, and `faq` search indexes ja titles (kana-aware tokenization). Locale aliases `ja`/`ja-JP` normalize to `ja`; rule-level i18n falls back to English per field, so custom rules without translations still render under `--lang ja`. The knowledge-base contract test now enforces zh-CN and ja completeness, and `scripts/rule-new.mjs` scaffolds ja stubs alongside zh-CN.

## [1.18.0] - 2026-08-30

### Added

- `desktop-workspace-permission-profile` (openai/codex#40801): Desktop chats fail with the ":workspace" PermissionProfileSelectionParams type error and GPT-5.6 vanishes from the picker; Store update, app-data reset, and config checks all verified insufficient in the report.

### Changed

- `auth-usage-limit-reached` now covers the GPT-5.6 Sol quota-burn cluster (openai/codex#41518/#41468/#41330): a single turn on Sol High/Max consuming 60-100% of a 5-hour Plus window, with guidance to compare burned quota against actual output before assuming a metering bug. Knowledge base: 55 rules across 12 categories.

## [1.17.0] - 2026-08-30

### Added

- Server-side catalog family for GPT-5.6, three rules: `provider-context-window-clamp` (openai/codex#41325 - 1M config clamped to 872K/828,400 usable under ChatGPT auth, proven server-side via a rebuilt-binary experiment), `provider-sol-context-profile-flip` (openai/codex#40347 cluster - effective window flip-flops 828400/258400 mid-task as catalog refreshes switch profiles), and `provider-tool-arg-corruption-gibberish` (openai/codex#40369 - corrupted tool-call paths plus pseudo-language degeneration, persisted in rollout JSONL, not context-pressure related). Knowledge base: 54 rules across 12 categories.

## [1.16.0] - 2026-08-30

### Added

- Continued the gpt-5.6 tool-provisioning family with two rules: `sandbox-gpt56-readonly-no-tools` (openai/codex#31843 - GPT-5.6 sessions in the read-only sandbox receive no tool bundle; gpt-5.5 or workspace-write confirmed working) and a new **desktop** category with `desktop-code-mode-host-handshake` (openai/codex#40943 cluster - machine-specific Desktop handshake failure for GPT-5.6 tool execution; CLI confirmed working on the same machine). Knowledge base: 51 rules across 12 categories.

## [1.15.0] - 2026-08-30

### Added

- `provider-responses-lite-model-unsupported` from the ChatGPT-route Responses-Lite cluster (openai/codex#31150, #30403, #30238): with ChatGPT sign-in, gpt-5.5 is routed into a Responses-Lite transport that rejects it with 400 unsupported_value while gpt-5.4 works on the same account; actions cover the confirmed gpt-5.4 fallback and the client-side catalog suppression option. Knowledge base: 49 rules across 11 categories.

### Fixed

- Tightened `provider-chatgpt-only-tool-transport` to match the full "Responses-Lite only supports" error so the ChatGPT-route variant above no longer collides with the custom-provider rule.

## [1.14.0] - 2026-08-30

### Added

- Two more provider rules plus one informational rule from the custom-provider compatibility cluster: `provider-chatgpt-only-tool-transport` (openai/codex#31882, gpt-5.6 ChatGPT-backend transport flags rejected by Azure with the verified `model_catalog_json` override) and `provider-namespace-tool-routing` (openai/codex#32318, OpenRouter rejects native namespace tools before generation), plus `provider-model-metadata-fallback` for the "Defaulting to fallback metadata" warning. Knowledge base: 48 rules across 11 categories.

## [1.13.0] - 2026-08-30

### Added

- New provider category with `provider-azure-empty-functions-description` (openai/codex#37380): Codex 0.147.0+ serializes an empty functions namespace description that Azure Responses rejects; rule is version-constrained to >=0.147.0 with the pin-0.146.0 workaround. Knowledge base: 45 rules across 11 categories.
- `--codex-version <ver>` supplies version evidence for matching when the input carries none (e.g. raw `explain` text), so version-constrained rules can fire; the JSON envelope now includes the resolved `codexVersion`.

## [1.12.0] - 2026-08-30

### Added

- Community infrastructure: `scripts/rule-new.mjs` scaffolds a valid rule with every required field and zh-CN stubs; a "Wrong diagnosis" issue template collects false positives, false negatives, and wrong guidance with evidence paths; a pull-request template encodes the contribution checklist.

## [1.11.1] - 2026-08-30

### Added

- Documentation: [docs/triage-walkthrough.md](docs/triage-walkthrough.md) (end-to-end user guide) and [docs/faq.md](docs/faq.md).
- README now leads with npm installation (`npx codex-triage` / `npm install -g codex-triage`); source installation moved to a fallback section.

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
