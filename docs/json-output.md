# JSON output contract (v1, stable)

Starting with codex-triage 1.0 the `--json` output is a stable envelope. Within the 1.x series fields are only added; existing fields never change shape or meaning, and breaking changes require a major release with a `schemaVersion` bump.

## Envelope

```json
{
  "schemaVersion": 1,
  "mode": "doctor",
  "platform": "windows"
}
```

- `schemaVersion`: `1` for the current envelope generation.
- `mode`: one of `doctor` (automatic `codex doctor --json` execution), `file` (a saved report or stdin via `-`), `explain` (raw error text or stdin via `explain -`), `faq` (offline knowledge search).
- `platform`: resolved platform — `windows`, `macos`, `linux`, or `wsl`.

## Diagnostics modes (`doctor`, `file`, `explain`)

```json
{
  "report": { "schemaVersion": 1, "generatedAt": "…", "overallStatus": "warning", "codexVersion": "0.144.5", "checks": [] },
  "matches": [
    {
      "rule": { "id": "…", "title": "…", "severity": "…", "category": "…", "actions": [], "links": [] },
      "confidence": 65,
      "reasons": ["matched contains:… at doctor.check[…].summary"],
      "evidence": [{ "source": "doctor", "path": "doctor.check[…].summary", "signal": "contains:…", "weight": 65 }],
      "checkId": "network.websocket_reachability"
    }
  ]
}
```

- `report`: present when a valid doctor report was available; absent for `explain`.
- `matches`: sorted by confidence then severity. `evidence[].path` names the exact field that produced the signal; `checkId` names the bound doctor check when applicable.
- All string content has passed the redaction boundary.

## FAQ mode (`faq`)

```json
{
  "query": "websocket",
  "results": [
    { "id": "websocket-unreachable", "title": "…", "severity": "medium", "category": "network", "score": 23, "summary": "…", "tags": [], "links": [] }
  ]
}
```

`query` is the trimmed search text (empty for list mode). `results` are sorted by score, then category and id, and truncated by `--limit` (default 5, `0` yields no results).

## Exit codes

- `0` — analysis completed (including zero matches and empty FAQ results).
- `1` — invalid arguments, invalid input, or internal failure.
- `2` — automatic `codex doctor` execution ran but did not return a valid report.
