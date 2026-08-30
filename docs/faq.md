# FAQ

## Does codex-triage send my data anywhere?

No. Everything runs locally: the doctor report, logs, and rule matching never leave your machine. The only network access is `codex doctor` itself, which is Codex's own command. Generated reports are written to disk and stay there until you share them.

## Is codex-triage affiliated with OpenAI?

No. It is an independent community project. It reads the output of `codex doctor` and matches it against signatures contributed from public upstream issues.

## How does matching work? Can it misdiagnose?

Rules declare structured doctor constraints and/or text signals. A rule only fires when its evidence is found - and doctor-bound rules require the status and text to come from the same check. Generic advice text (remediation) never triggers a diagnosis.

It can still misfire: a text signal may appear in an unrelated context. That is why every match carries evidence paths (exactly which field matched) and why confidence is a deterministic evidence score, not a probability. Treat matches as leads, not verdicts.

## Why did I get zero matches for a real problem?

The knowledge base covers reported, evidenced failures - not everything. Zero matches means "no known signature". Re-run with `--log <file>` so text rules can see raw errors, search the knowledge base with `faq <keywords>`, and consider proposing a rule for your signature.

## Why are rules written in JSON inside .yml files?

Historical: v0.1 parsed rules with `JSON.parse` to stay dependency-free. Since v1.1 a built-in YAML-subset parser accepts real block-style YAML too, still with zero runtime dependencies. Both shapes work; see [rule-schema.md](rule-schema.md).

## Which platforms are supported?

Rules cover Windows, macOS, Linux, and WSL, tagged per rule. The CLI itself runs anywhere Node.js 20+ runs. CI tests Windows, Ubuntu, and macOS.

## How do I add a rule?

See [contributing-rules.md](contributing-rules.md) for authoring guidance and [rule-schema.md](rule-schema.md) for the frozen v1 schema. In short: write a JSON or YAML rule with a distinctive signature, zh-CN and ja localization, and a public upstream source, then validate with `node scripts/validate-rule.mjs <file>` and open a PR. The fixture suite must pass for the new rule.

## Why is 2FA-bypass publishing used for releases?

The publish workflow runs unattended in CI, where an interactive 2FA prompt is impossible, so the release token bypasses 2FA by design. npm is restricting this token type (direct publishing from January 2027); the roadmap is to move release publishing to an account with proper 2FA before then.

## Can codex-triage fix problems automatically?

No, by design. It diagnoses and suggests; it never deletes state, edits configs, changes permissions, or disables security features. Automatic repair is intentionally out of scope.

## Does it use AI or an LLM?

No. Matching is deterministic: signatures, evidence extraction, and weighted scoring - all inspectable and reproducible. No network calls, no model inference.
