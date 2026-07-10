# ZK Project

**Groth16** proofs (BLS12-381) verified on Soroban. See [Choosing a project scaffold](./project-scaffolds.md) to compare paths.

## When to use

- Privacy or proof-carrying workflows on Stellar (Protocol 25+)
- Circom circuits with on-chain `verify_proof`
- Hybrid flows: prove in CLI, verify in browser via `@caatinga/client`

For a standard Soroban dApp without ZK, use [Template](./template-project.md) or [Minimal](./minimal-project.md) instead.

## Extra prerequisites

Beyond the usual [Getting started prerequisites](../getting-started.md#prerequisites):

- **Protocol 25+** on the target network
- **Verifier contract:** `soroban-sdk = "25.1.0"`, Rust **1.89.0**
- **Circom 2 + snarkjs** — installed on first `caatinga zk build` into `~/.caatinga/zk-tools`

See [ZK module — Requirements](../zk.md#requirements) for details.

## Three ways to scaffold

| Mode                    | Command                                     | Result                                                             |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| Full template           | `npx caatinga zk init my-zk-dapp`           | `zk-starter`: multiplier circuit + Vite UI + verifier              |
| ZK minimal              | `npx caatinga zk init my-zk-dapp --minimal` | Identity circuit + verifier, no frontend                           |
| Add to existing project | `cd my-app && npx caatinga zk init`         | Copies `circuits/` + `contracts/verifier`, merges `zk` into config |

Re-run `caatinga zk init` in an existing directory with `--force` to overwrite conflicting scaffold files.

### Add ZK to an existing project

From a directory that already has `caatinga.config.ts`:

```bash
cd my-contract-app
npx caatinga zk init
```

Without `--minimal`, Caatinga copies circuit and verifier files from `zk-starter` and merges `verifier` + `zk` blocks into your config. With `--minimal`, it scaffolds a minimal identity circuit and verifier instead.

## Dev/testnet workflow

> `caatinga zk build` runs a **single-party development ceremony**. Use **testnet** for this walkthrough; mainnet deploy/invoke with dev artifacts is blocked by default.

```bash
npx caatinga zk init my-zk-dapp
cd my-zk-dapp
npm install

npx caatinga build verifier
npx caatinga zk build main
npx caatinga deploy verifier --network testnet --source alice
npx caatinga zk prove main
npx caatinga zk invoke --source alice
```

Step by step:

1. **`build verifier`** — compile the Soroban Groth16 verifier WASM
2. **`zk build main`** — compile Circom (`-p bls12381`) and run **dev** trusted setup (not for production); artifacts land in `.artifacts/zk/main/`
3. **`deploy verifier`** — record verifier `contractId` in `caatinga.artifacts.json`
4. **`zk prove main`** — generate `proof.json` and `public.json` from `circuits/input.json`
5. **`zk invoke`** — serialize proof data and call `verify_proof` on-chain

## Template vs minimal

|          | `zk init` (zk-starter)                  | `zk init --minimal`                  |
| -------- | --------------------------------------- | ------------------------------------ |
| Frontend | Vite + React shell                      | None                                 |
| Circuit  | Multiplier example (`a * b = c`)        | Identity `template Main()`           |
| Best for | Learning end-to-end ZK + browser verify | CI, custom UI, headless prove/invoke |

The `zk-starter` UI follows a hybrid pattern:

1. Set circuit inputs in the browser and download `input.json`
2. Save to `circuits/input.json`
3. Run `caatinga zk prove main` in the terminal
4. Connect a wallet and simulate `verify_proof` via `caatingaClient.contract("verifier").read(...)`

Browser serialization uses `@caatinga/zk/browser` (`buildVerifyProofBindingArgs`).

## Circuit inputs

`circuits/input.json` must contain **private signals only**. Do not include public outputs.

For the multiplier scaffold, use `a` and `b` but not `c`. Snarkjs derives public signals during proving and writes them to `.artifacts/zk/main/public.json`.

Including a public output in `input.json` causes `caatinga zk prove` to fail (for example `Too many values for input signal c`).

## Next steps

- [ZK module](../zk.md) — command reference, library API, dynamic vs embedded VK
- [Client](../client.md) — browser verify flows
- [Minimal project](./minimal-project.md) — start CLI-only, then `caatinga zk init` to add ZK
