---
"@caatinga/core": patch
---

Fail-closed mainnet guardrail for `requireConfirmation`.

**B18:** `requireConfirmation: false` on mainnet silently disabled the
interactive prompt and the `[MAINNET GUARDRAIL]` warning on
`deploy` / `upgrade` / `invoke` / `wire` / `rollback`. A config copied
from testnet could therefore bypass the mainnet guardrail.

**Fix:**

- `requiresMainnetConfirmation` now unconditionally returns `true` on
  mainnet (by name or by canonical passphrase), ignoring
  `networkConfig.requireConfirmation`.
- Non-mainnet networks only require confirmation when
  `requireConfirmation: true` — otherwise the previous behavior is
  preserved.
- `@caatinga/core` deliberately does **not** consult
  `CAATINGA_ASSUME_YES`. The opt-out remains a CLI-layer concern: the CLI
  honours `--yes` / `CAATINGA_ASSUME_YES` and continues to emit the
  `[MAINNET GUARDRAIL]` audit log before skipping the interactive prompt.
  Handling the env var in core would make the CLI's check unreachable
  dead code and would suppress the audit log during CI runs.
