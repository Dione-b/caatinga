---
"@caatinga/core": minor
"@caatinga/zk": minor
"@caatinga/cli": minor
---

**The ZK verifier can be upgraded in place.** The verifier scaffold (`ctg zk init`, `zk-starter`) now has `__constructor(admin: Address)`, `admin()` and an admin-gated `upgrade(new_wasm_hash)`, and its config entry passes the deploying identity as admin with `deployArgs: { admin: "${source.address}" }`. Enabling embedded VK is now `ctg zk build --embed-vk` → `ctg build verifier` → `ctg upgrade verifier --source <admin>`, keeping the `contractId`; `verify_proof` and `verify_proof_embedded` are unchanged.

`ctg zk init` in an existing project adds the admin deploy arg to a `verifier` entry that points at `./contracts/verifier` and has no `deployArgs`. The `zk-starter` template gains a `caatinga:upgrade` script.

Compatibility: the verifier now requires a constructor argument, so deploying it needs `--source` (already required for deploy). Verifiers scaffolded before this release have no `upgrade` entrypoint; they need one `ctg deploy verifier --upgrade` after adopting the new contract code, and `ctg upgrade` afterwards. Rollback: remove the `deployArgs` entry and the constructor/`upgrade` functions to return to the previous, non-upgradeable verifier.
