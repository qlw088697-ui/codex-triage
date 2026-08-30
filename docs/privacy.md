# Privacy

`codex-triage` runs locally and does not upload reports by default.

## Redaction boundary

The CLI applies redaction before matching attached text and again at every output boundary. Recursive JSON redaction covers nested doctor details, notes, issues, and remediation. Markdown and terminal renderers receive sanitized values, and the final Markdown document is redacted once more.

The current redactor recognizes common:

- OpenAI, GitHub, GitLab, npm, Slack, AWS, bearer, basic-auth, and JWT credentials;
- token, password, secret, and API-key assignments;
- credentials embedded in HTTP(S) URLs;
- Windows, macOS, and Linux user home paths;
- email addresses.

Redaction is best effort, not a guarantee. Private hostnames, unusual token formats, repository names, IP addresses, or business data may remain. Review reports before sharing.

## Data minimization

- Diagnostic text in Markdown is limited to 20,000 characters.
- Input files are limited to 16 MiB.
- No telemetry is collected.
- Reports are written only when `--report` is explicitly supplied.
- No output is automatically posted to GitHub or another service.

## Safe sharing checklist

1. Open the generated report locally.
2. Search for usernames, email addresses, tokens, private hostnames, and repository names.
3. Remove unrelated log sections.
4. Share only the minimum evidence required to reproduce the issue.
