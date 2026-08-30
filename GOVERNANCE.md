# Governance

## Roles

- **Users** — anyone running codex-triage. They open issues, follow report guidance, and may propose rules.
- **Contributors** — anyone with a merged PR. They are listed in the release notes of the release that includes their change.
- **Maintainers** — reviewers with commit access. They review rule proposals against the safety bar, manage releases, and decide schema changes. Maintainers are added by consensus of the existing maintainers after a track record of quality contributions.

## Decision making

- Rule additions and fixes: reviewed by at least one maintainer. The review checks the evidence bar (public upstream source), the safety bar (no destructive remediation), and the schema contract ([docs/rule-schema.md](docs/rule-schema.md)).
- Engine (TypeScript) changes: reviewed by at least one maintainer; changes touching redaction, matching, or the CLI contract require two maintainers.
- Schema or output contract changes: require two maintainers and must be accompanied by a compatibility note in the changelog. Within a major release the contract is additive-only ([docs/json-output.md](docs/json-output.md)).
- Releases: cut by a maintainer from a green CI run. The changelog must be updated in the same PR that bumps the version.

## Rule review standards

1. A public upstream issue or documentation URL backs every signature.
2. No rule recommends destructive remediation as an automatic first step.
3. zh-CN localization is complete (title, summary, actions).
4. The bundled fixture tests must pass for the new rule (positive, near-miss, and cross-platform where applicable).

## Conflict resolution

Contributors and maintainers discuss in issues and PRs. When a decision stalls, maintainers vote; a simple majority of maintainers decides. The outcome is recorded in the issue.

## Removal of maintainers

A maintainer may step down at any time. A maintainer who is unresponsive for twelve months may be removed by consensus of the remaining maintainers.
