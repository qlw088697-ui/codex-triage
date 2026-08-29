# Architecture

`codex-triage` is intentionally split into two layers:

- **engine**: stable TypeScript for parsing, matching, scoring, redaction, and rendering.
- **knowledge**: YAML signatures maintained by contributors.

The CLI accepts the machine-readable output from `codex doctor --json`, plus optional logs. It normalizes doctor reports, performs a second redaction pass, evaluates the knowledge rules, ranks matches by confidence, and renders a local terminal or Markdown report.

The v0.1 engine is diagnostic only. It does not mutate Codex configuration, delete state, change permissions, or alter firewall/sandbox settings.
