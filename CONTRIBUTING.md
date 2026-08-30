# Contributing

The easiest contribution is a new troubleshooting rule; most rule contributions do not require TypeScript changes.

1. Add a JSON-syntax rule under `knowledge/<category>/<problem>.yml`.
2. Add sanitized positive and near-miss negative fixtures when possible.
3. Add or update a focused test.
4. Run `npm ci`, `npm test`, and `npm pack --dry-run --json`.
5. Open a PR with a public upstream issue or documentation source when one exists.

Do not commit API keys, tokens, private repository names, usernames, email addresses, or unredacted home paths. Avoid destructive remediation. Prefer observation, verification, supported upgrades, and public upstream references.

See [docs/contributing-rules.md](docs/contributing-rules.md) for the rule contract and [docs/rule-schema.md](docs/rule-schema.md) for the stable v1 schema reference. Review standards and maintainer decision-making are described in [GOVERNANCE.md](GOVERNANCE.md); by participating you agree to the [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
