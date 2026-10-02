---
"@caatinga/core": patch
"@caatinga/cli": patch
---

Every `ctg` command now logs the resolved network and its origin up front (`Network: testnet (config)` when it came from `defaultNetwork`, `Network: mainnet (flag)` when passed via `--network`), so `--skip-deploy` runs and failed commands no longer hide which network they targeted (#244). An empty `--network ""` (for example `--network "$NET"` with `$NET` unset in CI) now fails with `CAATINGA_NETWORK_NOT_FOUND` instead of silently falling back to `defaultNetwork`. Template placeholder hints render the configured network, and the zk-starter placeholder bindings import was fixed so scaffolded projects type-check.
