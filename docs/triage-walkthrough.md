# Triage walkthrough

A step-by-step guide to diagnosing a broken Codex setup with codex-triage. All commands run locally; nothing leaves your machine.

## 1. Run the diagnosis

With Codex installed, the fastest start is the built-in doctor:

```bash
npx codex-triage
```

This runs `codex doctor --json` (15-second timeout), matches the report against the knowledge base, and prints the most likely issues with confidence scores and next steps.

If Codex is too broken to run doctor, feed triage what you have instead:

```bash
codex-triage explain "CreateProcessAsUserW failed: 1312" --platform windows
some-command 2>&1 | codex-triage explain -
codex-triage triage.log            # any text log; JSON is detected automatically
```

## 2. Read the output

Each match shows:

- **Severity** - high/medium/low, how disruptive the issue tends to be.
- **Confidence** - a deterministic evidence score, not a probability. It sums the weight of the matched signals.
- **Summary and actions** - what the signature means and the safe next steps.

JSON mode adds the exact evidence paths so you can see which field triggered the match:

```bash
codex-triage doctor.json --json
```

Every `evidence[].path` names the doctor check and field that produced the signal. If a match looks wrong, the evidence paths tell you why it fired - please include them in bug reports.

## 3. Add context when the first pass is empty

An empty result does not mean "nothing is wrong" - it means no signature matched. Broaden the evidence:

```bash
codex-triage doctor.json --log ~/.codex/log/codex-tui.log
```

Logs often contain the raw error strings that rules match on. Use `--platform windows|macos|linux|wsl` when the detection needs help, and `--limit` to see more or fewer matches.

## 4. Search the knowledge base

Not sure what you are looking at? Search the offline knowledge base directly:

```bash
codex-triage faq websocket
codex-triage faq 握手超时 --lang zh-CN
```

`faq` searches rule titles, tags, summaries, and explanations in English and zh-CN, and shows the upstream issues behind each entry.

## 5. Produce a shareable report

When you need help from humans (maintainers, colleagues, an AI assistant), generate a sanitized report:

```bash
codex-triage doctor.json --log codex.log --report
```

`codex-triage-report.md` contains the matches, evidence, doctor checks, and log excerpt - all through the redaction boundary. It also lists known upstream issues so you can check for duplicates before filing. **Review it before posting**: no redactor is perfect.

## 6. File or fix

- If a known upstream issue matches, react there instead of filing a duplicate.
- If nothing matches and you have a new error signature, propose a rule - see [contributing-rules.md](contributing-rules.md). Validate it quickly with `node scripts/validate-rule.mjs <file>`.
- If triage itself misbehaves, open an issue with the sanitized report attached.

## Exit codes

- `0` - analysis completed (including zero matches).
- `1` - invalid arguments, invalid input, or internal failure.
- `2` - automatic `codex doctor` ran but did not return a valid report.
