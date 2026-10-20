---
"@caatinga/core": patch
"@caatinga/zk": patch
"@caatinga/cli": patch
---

Fixes found by running the ZK flow end to end on testnet in fresh projects.

**`ctg upgrade` no longer fails on every new WASM.** `stellar contract upload` logs the transaction hash on stderr ("Signing transaction: <hash>") before printing the WASM hash on stdout. Caatinga read the first 64-hex token from the combined output, compared the transaction hash with the local WASM hash, and failed with `CAATINGA_UPLOAD_FAILED` even though the upload had succeeded. The WASM hash is now read from stdout (and `parseWasmHash` takes the last hash in mixed output).

**The embedded-VK flow is documented as it actually works.** Because the key is compiled into the contract, enabling `--embed-vk` needs new contract code on chain: `ctg upgrade verifier` for verifiers with the admin-gated `upgrade` entrypoint, or one `ctg deploy verifier --upgrade` (new `contractId`) for verifiers scaffolded without it. On a dev ceremony `ctg zk build` generates new keys, so `ctg zk prove` must run again; `ctg zk build` now says so. Docs, tutorial and cheatsheet are updated.

**Clear error for a stale on-chain verifier.** `ctg zk invoke --embed-vk` against a verifier deployed before `vk.rs` was generated now reports `CAATINGA_ZK_EMBED_VK_UNSUPPORTED` with a hint naming the missing step instead of a raw `UnreachableCodeReached` VM trap.

**`ctg status` no longer calls an imported ceremony "audited".** It shows `MPC (imported, verified <date>)` after `ctg zk verify-ceremony`, or `not verified` otherwise; the `--json` payload gains an additive `ceremonyVerifiedAt`.
