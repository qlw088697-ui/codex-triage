# codex-triage

Community troubleshooting knowledge for OpenAI Codex.

`codex-triage` analyzes `codex doctor --json` output and optional Codex/app logs, matches them against community-maintained issue signatures, and produces safe next steps plus a shareable Markdown report.

> Community project. Not affiliated with or endorsed by OpenAI.

## Quick start

```bash
npm install
npm run build
node dist/cli.js
```

Or during development:

```bash
npm run dev -- fixtures/doctor/current-object.json --log fixtures/logs/windows-1312.txt
```

Once published to npm, the intended UX is:

```bash
npx codex-triage
```

By default the CLI runs:

```bash
codex doctor --json
```

then performs a second local redaction pass and matches the report against the YAML knowledge base.

## Examples

Analyze a saved doctor report:

```bash
codex-triage doctor.json
```

Add a Codex/Desktop log:

```bash
codex-triage doctor.json --log codex.log
```

Chinese terminal output:

```bash
codex-triage doctor.json --lang zh-CN
```

Generate a sanitized report:

```bash
codex-triage doctor.json --log codex.log --report

# custom path
codex-triage doctor.json --log codex.log --report --output my-report.md
```

Machine-readable output:

```bash
codex-triage doctor.json --json
```

## Example output

```text
Codex Triage
────────────────────────────────────────────────────────
Platform: windows
Codex: 0.148.0
Doctor: warning

Found 1 possible issue(s)

HIGH · Windows sandbox cannot spawn a process (error 1312)
Confidence: 65%

The Windows sandbox runner failed during process creation because the expected logon session was unavailable.

Suggested next steps:
  1. Verify that the failure happens even for a trivial command such as `Get-Location`.
  2. Save the current Codex version and doctor report before reinstalling or changing account policy.
  3. Check the upstream issue for current status and version-specific workarounds.
```

## Why this exists

`codex doctor` is intentionally diagnostic and read-mostly. It gives support tooling a structured, redacted report. `codex-triage` adds a community knowledge layer on top:

- what a distinctive error probably means;
- whether it resembles a known upstream issue;
- which safe checks to try next;
- whether the symptom looks local, environmental, or plausibly upstream;
- a sanitized report that can be reviewed before posting to GitHub.

The parser accepts the current keyed `checks` JSON shape and a legacy/fixture array shape so older captured reports remain useful.

## Knowledge, not hard-coded fixes

Troubleshooting rules live in YAML:

```text
knowledge/
├── auth/
├── config/
├── install/
├── mcp/
├── network/
├── sandbox/
├── search/
├── state/
└── wsl/
```

A rule is stored as JSON-compatible YAML (JSON syntax in a `.yml` file) in v0.1 so the runtime stays dependency-free. Example:

```json
id: windows-createprocess-error-1312
title: Windows sandbox cannot spawn a process (error 1312)
category: sandbox
severity: high
platforms:
  - windows
match:
  any:
    - contains: "CreateProcessAsUserW failed: 1312"
summary: >-
  The Windows sandbox runner failed during process creation because the expected logon session was unavailable.
actions:
  - Verify the failure with a trivial command.
  - Save the Codex version and doctor report.
links:
  - type: github_issue
    url: https://github.com/openai/codex/issues/31768
```

This lets contributors add knowledge without editing the matching engine.

## v0.1 knowledge coverage

The starter set includes 20 signatures across:

- missing/duplicate/mismatched Codex installations;
- unsupported `doctor --json` on older builds;
- config load failures;
- missing credentials and auth initialization failures;
- WSL `localhost:1455` OAuth callback problems;
- token exchange failures;
- provider/WebSocket/proxy/TLS/DNS connectivity;
- ripgrep/search verification failures;
- required MCP failures;
- Windows `CreateProcessAsUserW` errors 5 and 1312;
- missing Windows sandbox resources;
- missing `bwrap` in WSL mode;
- app-server handshake timeouts in WSL mode;
- state/SQLite integrity failures.

## Safety model

v0.1 is diagnostic only. It deliberately does **not**:

- delete Codex state;
- change Windows permissions or security policy;
- disable endpoint protection;
- modify firewall rules;
- bypass Codex sandboxing;
- automatically rewrite `config.toml`.

Potential future repair commands should default to `--dry-run` and require explicit user action.

## Privacy

The official doctor JSON is designed to be redacted for support use. `codex-triage` still applies another local best-effort pass because users may attach arbitrary logs.

No redactor can guarantee that every private value is removed. Review generated reports before publishing them.

`codex-triage` does not upload reports by default.

## Contributing a new issue signature

You usually do not need to write TypeScript.

1. Add `knowledge/<category>/<problem>.yml`.
2. Add a sanitized fixture under `fixtures/logs/` when possible.
3. Run `npm test` and `npm run build`.
4. Open a PR with the upstream issue link when one exists.

See [`docs/contributing-rules.md`](docs/contributing-rules.md).

## Development

Requirements: Node.js 20+.

```bash
npm install
npm test
npm run build
```

The runtime itself has zero npm dependencies. v0.1 knowledge files use JSON-compatible YAML (a valid YAML 1.2 subset), so troubleshooting does not depend on a YAML package being available.

## Roadmap

- **v0.1** — doctor parser, log matching, 20 rules, confidence score, EN/zh-CN output, Markdown report, redaction.
- **v0.2** — richer version constraints, rule fixtures, issue metadata refresh, improved platform detection.
- **v0.3** — `explain <error>`, duplicate-issue assistance, offline FAQ/search.
- **v1.0** — stable rule schema, broader platform coverage, community maintainers.

## Upstream references

- OpenAI Codex: https://github.com/openai/codex
- Current doctor implementation: https://github.com/openai/codex/blob/main/codex-rs/cli/src/doctor.rs

## License

MIT
