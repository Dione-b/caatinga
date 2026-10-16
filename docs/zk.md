# Zero-Knowledge Module

Caatinga ships a ZK workflow for **BLS12-381 Groth16** proofs verified on Soroban via the
official `groth16_verifier` pattern.

## Curve choice

| Choice                  | Why                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BLS12-381 + Groth16** | Uses the BLS12-381 host functions (Protocol 22, CAP-0059) and follows `stellar/soroban-examples/groth16_verifier`.                                                                                                              |
| **BN254: out of scope** | A Caatinga scope decision, not a network limitation: Soroban has BN254 host functions since Protocol 25 (CAP-0074), extended in Protocol 26 (CAP-0080). Caatinga ships one curve end to end; BN254 is not on the roadmap today. |

## Support matrix

| Item                                                       | Status                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Circom + snarkjs + Groth16 + BLS12-381                     | Supported                                                               |
| Dynamic VK (`verify_proof`)                                | Supported (default)                                                     |
| Embedded VK (`verify_proof_embedded`, `--embed-vk`)        | Supported — see [Dynamic VK vs embedded VK](#dynamic-vk-vs-embedded-vk) |
| MPC ceremony import (`ctg zk import-ceremony`)             | Supported; running the ceremony itself is out of scope                  |
| Offline ceremony verification and full artifact provenance | Planned                                                                 |
| BN254                                                      | Out of scope                                                            |
| Noir / UltraHonk, zkVMs                                    | Not supported                                                           |
| Automatic Circom install                                   | Linux and macOS; on Windows, put `circom` on `PATH` manually            |

## Requirements

- **Protocol 27+** on the target network. BLS12-381 itself only needs Protocol 22, but the verifier is built with `soroban-sdk` 27, and a contract built with SDK major N declares protocol N in its wasm: a network below that rejects the upload. The [protocol pre-flight](#protocol-pre-flight) checks this before any transaction is built.
- **Verifier contract:** `soroban-sdk = "27.0.6"`, Rust `1.91.1`.
- **Tooling:** Circom 2 and snarkjs (installed on first use into `~/.caatinga/zk-tools`). The first `ctg zk build` prints download and setup progress in the terminal (circom binary, snarkjs cache, dev powers-of-tau). Every `circom` binary — freshly downloaded or read from cache — is verified against a pinned SHA-256 before use; a mismatch deletes the file and raises `ZK_CHECKSUM_MISMATCH` instead of running an unverified binary (see [errors reference](./errors.md)).

## Quick start

```bash
npx ctg zk init my-zk-dapp
cd my-zk-dapp && npm install
npx ctg zk build main
npx ctg build verifier
npx ctg deploy verifier --network testnet --source alice
npx ctg zk prove main
npx ctg zk invoke main --network testnet --source alice
```

Walkthrough: [ZK project](./tutorials/zk-project.md). Command loop: [Cheatsheet — ZK loop](./cheatsheet.md#zk-loop).

## Commands

| Command                                              | Purpose                                                                                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctg zk init [project]`                              | Scaffold `zk-starter` (multiplier circuit + verifier).                                                                                                     |
| `ctg zk init [project] --minimal`                    | Scaffold a ZK-only project with a minimal identity circuit and verifier.                                                                                   |
| `ctg zk init [project] --template <name>`            | Use a specific template instead of the default `zk-starter`.                                                                                               |
| `ctg zk init [project] --force`                      | Overwrite existing scaffold files.                                                                                                                         |
| `ctg zk build [circuit]`                             | Compile Circom (`-p bls12381`) and run dev trusted setup. Imported ceremony artifacts are reused when present.                                             |
| `ctg zk build [circuit] -n, --network <name>`        | Network the artifacts are meant for (defaults to `defaultNetwork`); the mainnet guardrail checks this network.                                             |
| `ctg zk build [circuit] --embed-vk`                  | Also emit `contracts/verifier/src/vk.rs`, enabling the `verify_proof_embedded` entrypoint.                                                                 |
| `ctg zk build [circuit] --allow-dev-ceremony`        | Allow dev-ceremony artifacts on mainnet (not for production).                                                                                              |
| `ctg zk import-ceremony [circuit] --ceremony <path>` | Replace dev artifacts with an external MPC ceremony's `circuit_final.zkey` + `verification_key.json`.                                                      |
| `ctg zk prove [circuit]`                             | Generate `proof.json` and `public.json` from `input.json`.                                                                                                 |
| `ctg zk prove [circuit] --debug`                     | Emit intermediate `witness.wtns` for debugging.                                                                                                            |
| `ctg zk invoke [circuit] --source <id>`              | Serialize snarkjs output and call `verify_proof` on-chain (dynamic VK). `--source` is required; also `-n, --network`, `-y, --yes`, `--allow-dev-ceremony`. |
| `ctg zk invoke [circuit] --embed-vk`                 | Call `verify_proof_embedded` instead, using the VK baked into the contract. Requires `ctg zk build <circuit> --embed-vk` and a redeploy.                   |

Artifacts land in `.artifacts/zk/<circuit>/`. `ctg estimate verify <circuit>` reports the
CPU/memory budget before you deploy.

## Minimal scaffold vs template

See [ZK project tutorial](./tutorials/zk-project.md#template-vs-minimal) for the comparison table.

## Browser + CLI hybrid (`zk-starter`)

See [ZK project tutorial](./tutorials/zk-project.md) for the hybrid UI + CLI prove flow.

## Circuit inputs

`circuits/input.json` must contain the circuit's **input signals only**. Do not include
derived outputs — for the multiplier scaffold, use `a` and `b` but not `c`. Snarkjs derives
public signals during proving and writes them to `.artifacts/zk/<circuit>/public.json`.

If you include a derived output in `input.json`, `ctg zk prove` fails with a witness error
(`Too many values for input signal c`). Caatinga rewrites that failure as
`CAATINGA_ZK_INPUT_CONTAINS_PUBLIC_SIGNALS` with a hint naming the offending signal, so the
fix is obvious rather than a guess from raw snarkjs stderr.

## Drift detection

`ctg status` reports ZK drift alongside contract and binding status:

- whether the circuit has been built, and the recorded ceremony type
- whether the circuit sources changed since an imported ceremony
- whether `input.json` changed since the last `ctg zk prove`

```bash
npx ctg status
npx ctg status --json
```

ZK drift never affects `ctg status --strict`: that flag guards binding freshness only, so
widening it would silently change existing CI outcomes.

## Build artifacts

After `ctg zk build`, Circom emits WASM under:

```text
.artifacts/zk/<circuit>/main_js/main.wasm
```

The CLI resolves this path automatically during `ctg zk prove`; you do not configure it
in `caatinga.config.ts`.

## Library API (`@caatinga/zk`)

### Serialization (Node)

```ts
import { serializeProof, serializeVk, serializePublicSignals } from "@caatinga/zk";
```

### Full workflow (Node)

```ts
import {
  buildCircuit, // compile Circom circuit
  proveCircuit, // generate proof from input.json
  invokeVerifier, // call verify_proof on-chain
  buildStellarVerifyProofArgs, // build args for browser read/simulate
  ptauSizeForConstraints, // determine powers-of-tau file size
} from "@caatinga/zk";
```

### Browser subpath

```ts
import {
  buildVerifyProofBindingArgs, // build args for browser verify_proof read
  concatG1Bytes, // concatenate G1 point bytes
  concatG2Bytes, // concatenate G2 point bytes
} from "@caatinga/zk/browser";
```

### Types

| Type                        | Source                 | Purpose                             |
| --------------------------- | ---------------------- | ----------------------------------- |
| `SnarkjsProof`              | `@caatinga/zk`         | snarkjs JSON proof shape            |
| `SnarkjsVk`                 | `@caatinga/zk`         | snarkjs JSON verification key shape |
| `SerializedProof`           | `@caatinga/zk`         | Byte-serialized proof for Soroban   |
| `SerializedVk`              | `@caatinga/zk`         | Byte-serialized VK for Soroban      |
| `BuildCircuitOptions`       | `@caatinga/zk`         | Options for `buildCircuit()`        |
| `ProveCircuitOptions`       | `@caatinga/zk`         | Options for `proveCircuit()`        |
| `InvokeVerifierOptions`     | `@caatinga/zk`         | Options for `invokeVerifier()`      |
| `InvokeVerifierResult`      | `@caatinga/zk`         | Result of `invokeVerifier()`        |
| `SerializedG1`              | `@caatinga/zk/browser` | Byte-serialized G1 point            |
| `SerializedG2`              | `@caatinga/zk/browser` | Byte-serialized G2 point            |
| `VerifyProofBindingArgs`    | `@caatinga/zk/browser` | Args for browser binding read       |
| `VerifyProofBindingBuffers` | `@caatinga/zk/browser` | Raw buffer form of binding args     |

### Error handling

`ZkError` is thrown by ZK library functions with a `code` property:

| Code                      | Meaning                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `ZK_VK_REQUIRED`          | Verification key is required but not provided                                             |
| `ZK_INVOKE_FAILED`        | On-chain verification call failed                                                         |
| `ZK_VERIFY_FAILED`        | On-chain verifier returned `false` (maps to `CAATINGA_ZK_VERIFICATION_FAILED` in the CLI) |
| `ZK_DEV_CEREMONY_BLOCKED` | Mainnet blocked for dev-ceremony artifacts (maps to `CAATINGA_ZK_DEV_CEREMONY_BLOCKED`)   |
| `ZK_UNSUPPORTED_PLATFORM` | Operation not supported on current platform                                               |
| `ZK_DOWNLOAD_FAILED`      | Downloading a ZK tool (Circom/snarkjs) failed                                             |
| `ZK_CHECKSUM_MISMATCH`    | A downloaded ZK tool did not match its pinned checksum                                    |

## Dynamic VK vs embedded VK

| Mode                     | When to use                                                                     |
| ------------------------ | ------------------------------------------------------------------------------- |
| **Dynamic VK** (default) | VK passed as a contract argument; flexible while the circuit is still changing. |
| **`--embed-vk`**         | VK baked into the contract as `vk.rs`; use once the circuit is frozen.          |

Embedded VK is opt-in and visible in your repo — never a hidden dependency.

Both entrypoints live in the verifier scaffold, so enabling one does not remove the other:

| Entrypoint              | Arguments                    | Use with                             |
| ----------------------- | ---------------------------- | ------------------------------------ |
| `verify_proof`          | `vk`, `proof`, `pub_signals` | dynamic VK                           |
| `verify_proof_embedded` | `proof`, `pub_signals`       | `ctg zk invoke <circuit> --embed-vk` |

### Embedded VK (`--embed-vk`)

`ctg zk build --embed-vk` writes `contracts/verifier/src/vk.rs` with real BLS12-381
coordinates from `verification_key.json`, and the verifier gains a
`verify_proof_embedded` entrypoint. Re-run the command after circuit changes to regenerate
the file — the CLI rejects `--embed-vk` invokes while `vk.rs` is still the scaffold
placeholder or absent (`CAATINGA_ZK_EMBED_VK_UNSUPPORTED`).

Enable it on an already-deployed verifier with an in-place upgrade, which keeps the existing
`contractId`:

```bash
npx ctg zk build main --embed-vk
npx ctg build verifier
npx ctg upgrade verifier --network testnet --source alice
npx ctg zk invoke main --embed-vk --network testnet --source alice
```

Because `verify_proof` remains in the contract, dApps already calling the dynamic-VK
entrypoint keep working after the upgrade.

> **Upgrade vs redeploy are different operations.** `ctg upgrade` swaps the WASM in place and
> keeps the `contractId`; `ctg deploy --upgrade` creates a **new** instance with a new
> `contractId`. Enabling embedded VK is an in-place upgrade — do not redeploy unless you
> actually want a new verifier address.

## Production guardrails

`ctg zk build` runs a **single-party development ceremony** unless audited ceremony
artifacts have already been imported, and records the type in
`.artifacts/zk/<circuit>/ceremony.json` (`dev-single-party` or `mpc-multi-party`).
A dev ceremony is suitable for local testing only — production requires an external MPC
ceremony and audited circuit artifacts.

Caatinga **blocks mainnet** operations that would use dev-ceremony artifacts:

| Command                 | Guardrail                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ctg zk build`          | Fails when the target network (`--network`, else `defaultNetwork`) is `mainnet` and no imported ceremony artifacts exist |
| `ctg deploy <verifier>` | Fails on `mainnet` when dev ceremony artifacts exist for linked circuits                                                 |
| `ctg zk invoke`         | Fails on `mainnet` when dev ceremony artifacts exist                                                                     |

### Importing an audited ceremony

`ctg zk import-ceremony` replaces dev artifacts with the output of an external ceremony and
lifts the mainnet block for that circuit:

```bash
npx ctg zk build main
npx ctg zk import-ceremony main --ceremony /path/to/ceremony-output
```

Point `--ceremony` at a directory holding `circuit_final.zkey` and `verification_key.json`
(as produced by `snarkjs zkey export verificationkey`). The command copies those artifacts,
records `mpc-multi-party` in the manifest, and verifies the artifacts match the compiled
circuit by comparing the public-signal count — a mismatch fails with
`CAATINGA_ZK_CEREMONY_INCOMPATIBLE` instead of an unexplained on-chain verification failure.

After an import, `ctg zk build` **reuses** the imported artifacts instead of running a new
dev ceremony, so a rebuild cannot silently demote a production build.

Pass `--allow-dev-ceremony` only for conscious testing — not for production deployments.
The CLI surfaces `CAATINGA_ZK_DEV_CEREMONY_BLOCKED` when a guardrail trips.

## Cost reference

From the reference `groth16_verifier` budget report (one public input):

- ~**41M CPU** insn for a single public signal
- ~**+2.46M CPU** per additional public input
- ~**294 KB** memory for pairing

Run `env.cost_estimate().budget().print()` in contract tests for your circuit shape, or use
`ctg estimate verify <circuit>` for a pre-flight budget against the reference limits.

## Config (`caatinga.config.ts`)

```ts
export default defineConfig({
  // ...
  zk: {
    circuits: {
      main: {
        path: "./circuits",
        protocol: "groth16",
        curve: "bls12381",
        verifierContract: "verifier", // contract name used by `ctg zk invoke`
      },
    },
  },
});
```

Only `bls12381` is accepted today; other curves fail config validation. `verifierContract` is optional in the schema, but `ctg zk invoke` requires it: without it the command fails with `Verifier contract not configured for circuit "<name>"`.

## Protocol pre-flight

`ctg deploy <verifier>` and `ctg zk invoke` check the target network's protocol version via
Soroban RPC `getNetwork` before building a transaction. The minimum is protocol 27: the
verifier wasm is built with `soroban-sdk` 27 and declares that protocol, so an older network
would reject it. A network below that fails with `CAATINGA_ZK_PROTOCOL_VERSION_UNSUPPORTED`.
The minimum follows the pinned SDK major; a test keeps the two in sync.

The check is advisory in `ctg doctor`, which prints each configured network's protocol
version without ever making the run fail.

## Phase note

The `zk-starter` verifier scaffold compiles against the reference contract shape and is
validated end-to-end on a live network by `scripts/zk-testnet-smoke.sh` (opt-in — run it
manually, or trigger the `zk-smoke` job in `.github/workflows/testnet-smoke.yml` with
`workflow_dispatch` and `zk: true`).
