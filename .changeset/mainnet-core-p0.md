---
"@caatinga/core": patch
"@caatinga/cli": patch
"@caatinga/zk": patch
---

Mainnet fixes from the readiness audit:

- **Mainnet commands use the configured RPC** (#224). Configs matching the well-known mainnet network were passed to the Stellar CLI as `--network mainnet`, whose built-in entry has no RPC URL ("Bring Your Own"), so `read`, `invoke`, `deploy`, `upgrade` and friends failed on mainnet or silently used a locally added network. Mainnet now always gets explicit `--rpc-url` / `--network-passphrase` from `caatinga.config.ts`. Testnet keeps the `--network testnet` shorthand.
- **No implicit `alice` on mainnet** (#226). `ctg read` and `ctg smoke` no longer fall back to the built-in `alice` identity on mainnet (by name or passphrase); pass `--source` or set `CAATINGA_SOURCE`, otherwise `CAATINGA_SOURCE_ACCOUNT_REQUIRED` is raised. `describeCliSource` / `resolveCliSource` accept an optional `{ network }`.
- **ZK dev-ceremony block detects mainnet by passphrase** (#228). `ctg zk build`, `ctg zk invoke` and verifier `ctg deploy` now block single-party dev-ceremony artifacts on a mainnet network with a custom name (e.g. `pubnet`). `isProductionNetwork` and `assertDevCeremonyAllowed` accept an optional network config.
