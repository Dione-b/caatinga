# CLI UX Audit (Sprint 45 — pre-v1.0)

Final review checklist before v1.0 contract freeze. Compare live `--help` output against [cli.md](./cli.md).

## Global

- [x] `caatinga --help` groups commands by domain
- [x] `caatinga version` prints `@caatinga/cli@<version>` and Node.js version
- [x] Exit codes: `0` success, `1` failure (all commands)
- [x] Errors use `[CAATINGA_*]` prefix via `formatCaatingaError`

## Flag consistency

| Flag | Commands using it | Consistent? |
|------|-------------------|-------------|
| `--network` | deploy, upgrade, generate, invoke, read, doctor, smoke, … | Yes |
| `--source` | deploy, upgrade, invoke, wire, setup | Yes |
| `--force` | deploy, upgrade | Yes |
| `-v, --version` | global | Yes |

## Command review

| Command | Help clear | Examples in docs | Notes |
|---------|------------|------------------|-------|
| init | ✓ | ✓ | |
| setup | ✓ | ✓ | |
| build | ✓ | ✓ | |
| deploy | ✓ | ✓ | Transient retry messages documented |
| upgrade | ✓ | ✓ | |
| rollback | ✓ | ✓ | |
| generate | ✓ | ✓ | |
| invoke | ✓ | ✓ | |
| read | ✓ | ✓ | |
| doctor | ✓ | ✓ | |
| migrate | ✓ | ✓ | |
| version | ✓ | ✓ | Added Sprint 38 |
| smoke | ✓ | ✓ | |
| wire | ✓ | ✓ | |
| sync-env | ✓ | ✓ | |
| estimate | ✓ | ✓ | |
| inspect | ✓ | ✓ | |
| status | ✓ | ✓ | |
| ci / regression | ✓ | ✓ | CI-oriented |

## Gaps found

None blocking v1.0 RC. Re-run `pnpm docs:check` after CLI changes.

## Sign-off

- Audit date: 2026-07-06
- Auditor: platform hardening sprint
- Result: **Pass** — ready for RC pending testnet smoke evidence
