# Contributing

The easiest contribution is a new troubleshooting rule; most rule contributions do not require TypeScript changes.

1. Scaffold a rule: `node scripts/rule-new.mjs <category> <rule-id> "<English title>"` creates `knowledge/<category>/<rule-id>.yml` with every required field and zh-CN stubs.
2. Add sanitized positive and near-miss negative fixtures when possible.
3. Add or update a focused test.
4. Run `npm ci`, `npm test`, and `npm pack --dry-run --json`.
5. Open a PR with a public upstream issue or documentation source when one exists.

Do not commit API keys, tokens, private repository names, usernames, email addresses, or unredacted home paths. Avoid destructive remediation. Prefer observation, verification, supported upgrades, and public upstream references.

See [docs/contributing-rules.md](docs/contributing-rules.md) for the rule contract and [docs/rule-schema.md](docs/rule-schema.md) for the stable v1 schema reference. Review standards and maintainer decision-making are described in [GOVERNANCE.md](GOVERNANCE.md); by participating you agree to the [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Knowledge-base maintenance

Run the citation freshness sweep periodically (and before rule-mining rounds):

```bash
GITHUB_TOKEN=... node scripts/check-citations.mjs          # report
GITHUB_TOKEN=... node scripts/check-citations.mjs --strict # fail if a PRIMARY source is closed as completed
```

Doctrine: a cited issue closing as **completed** is a review trigger, not an automatic deprecation. Rules are symptom-based - they keep matching real logs from users on older builds even after upstream fixes. The correct response is usually a fixed-upstream note in the explanation, a version bound (`codexVersions`) when the fix version is known, or deprecation only when the symptom can no longer occur anywhere. Issues closed as **not planned** leave the symptom unresolved; the rule stays and the action text should not point users at the dead issue.
