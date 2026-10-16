---
"@caatinga/zk": minor
"@caatinga/cli": minor
"@caatinga/core": minor
---

Imported ZK ceremonies are now pinned and verifiable, and ZK verification cost is measured on a live network.

**Pinned ceremony artifacts.** `ctg zk import-ceremony` writes a version-2 `ceremony.json` recording the sha256 of the proving key, verification key, powers-of-tau, r1cs and wasm, plus provenance (`--source-url`, `--ceremony-name`, `--participants`, `--retrieved-at`). Mainnet `ctg deploy <verifier>` and `ctg zk invoke` re-hash the proving key, verification key and powers-of-tau and fail with the new `CAATINGA_ZK_CEREMONY_TAMPERED` if any changed since import. `--allow-dev-ceremony` does not waive this check, and an `mpc-multi-party` manifest without hashes is rejected too, so editing `ceremony.json` no longer lifts the mainnet block. **Compatibility:** an MPC manifest written by the earlier pre-release `import-ceremony` has no hashes and is rejected on mainnet until the ceremony is re-imported. Dev-ceremony manifests are unchanged.

**New: `ctg zk verify-ceremony [circuit]`.** An offline, reproducible check: it re-hashes the pinned artifacts, runs `snarkjs zkey verify <r1cs> <ptau> <zkey>` when a powers-of-tau was imported, and checks that `verification_key.json` is the key exported from the zkey. On success it stamps `verifiedAt` in the manifest.

**`ctg estimate verify` recalibrated against testnet.** The model was fitted to simulated `verify_proof` calls for 1 to 104 public signals: about 40.5M instructions plus 3.56M per public signal. The previous model under-estimated by up to 26%. The reference limits now match the network's `contract_compute_v0` settings on testnet and mainnet: 400M instructions and 40 MiB per transaction, up from 100M and 16 MiB. In practice, a circuit can expose about 100 public signals before verification exceeds the transaction limit.

**Live-network ZK checks.** `scripts/zk-testnet-smoke.sh` now also checks that the live verifier rejects an invalid proof, altered public inputs, a mismatched verification key and swapped G2 limbs. It checks that a tampered imported zkey is refused both by `verify-ceremony` and on mainnet before any transaction, and it records verification cost per public-signal count with the new `scripts/zk-verify-benchmark.mjs`. The `zk-smoke` job now runs weekly. It also fixes the `workflow_dispatch` condition, which compared the boolean `zk` input to a string and therefore never ran.

New error code (public API, additive): `CAATINGA_ZK_CEREMONY_TAMPERED`.
