---
"@caatinga/cli": patch
---

fix: unblock `caatinga init` installs on pnpm 10.26+/11.x

The `react-vite-counter` template pinned `@creit.tech/xbull-wallet-connect` to a GitHub URL and relied on `stellar-wallets-kit@0.0.7`, which itself depends on the same package via a GitHub URL. pnpm 10.26+ (and 11.x) defaults `blockExoticSubdeps` to `true`, which refused to install that exotic subdep (`ERR_PNPM_EXOTIC_SUBDEP`).

The template now resolves the direct dependency from the published npm version (`^0.4.0`, same commit hash) and ships a `pnpm-workspace.yaml` that opts this single transitive dep out of the supply-chain check, since the kit is unpublished from npm and cannot be substituted.
