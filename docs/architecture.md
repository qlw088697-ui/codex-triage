# Architecture

`codex-triage` is a local, diagnostic-only CLI with two layers:

- **engine:** TypeScript for doctor parsing, evidence extraction, matching, scoring, redaction, offline search, and rendering;
- **knowledge:** JSON-compatible YAML signatures maintained by contributors.

## Data flow

```text
codex doctor --json / saved report / log / stdin / explain text / faq query
                         |
                         v
               size and schema validation
                         |
                         v
             local best-effort redaction
                         |
                         v
          per-check evidence document creation
                         |
                         v
        rule validation, matching, ranking, or search
                         |
                         v
       final recursive output redaction boundary
                         |
              terminal / JSON / Markdown
```

## Modes

- **doctor / file:** parse a doctor report (auto-run, file, or stdin via `-`), match structured and text rules against per-check evidence.
- **explain:** treat raw error text (argument or stdin via `-`) as one log evidence document; no doctor constraints can apply.
- **faq:** deterministic token search over rule titles, tags, summaries, and explanations in English and the requested locale; no doctor constraint needed; scoped by platform.

## Evidence isolation

Structured rules first select eligible doctor checks using `checkIds`, categories, statuses, and platform. Text matchers then run only against the same selected check. Evidence fields include summary, details, notes, and issue observations. Remediation and issue remedy fields are excluded because suggested actions are not proof of a cause.

For text-only rules, an attached log is one evidence document and each doctor check is another. An `all` group must be satisfied inside one document.

## Trust boundaries

- Input reports and logs are untrusted and size-limited.
- Bundled and custom knowledge rules are validated before matching.
- Regexes are compiled at load time and restricted to deterministic flags and bounded length.
- Rule links are restricted to HTTP(S).
- Every output format receives final redaction.
- The engine never mutates Codex configuration or operating-system state.

## Public API

The package exports parser, loader, matcher, search, redaction, and report-rendering functions through `dist/index.js`. The JSON CLI format is a stable envelope (`schemaVersion`, `mode`, `platform`, plus mode-specific fields); the rule schema is frozen as documented in docs/rule-schema.md (additive-only within 1.x).
