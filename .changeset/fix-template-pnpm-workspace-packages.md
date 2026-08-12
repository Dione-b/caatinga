---
"@caatinga/core": patch
---

Fix `pnpm install` failing in scaffolded projects on pnpm 9.

Both official templates shipped a settings-only `pnpm-workspace.yaml` (carrying `allowBuilds`
and `overrides` for pnpm 10+) with no `packages` field. pnpm 9 treats any directory holding
that file as a workspace root and aborts with `ERROR packages field missing or empty` — so
`pnpm install` and `pnpm exec` both failed in a freshly scaffolded project, and the weekly
`testnet-deploy-regression` workflow had been red since 2026-07-27 for the same reason.

Adding `packages: []` satisfies pnpm 9 and leaves pnpm 10/11 behaviour unchanged.
