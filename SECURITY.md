# Security Policy

## Supported versions

Security fixes are applied to the latest released minor version.

## Reporting a vulnerability

Please use GitHub private vulnerability reporting for this repository when available. Do not include live credentials, private logs, private repository names, or personal information in a public issue.

Include a minimal sanitized reproduction, affected version, platform, expected behavior, and impact. Maintainers should acknowledge a report before any public disclosure timeline is agreed.

## Project security boundaries

`codex-triage` is diagnostic software. It does not automatically modify Codex state, permissions, firewall policy, endpoint protection, or sandbox settings. Generated reports use best-effort redaction and must still be reviewed before publication.

## Release publishing security

Releases ship through npm Trusted Publishing (OIDC) with no long-lived credentials:

- The `publish` workflow authenticates with a short-lived GitHub Actions OIDC token (`id-token: write`); no npm token secret exists in this repository.
- The npm package pins the trusted publisher to `qlw088697-ui/codex-triage`, the workflow file `publish.yml`, and the `npm` environment.
- The `npm` GitHub environment only accepts deployments from the `main` branch and `v*` tags; other branches, pull requests, and forks cannot publish.
- Workflow actions are pinned to commit SHAs, and checkouts run with `persist-credentials: false`, so publish jobs hold no repository credentials.
- Every published version carries a signed provenance statement recorded in the Sigstore transparency log.

