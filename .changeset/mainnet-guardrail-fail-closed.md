---
"@caatinga/core": patch
---

Fail-closed mainnet guardrail for `requireConfirmation`.

**B18:** `requireConfirmation: false` on mainnet silently disabled both the interactive prompt and the `[MAINNET GUARDRAIL]` warning on `deploy` / `upgrade` / `invoke` / `wire` / `rollback`. A config copied from testnet could therefore bypass the mainnet guardrail.

**Fix:**

- `requiresMainnetConfirmation` now always returns `true` on mainnet (by name or by canonical passphrase), regardless of `networkConfig.requireConfirmation`.
- The only way to skip the prompt on mainnet is to set `CAATINGA_ASSUME_YES` to a truthy value (`true`, `1`, `yes`, `y`, case-insensitive) — matching the existing CLI guardrail in `packages/cli/src/utils/mainnet-guardrails.ts`.
- Falsy values (`false`, `0`, `no`, empty string, whitespace) fail closed.
- Non-mainnet networks continue to honour `requireConfirmation` unchanged.
