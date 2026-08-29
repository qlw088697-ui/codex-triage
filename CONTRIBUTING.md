# Contributing

The easiest contribution is a new troubleshooting rule. You usually do not need to change TypeScript.

1. Add `knowledge/<category>/<problem>.yml`.
2. Add a sanitized fixture under `fixtures/logs/` when possible.
3. Run `npm test` and `npm run build`.
4. Avoid destructive remediation. Prefer observation, verification, upgrades, and upstream issue links.
5. Never commit API keys, tokens, private repository names, usernames, or unredacted home paths.

A rule should match a specific signature or doctor check. Generic advice without a reliable signal is better suited for documentation than the rule engine.
