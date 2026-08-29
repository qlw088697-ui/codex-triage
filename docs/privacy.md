# Privacy

`codex-triage` runs locally and does not upload reports by default.

The official `codex doctor --json` report is already designed for support use and redacts sensitive detail. `codex-triage` still applies another best-effort redaction pass because users may include additional logs.

No redactor is perfect. Always review generated Markdown before posting it publicly.
