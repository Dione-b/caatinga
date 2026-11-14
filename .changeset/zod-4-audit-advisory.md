---
"@caatinga/core": patch
"@caatinga/client": patch
"@caatinga/cli": patch
---

**`npm audit` is clean again after `ctg init`.** A new high-severity advisory covers every `zod` release below 4.6.6 ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)) and has no fix on the 3.x line. `@caatinga/core` now depends on `zod@^4.6.6`, and the browser templates (`react-vite-counter`, `zk-starter`) ship a `zod: "^4.6.6"` install override for the copies pulled in through Stellar Wallets Kit (Reown AppKit, Coinbase CDP, `abitype`). `walletStubOverrides()` and `walletStubPnpmWorkspaceYaml()` return the same pin.

Existing projects: add `"zod": "^4.6.6"` to `overrides` in `package.json` (and to `overrides` in `pnpm-workspace.yaml` when using pnpm), then reinstall.

Config and artifact validation behave the same; the wording of some schema-validation hints follows zod 4 (for example a missing field is reported as `Invalid input: expected string, received undefined` instead of `Required`).
