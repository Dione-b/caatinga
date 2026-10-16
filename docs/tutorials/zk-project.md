# ZK Project

**Groth16** proofs (BLS12-381) verified on Soroban. See [Choosing a project scaffold](./project-scaffolds.md) to compare paths.

## When to use

- Privacy or proof-carrying workflows on Stellar (Protocol 27+)
- Circom circuits with on-chain `verify_proof`
- Hybrid flows: prove in CLI, verify in browser via `@caatinga/client`

For a standard Soroban dApp without ZK, use [Template](./template-project.md) or [Minimal](./minimal-project.md) instead.

## Extra prerequisites

Beyond the usual [Getting started prerequisites](../getting-started.md#prerequisites):

- **Protocol 27+** on the target network (the verifier is built with `soroban-sdk` 27)
- **Verifier contract:** `soroban-sdk = "27.0.6"`, Rust **1.91.1**
- **Circom 2 + snarkjs** — installed on first `ctg zk build` into `~/.caatinga/zk-tools`

See [ZK module — Requirements](../zk.md#requirements) for details.

## Three ways to scaffold

| Mode                    | Command                                | Result                                                             |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| Full template           | `npx ctg zk init my-zk-dapp`           | `zk-starter`: multiplier circuit + Vite UI + verifier              |
| ZK minimal              | `npx ctg zk init my-zk-dapp --minimal` | Identity circuit + verifier, no frontend                           |
| Add to existing project | `cd my-app && npx ctg zk init`         | Copies `circuits/` + `contracts/verifier`, merges `zk` into config |

Re-run `ctg zk init` in an existing directory with `--force` to overwrite conflicting scaffold files.

### Add ZK to an existing project

From a directory that already has `caatinga.config.ts`:

```bash
cd my-contract-app
npx ctg zk init
```

Without `--minimal`, Caatinga copies circuit and verifier files from `zk-starter` and merges `verifier` + `zk` blocks into your config. With `--minimal`, it scaffolds a minimal identity circuit and verifier instead.

## Dev/testnet workflow

> `ctg zk build` runs a **single-party development ceremony** unless you import an audited one.
> Use **testnet** for this walkthrough; mainnet deploy/invoke with dev artifacts is blocked by default.

```bash
npx ctg zk init my-zk-dapp
cd my-zk-dapp
npm install

npx ctg build verifier
npx ctg zk build main
npx ctg zk estimate verify main
npx ctg doctor --network testnet
npx ctg deploy verifier --network testnet --source alice
npx ctg zk prove main
npx ctg zk invoke main --network testnet --source alice
```

Step by step:

1. **`build verifier`** — compile the Soroban Groth16 verifier WASM
2. **`zk build main`** — compile Circom (`-p bls12381`) and run the **dev** trusted setup (not for production); artifacts land in `.artifacts/zk/main/`
3. **`estimate verify main`** — check the CPU/memory budget before spending anything on-chain
4. **`doctor --network testnet`** — confirm the network is at protocol 27+ and report ZK drift
5. **`deploy verifier`** — record verifier `contractId` in `caatinga.artifacts.json`
6. **`zk prove main`** — generate `proof.json` and `public.json` from `circuits/input.json`
7. **`zk invoke main`** — serialize proof data and call `verify_proof` on-chain

## Moving to production

### 1. Import an audited ceremony

The dev ceremony is single-party. For mainnet, run an external MPC ceremony and import its
output:

```bash
npx ctg zk import-ceremony main --ceremony /path/to/ceremony-output
```

Point `--ceremony` at the directory holding `circuit_final.zkey` and `verification_key.json`.
Caatinga validates the artifacts against the compiled circuit (public-signal count) and
fails with `CAATINGA_ZK_CEREMONY_INCOMPATIBLE` rather than letting a mismatched key reach
the chain. After the import, `ctg zk build` reuses those artifacts instead of creating a new
dev ceremony, and the mainnet guardrail for that circuit is lifted.

### 2. Freeze the circuit and embed the VK (optional)

Once the circuit stops changing, embed the verification key in the contract:

```bash
npx ctg zk build main --embed-vk
npx ctg build verifier
```

### 3. Upgrade a verifier that is already deployed

`ctg upgrade` swaps the WASM in place and keeps the same `contractId`, so clients and
`caatinga.artifacts.json` do not need to change:

```bash
npx ctg upgrade verifier --network testnet --source alice
npx ctg zk invoke main --embed-vk --network testnet --source alice
```

Because `verify_proof` stays in the contract, dApps that still pass the VK explicitly
continue to work — no breaking change for existing integrations.

> **Upgrade vs redeploy.** `ctg upgrade` keeps the `contractId`. `ctg deploy --upgrade`
> creates a **new** instance with a new `contractId`. Only use a redeploy when you actually
> want a new verifier address.

## Live end-to-end validation

`scripts/zk-testnet-smoke.sh` runs the whole loop against a real Protocol 27+ testnet:
scaffold, build, dev ceremony, deploy, prove, invoke, mainnet guardrail, ceremony import,
rebuild, and invoke again.

```bash
CAATINGA_CI_IDENTITY_ALIAS=alice bash scripts/zk-testnet-smoke.sh
```

It spends testnet XLM, so it is opt-in. In CI it runs as the `zk-smoke` job of
`.github/workflows/testnet-smoke.yml`, triggered through `workflow_dispatch` with `zk: true`.

## Template vs minimal

|          | `zk init` (zk-starter)                  | `zk init --minimal`                  |
| -------- | --------------------------------------- | ------------------------------------ |
| Frontend | Vite + React shell                      | None                                 |
| Circuit  | Multiplier example (`a * b = c`)        | Identity `template Main()`           |
| Best for | Learning end-to-end ZK + browser verify | CI, custom UI, headless prove/invoke |

The `zk-starter` UI follows a hybrid pattern:

1. Set circuit inputs in the browser and download `input.json`
2. Save to `circuits/input.json`
3. Run `ctg zk prove main` in the terminal
4. Connect a wallet and simulate `verify_proof` via `caatingaClient.contract("verifier").read(...)`

Browser serialization uses `@caatinga/zk/browser` (`buildVerifyProofBindingArgs`).

## Circuit inputs

`circuits/input.json` must contain the circuit's input signals only. Do not include derived
outputs.

For the multiplier scaffold, use `a` and `b` but not `c` — `c` is computed from them.

Including an output causes `ctg zk prove` to fail (`Too many values for input signal c`).
Caatinga rewrites that failure as `CAATINGA_ZK_INPUT_CONTAINS_PUBLIC_SIGNALS`, naming the
signal so the fix is immediate.

## Next steps

- [ZK module](../zk.md) — command reference, library API, dynamic vs embedded VK
- [Client](../client.md) — browser verify flows
