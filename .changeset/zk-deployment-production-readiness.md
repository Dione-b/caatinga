---
"@caatinga/zk": minor
"@caatinga/cli": minor
"@caatinga/core": minor
---

ZK deployment is now production-ready: audited ceremony artifacts can be imported, the embedded verification key path works end to end, and several guardrails report actionable errors instead of raw snarkjs stderr.

**New: `ctg zk import-ceremony <circuit> --ceremony <path>`** (breaking the mainnet dead end). Point it at an external MPC ceremony's `circuit_final.zkey` + `verification_key.json`; Caatinga copies them in, records `type: "mpc-multi-party"` in `ceremony.json`, and lifts the mainnet dev-ceremony block for that circuit. The artifacts are validated against the compiled circuit by public-signal count, so a key from a different circuit fails with `CAATINGA_ZK_CEREMONY_INCOMPATIBLE` instead of an unexplained on-chain verification failure. `ctg zk build` now **reuses** imported artifacts rather than overwriting them with a fresh dev ceremony.

**New: `ctg estimate verify <circuit>`** (advisory). Reports the CPU/memory budget for on-chain proof verification against the reference network limits and warns as the budget approaches them. With `--network`, the protocol pre-flight runs first.

**New: ZK protocol pre-flight.** `ctg deploy <verifier>` and `ctg zk invoke` check the target network's protocol version via Soroban RPC `getNetwork` before building a transaction, failing with `CAATINGA_ZK_PROTOCOL_VERSION_UNSUPPORTED` when it is below 27 (the verifier is built with `soroban-sdk` 27, whose wasm declares protocol 27). `ctg doctor` reports each network's protocol version as an advisory.

**Embedded VK works end to end.** `ctg zk build --embed-vk` generates `contracts/verifier/src/vk.rs` and the verifier scaffold gains a `verify_proof_embedded` entrypoint, so `ctg zk invoke <circuit> --embed-vk` now works. This is an in-place `ctg upgrade` on an already-deployed verifier — `verify_proof` stays in the contract, so existing dynamic-VK integrations keep working. The CLI rejects `--embed-vk` invokes while `vk.rs` is still the scaffold placeholder (`CAATINGA_ZK_EMBED_VK_UNSUPPORTED`).

**`ctg zk build --network <name>`.** The mainnet dev-ceremony guard now checks the network the artifacts are meant for instead of only `defaultNetwork`, so a testnet default no longer hides a later mainnet deploy. Defaults to `defaultNetwork`; an unknown name fails with `CAATINGA_NETWORK_NOT_FOUND`.

**`zk-starter` ships a `mainnet` network**, matching `react-vite-counter`, so `ctg deploy verifier --network mainnet` no longer fails with network-not-found in a fresh project.

**Better input errors.** A malformed `circuits/input.json` (for example the multiplier scaffold's derived output `c`) is now reported as `CAATINGA_ZK_INPUT_CONTAINS_PUBLIC_SIGNALS`, naming the offending signal and how to fix it, instead of leaving the user to read raw snarkjs stderr.

**ZK drift in `ctg status`.** Reports whether a circuit has been built, its ceremony type, and whether the circuit sources or `input.json` changed since the last prove/import. Additive to the existing output and `--json` payload; `--strict` still guards binding freshness only.

**Checksum mismatches are actionable.** A `circom` binary failing its pinned SHA-256 now reports the pinned version, the download URL, and the GitHub release page, and points at the file holding the pin. It still never auto-retries.

New error codes (public API, additive): `CAATINGA_ZK_PROTOCOL_VERSION_UNSUPPORTED`, `CAATINGA_ZK_INPUT_CONTAINS_PUBLIC_SIGNALS`, `CAATINGA_ZK_EMBED_VK_UNSUPPORTED`, `CAATINGA_ZK_CEREMONY_INCOMPATIBLE`. `ctg zk invoke --embed-vk` no longer reports `CAATINGA_INVALID_CONFIG`.

Add `scripts/zk-testnet-smoke.sh` (opt-in, spends testnet XLM) and the `zk-smoke` CI job in `.github/workflows/testnet-smoke.yml`, triggered via `workflow_dispatch` with `zk: true`.

Also fixes: the verification-key reader accepted only the legacy `vk_ic` spelling and now handles the `IC`/`nPublic` shape snarkjs actually exports; `snarkjs r1cs info` output was parsed with a non-existent `# of Public Signals` label, which made import validation always fail. A dry-run run-through of the full loop surfaced three more issues, all fixed: `ctg zk prove` now translates snarkjs stderr into `CAATINGA_ZK_INPUT_CONTAINS_PUBLIC_SIGNALS` instead of dumping raw stderr; `ctg zk build` no longer warns about a single-party dev ceremony when it reused imported MPC artifacts; and `ctg status` now reports `vk-changed` when the verification key swapped under a proof (for example after `ctg zk import-ceremony`), so a stale proof can't reach the verifier silently.

CLI test isolation: `zk-guardrails`, `deploy`, and `estimate` tests no longer remove the shared `.artifacts/zk` tree while the suite runs in parallel, which surfaced as flaky `ENOTEMPTY` failures.
