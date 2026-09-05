# codex-triage

[![npm version](https://img.shields.io/npm/v/codex-triage.svg)](https://www.npmjs.com/package/codex-triage)
[![test](https://github.com/qlw088697-ui/codex-triage/actions/workflows/test.yml/badge.svg)](https://github.com/qlw088697-ui/codex-triage/actions/workflows/test.yml)

Local, community-maintained troubleshooting knowledge for OpenAI Codex.

**Status:** v1.0.0 · Node.js 20+ · MIT

`codex-triage` analyzes `codex doctor --json` output and optional Codex/app logs, matches them against reviewed issue signatures, and produces safe troubleshooting guidance or a sanitized Markdown/JSON report.

> Community project. Not affiliated with or endorsed by OpenAI.

## Design goals

- Local and offline after installation; no report upload by default.
- Diagnostic only; no automatic deletion, permission changes, firewall edits, or sandbox bypasses.
- Evidence-based matches tied to one doctor check rather than unrelated text from the full report.
- Community rules separated from the TypeScript matching engine.
- Zero runtime npm dependencies.

## What it helps with

- Windows, macOS, Linux, and WSL environment problems
- sandbox and process creation failures
- authentication and token exchange errors
- network, proxy, TLS, DNS, and WebSocket failures
- MCP server failures
- installation and PATH conflicts
- Codex state and SQLite integrity problems

## Install

Requirements: Node.js 20 or newer.

Run without installing:

```bash
npx codex-triage
```

Or install globally:

```bash
npm install -g codex-triage
codex-triage --help
```

### Install from source

```bash
git clone https://github.com/qlw088697-ui/codex-triage.git
cd codex-triage
npm ci
npm run build
node dist/cli.js --help
```

On Windows PowerShell, if execution policy blocks `npm.ps1`, use `npm.cmd` without lowering system security settings:

```powershell
npm.cmd ci
npm.cmd run build
node dist\cli.js --help
```

GitHub dependency installation is supported through the package `prepare` script. Published tarballs are rebuilt and tested by `prepack`.

## Usage

With no positional input, the CLI runs `codex doctor --json` with a 15-second timeout:

```bash
codex-triage
```

Analyze a saved doctor report and optionally add a log:

```bash
codex-triage doctor.json
codex-triage doctor.json --log codex.log
```

Chinese output and explicit platform selection:

```bash
codex-triage doctor.json --lang zh-CN --platform wsl
```

Match a raw error without a file, or pipe one in:

```bash
codex-triage explain "CreateProcessAsUserW failed: 1312" --platform windows
some-command-that-fails | codex-triage explain -
codex doctor --json | codex-triage -
```

Version-constrained rules need version evidence. Doctor and file modes take it from the report; with `explain`, pass it when you know the Codex version:

```bash
codex-triage explain "Invalid 'input[0].tools[0].description': empty string" --codex-version 0.147.0
```

Search the bundled knowledge offline before asking anywhere:

```bash
codex-triage faq websocket
codex-triage faq 握手超时 --lang zh-CN --platform wsl
```

With no query, `faq` lists every rule in the knowledge base. Results honor `--platform`, `--limit`, and `--category`, and Chinese and Japanese queries match zh-CN and ja titles and summaries.

Generate a sanitized Markdown report:

```bash
codex-triage doctor.json --log codex.log --report
codex-triage doctor.json --report --output my-report.md
```

Generate sanitized machine-readable output:

```bash
codex-triage doctor.json --json
```

JSON output is a stable envelope: `schemaVersion`, `mode` (`doctor`, `file`, `explain`, or `faq`), `platform`, and then mode-specific fields (`report` + `matches` for diagnostics, `query` + `results` for `faq`). Exit codes: `0` success, `1` invalid arguments/input, `2` automatic `codex doctor` did not produce a valid report.

Important options:

```text
--log <path>             Add a Codex/app log
--report                 Write a Markdown report
--output <path>          Report output path; requires --report
--json                   Emit sanitized JSON
--lang <locale>          en, zh-CN, or ja
--platform <platform>    windows, macos, linux, or wsl
--knowledge <path>       Custom rule directory
--limit <n>              Maximum matches/entries, 0..100
--category <name>        faq only: restrict results to one rule category
--doctor-timeout <ms>    1000..120000
--codex-version <ver>    Version evidence for matching when the input has none
--version                Print package version
```

## Matching model

Rules with a structured doctor constraint are evaluated against each eligible doctor check independently. Their text signals and doctor status must come from the same check. Generic remediation text and issue remedy text are intentionally excluded from diagnostic evidence so suggested fixes cannot trigger diagnoses.

Text-only rules can analyze an attached log or one doctor check at a time. Required `all` signals cannot be assembled from unrelated checks. JSON output includes evidence paths explaining where each signal was found.

Confidence scores are deterministic evidence scores, not statistical probabilities.

## Knowledge rules

Files under `knowledge/` may be strict JSON or the supported YAML subset, saved with `.yml`, `.yaml`, or `.json` extensions. The dependency-free parser accepts block mappings and sequences, flow collections, and comments; anchors, aliases, tags, directives, and multi-line block scalars are rejected at load time.

Minimal valid rule:

```json
{
  "id": "windows-createprocess-error-1312",
  "title": "Windows sandbox cannot spawn a process (error 1312)",
  "category": "sandbox",
  "severity": "high",
  "platforms": ["windows"],
  "match": {
    "any": [
      { "contains": "CreateProcessAsUserW failed: 1312" }
    ]
  },
  "summary": "The Windows sandbox runner could not create a process.",
  "actions": [
    "Verify the failure with a trivial command."
  ],
  "links": [
    {
      "type": "github_issue",
      "url": "https://github.com/openai/codex/issues/31768"
    }
  ],
  "tags": ["windows", "sandbox"],
  "i18n": {
    "zh-CN": {
      "title": "Windows Sandbox 无法创建进程（错误 1312）",
      "summary": "Windows sandbox runner 无法创建进程。",
      "actions": ["先用最简单命令复现问题。"]
    }
  }
}
```

The loader rejects malformed regexes, catastrophic-backtracking regexes, unsafe URL protocols, duplicate matchers, empty doctor constraints, and rules without a diagnostic signal.

Optional rule metadata (validated at load time):

- `codexVersions`: expressions such as `0.144.*`, `>=0.145.0`, or `=1.2.3`. Expressions are OR-combined; a rule is skipped when the reported Codex version satisfies none, or when no version evidence exists. Comparators cannot use wildcards.
- `lastVerified`: ISO date (`YYYY-MM-DD`) of the last human verification of the rule.
- `source`: public http(s) URL documenting the signature.
- `deprecated` with a required `deprecationReason`, plus an optional `replacedBy` rule id that must exist. Deprecated rules are never matched.

Every bundled rule is exercised by a synthesized positive fixture, a near-miss negative fixture, and, when platform-scoped, a cross-platform negative fixture (`tests/rule-fixtures.test.mjs`).

The full rule contract is frozen in [docs/rule-schema.md](docs/rule-schema.md), and the JSON output contract in [docs/json-output.md](docs/json-output.md). See [docs/contributing-rules.md](docs/contributing-rules.md) before proposing a rule.

## Privacy and safety

Terminal, Markdown, and JSON output all pass through the same final local redaction boundary. The redactor covers common API keys, access tokens, Authorization headers, URL credentials, email addresses, and user home paths. Markdown diagnostic blocks use dynamically sized fences so log content cannot close the block.

No redactor can guarantee removal of every private value. Always review a generated report before publishing it.

New here? Follow [docs/triage-walkthrough.md](docs/triage-walkthrough.md) for a full walkthrough, or check [docs/faq.md](docs/faq.md).  
See also [docs/privacy.md](docs/privacy.md) and [SECURITY.md](SECURITY.md).

## Development

```bash
npm ci
npm test
npm run coverage:check
npm run scan:secrets
npm run pack:smoke
npm pack --dry-run --json
```

CI runs the test suite on Windows, Ubuntu, and macOS with supported Node.js release lines, enforces coverage thresholds (80% lines, 70% branches), scans first-party files for credential-shaped values, and installs the packed tarball before every release. Runtime behavior has no third-party npm dependency.

## Roadmap

- **v0.1.x:** privacy boundary, evidence-scoped matching, strict rule validation, cross-platform CI. (shipped)
- **v0.2:** version constraints, `lastVerified`/`source`/deprecation metadata, per-rule positive and negative fixtures, coverage thresholds, secret scanning, pack smoke test. (shipped)
- **v0.3:** `explain <error>`, offline FAQ search, duplicate-issue assistance, stable JSON envelope, publish workflow. (shipped)
- **v1.0:** frozen rule schema and public API, governance files, first version-constrained rule. (shipped)
- **v1.1:** dependency-free YAML subset parsing for knowledge rules. (shipped)
- **v1.2:** `mcp-server-path-unresolvable` rule, single-rule validator for contributors. (shipped)
- **v1.3:** auth rules for headless login and 401 stream retries, automated npm publishing via GitHub releases. (shipped)
- **Beyond 1.0:** broader rule coverage through the community process, additional locales.

Automatic destructive repair and default telemetry are intentionally outside the roadmap.

## Upstream references

- OpenAI Codex: https://github.com/openai/codex
- Codex doctor implementation: https://github.com/openai/codex/blob/main/codex-rs/cli/src/doctor.rs

## License

MIT
