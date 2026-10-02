---
"@caatinga/client": patch
---

`walletStubPnpmWorkspaceYaml()` now starts with `packages: []`, so a standalone app that writes its output to `pnpm-workspace.yaml` no longer fails `pnpm install` on pnpm 9 ("packages field missing or empty"). The helper output now matches the official templates' `pnpm-workspace.yaml` (#279).
