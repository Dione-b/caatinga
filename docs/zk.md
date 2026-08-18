# Zero-Knowledge Module

Caatinga ships a ZK workflow for **BLS12-381 Groth16** proofs verified on Soroban via the
official `groth16_verifier` pattern.

## Curve choice

| Choice                  | Why                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| **BLS12-381 + Groth16** | Matches Stellar Protocol 25+ host functions and `stellar/soroban-examples/groth16_verifier`. |
| **Not BN254**           | EVM-centric; Soroban does not expose BN254 pairing precompiles today.                        |

## Requirements

- **Protocol 25+** on the target network (testnet/mainnet must be at Protocol 25 before deploy).
- **Verifier contract:** `soroban-sdk = "25.1.0"`, Rust `1.89.0`.
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

| Command                                   | Purpose                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `ctg zk init [project]`                   | Scaffold `zk-starter` (multiplier circuit + verifier).                   |
| `ctg zk init [project] --minimal`         | Scaffold a ZK-only project with a minimal identity circuit and verifier. |
| `ctg zk init [project] --template <name>` | Use a specific template instead of the default `zk-starter`.             |
| `ctg zk init [project] --force`           | Overwrite existing scaffold files.                                       |
| `ctg zk build [circuit]`                  | Compile Circom (`-p bls12381`) and run dev trusted setup.                |
| `ctg zk build [circuit] --embed-vk`       | **Experimental:** emit `contracts/verifier/src/vk.rs` (not end-to-end).  |
| `ctg zk prove [circuit]`                  | Generate `proof.json` and `public.json` from `input.json`.               |
| `ctg zk prove [circuit] --debug`          | Emit intermediate `witness.wtns` for debugging.                          |
| `ctg zk invoke [circuit]`                 | Serialize snarkjs output and call `verify_proof` on-chain (dynamic VK).  |
| `ctg zk invoke [circuit] --embed-vk`      | **Blocked** — experimental; use dynamic VK flow today.                   |

Artifacts land in `.artifacts/zk/<circuit>/`.

## Minimal scaffold vs template

See [ZK project tutorial](./tutorials/zk-project.md#template-vs-minimal) for the comparison table.

## Browser + CLI hybrid (`zk-starter`)

See [ZK project tutorial](./tutorials/zk-project.md) for the hybrid UI + CLI prove flow.

## Circuit inputs

`circuits/input.json` must contain **private signals only**. Do not include public outputs —
for the multiplier scaffold, use `a` and `b` but not `c`. Snarkjs derives public signals during
proving and writes them to `.artifacts/zk/<circuit>/public.json`.

If you include a public output in `input.json`, `ctg zk prove` fails with a witness error
(for example `Too many values for input signal c`).

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

## Dynamic VK vs embedded VK

| Mode                     | When to use                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| **Dynamic VK** (default) | VK passed as a contract argument; flexible across circuit changes.                               |
| **`--embed-vk`**         | **Experimental** — writes `vk.rs` only; `zk invoke --embed-vk` is blocked until E2E is complete. |

Embedded VK is opt-in and visible in your repo — never a hidden dependency.

### Experimental: `--embed-vk` (not end-to-end)

`ctg zk build --embed-vk` writes `contracts/verifier/src/vk.rs` with real BLS12-381
coordinates from `verification_key.json`. Re-run the same command after circuit changes to
regenerate the file.

The default `zk-starter` verifier scaffold still expects a dynamic VK argument. **`ctg zk invoke --embed-vk` is blocked** until an embedded-VK entrypoint exists in the contract.
Use the default dynamic VK flow for end-to-end verification today.

## Production guardrails

`ctg zk build` always records a **single-party development ceremony**
(`.artifacts/zk/<circuit>/ceremony.json`). Suitable for local testing only — production
requires an external MPC powers-of-tau ceremony and audited circuit artifacts.

Caatinga **blocks mainnet** operations that would use those artifacts:

| Command                 | Guardrail                                                                      |
| ----------------------- | ------------------------------------------------------------------------------ |
| `ctg zk build`          | Fails when `defaultNetwork` is `mainnet` (ceremony is always dev single-party) |
| `ctg deploy <verifier>` | Fails on `mainnet` when dev ceremony artifacts exist for linked circuits       |
| `ctg zk invoke`         | Fails on `mainnet` when dev ceremony artifacts exist                           |

Pass `--allow-dev-ceremony` only for conscious testing — not for production deployments.
The CLI surfaces `CAATINGA_ZK_DEV_CEREMONY_BLOCKED` when a guardrail trips.

## Cost reference

From the reference `groth16_verifier` budget report (one public input):

- ~**41M CPU** insn for a single public signal
- ~**+2.46M CPU** per additional public input
- ~**294 KB** memory for pairing

Run `env.cost_estimate().budget().print()` in contract tests for your circuit shape.

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
        verifierContract: "verifier", // optional: contract name for on-chain verification
      },
    },
  },
});
```

Only `bls12381` is accepted today; other curves fail config validation. `verifierContract` is optional — when omitted, `zk invoke` targets the default verifier.

## Phase note

The `zk-starter` verifier scaffold compiles against the reference contract shape. End-to-end proof
verification on a live network should be validated after `zk build` + `zk prove` + `zk invoke` on
Protocol 25+ testnet.
