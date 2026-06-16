# Zero-Knowledge Module

Caatinga ships a ZK workflow for **BLS12-381 Groth16** proofs verified on Soroban via the
official `groth16_verifier` pattern.

## Curve choice

| Choice | Why |
| --- | --- |
| **BLS12-381 + Groth16** | Matches Stellar Protocol 25+ host functions and `stellar/soroban-examples/groth16_verifier`. |
| **Not BN254** | EVM-centric; Soroban does not expose BN254 pairing precompiles today. |

## Requirements

- **Protocol 25+** on the target network (testnet/mainnet must be at Protocol 25 before deploy).
- **Verifier contract:** `soroban-sdk = "25.1.0"`, Rust `1.89.0`.
- **Tooling:** Circom 2 and snarkjs (installed on first use into `~/.caatinga/zk-tools`).

## Quick start

```bash
# New ZK project with the example multiplier template
caatinga zk init my-zk-dapp

# New ZK-only project with an empty starter circuit
caatinga zk init my-zk-dapp --minimal

# Or add ZK files to an existing project
caatinga zk init

cd my-zk-dapp
npm install

# Build Soroban verifier + Circom circuit trusted setup
caatinga build
caatinga zk build

# Deploy and prove
caatinga deploy verifier --network testnet --source <identity>
caatinga zk prove
caatinga zk invoke --source-account <identity>
```

## Commands

| Command | Purpose |
| --- | --- |
| `caatinga zk init [project]` | Scaffold `zk-starter` (multiplier circuit + verifier). |
| `caatinga zk init [project] --minimal` | Scaffold a ZK-only project with a minimal identity circuit and verifier. |
| `caatinga zk build [circuit]` | Compile Circom (`-p bls12381`) and run dev trusted setup. |
| `caatinga zk prove [circuit]` | Generate `proof.json` and `public.json` from `input.json`. |
| `caatinga zk invoke [circuit]` | Serialize snarkjs output and call `verify_proof` on-chain. |

Artifacts land in `.artifacts/zk/<circuit>/`.

## Minimal scaffold vs template

Use `caatinga zk init my-zk-dapp` when you want a working multiplier example with an interactive
Vite + React shell (circuit inputs, wallet verify, placeholder bindings). Use
`caatinga zk init my-zk-dapp --minimal` when you want a ZK-only starting point: no frontend config,
no Vite files, and a `template Main()` circuit that simply exposes one output.

Both flows keep the same conventions: `circuits/main.circom`, `circuits/input.json`,
`contracts.verifier`, and artifacts under `.artifacts/zk/main/`.

## Browser + CLI hybrid (`zk-starter`)

The default template frontend follows the same wallet-driven pattern as `react-vite-counter`:

1. Set circuit inputs in the UI and download `input.json`
2. Save it to `circuits/input.json`
3. Run `caatinga zk prove main` (CLI)
4. Connect a wallet and simulate `verify_proof` from the browser via `caatingaClient.contract("verifier").read(...)` (`@caatinga/client`)

Serialization for browser verification uses `@caatinga/zk/browser` (`buildVerifyProofBindingArgs`). The
dev server exposes proof artifacts at `/zk-artifacts/proof.json`, `/zk-artifacts/verification_key.json`,
and `/zk-artifacts/public.json` after a local prove.

## Circuit inputs

`circuits/input.json` must contain **private signals only**. Do not include public outputs —
for the multiplier scaffold, use `a` and `b` but not `c`. Snarkjs derives public signals during
proving and writes them to `.artifacts/zk/<circuit>/public.json`.

If you include a public output in `input.json`, `caatinga zk prove` fails with a witness error
(for example `Too many values for input signal c`).

## Build artifacts

After `caatinga zk build`, Circom emits WASM under:

```
.artifacts/zk/<circuit>/main_js/main.wasm
```

The CLI resolves this path automatically during `caatinga zk prove`; you do not configure it
in `caatinga.config.ts`.

## Library API (`@caatinga/zk`)

Importable serialization bridge (no hidden runtime dependency on your circuit):

```ts
import { serializeProof, serializeVk, serializePublicSignals } from "@caatinga/zk";
```

For browser invoke flows (for example `zk-starter`), use the browser-only subpath:

```ts
import { buildVerifyProofBindingArgs } from "@caatinga/zk/browser";
```

Types align with snarkjs JSON (`SnarkjsProof`, `SnarkjsVk`) and the byte layouts expected by the
Soroban BLS12-381 types.

## Dynamic VK vs embedded VK

| Mode | When to use |
| --- | --- |
| **Dynamic VK** (default) | VK passed as a contract argument; flexible across circuit changes. |
| **`--embed-vk`** | Intended for a static VK baked into the verifier contract (see WIP note below). |

Embedded VK is opt-in and visible in your repo — never a hidden dependency.

### WIP: `--embed-vk`

`caatinga zk build --embed-vk` currently writes a stub `contracts/verifier/src/vk.rs` with
`todo!()` placeholders. The verifier contract scaffold still expects a dynamic VK argument, and
`caatinga zk invoke --embed-vk` does not yet target an embedded-VK entrypoint. Use the default
dynamic VK flow for end-to-end verification today.

## Trusted setup warning

`caatinga zk build` runs a **single-party development ceremony** by default. Suitable for local
testing only. Production deployments require a proper MPC powers-of-tau ceremony and audited
circuit artifacts.

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
        verifierContract: "verifier",
      },
    },
  },
});
```

Only `bls12381` is accepted today; other curves fail config validation.

## Phase note

The `zk-starter` verifier scaffold compiles against the reference contract shape. End-to-end proof
verification on a live network should be validated after `zk build` + `zk prove` + `zk invoke` on
Protocol 25+ testnet.
