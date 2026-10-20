---
"@caatinga/core": minor
"@caatinga/client": minor
---

Classify common Soroban simulation failures and add opt-in archived-state restoration to `invoke()`.

New public error codes (additive): `CAATINGA_SIMULATION_ACCOUNT_NOT_FOUND`, `CAATINGA_SIMULATION_RESOURCE_LIMIT` and `CAATINGA_SIMULATION_ENTRY_ARCHIVED`. They are matched against strings Soroban RPC, stellar-core and stellar-sdk actually emit (for example `Error(Budget, ExceededLimit)`, `txNO_ACCOUNT`, `ENTRY_ARCHIVED`, stellar-sdk's ExpiredStateError) and a non-null `restorePreamble`, in `read()` / `simulate()` (including errors thrown by the binding's `result` getter) and in `invoke()` (including errors raised inside `signAndSend`).

`invoke(method, args, { restore: true })` lets a compatible generated binding submit a RestoreFootprint transaction first, signed by the connected wallet after the wallet network check. Custom binding adapters receive the binding options as `methodOptions`.

**Compatibility:** these failures previously surfaced as `CAATINGA_XDR_PREPARE_FAILED` (prepare/simulate), `CAATINGA_XDR_SUBMIT_FAILED` (invoke) or the raw SDK error (`read()` getter, method construction). Callers that branch on those codes for these cases now receive the new codes. Other errors keep their previous codes; errors thrown while the binding builds the method that are not simulation failures still propagate unchanged. `restore` is a new invoke option key, so a single-argument object whose only key is `restore` is now read as options. Rollback: revert this change; no persisted data or artifacts are affected.
