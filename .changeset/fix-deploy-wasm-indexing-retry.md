---
"@caatinga/core": patch
"@caatinga/cli": patch
---

Retry `deploy` when the RPC has not yet indexed the just-uploaded WASM.

`stellar contract deploy` uploads and instantiates in one command, and the instantiation
step can simulate against an RPC that has not indexed the new hash yet, failing with
`Error(Storage, MissingValue)` / `"Wasm does not exist"` for a hash that is on chain. Deploy
already had transient-failure retry with backoff, but this diagnostic matched none of its
patterns, so a timing-dependent infrastructure hiccup surfaced as a hard
`CAATINGA_DEPLOY_FAILED`. The match is narrow — a bare `MissingValue` or "simulation failed"
stays non-retryable.

The retry notice no longer calls this a "testnet" error, since it applies to any network.
