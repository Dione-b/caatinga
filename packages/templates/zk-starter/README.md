# zk-starter

Editable ZK scaffold for Caatinga — not a black-box dependency. You own the circuit,
verifier contract, and trusted-setup artifacts in this project.

This template is the multiplier example used by default in `ctg zk init`. It is not required
for custom circuits; use `ctg zk init --minimal` when you want a ZK-only project with a blank
starter circuit and no frontend config.

## Requirements

- Protocol 25+ on the target network (BLS12-381 host functions)
- `soroban-sdk = "25.1.0"` and Rust `1.89.0` for the verifier contract

## Circuit inputs

`circuits/input.json` must list **private signals only**. Do not include public outputs
(for example `c` in the multiplier circuit) — snarkjs derives public signals during proving
and writes them to `.artifacts/zk/<circuit>/public.json`.

## Build target

The verifier WASM is built for `wasm32v1-none` (current Stellar CLI default). The path is
configured in `caatinga.config.ts` under `contracts.verifier.wasm`.

## Frontend (hybrid flow)

> **Single-invoker only until v1.0** for wallet `invoke` via `@caatinga/client`.

The template ships a Vite + React dApp modeled after `react-vite-counter`:

- edit private inputs (`a`, `b`) in the browser
- download `input.json` and save it to `circuits/input.json`
- run `npm run caatinga:zk:prove` (CLI prove)
- connect a wallet and click **Verify proof on-chain** (`caatingaClient` + generated verifier bindings)

Placeholder verifier bindings live under `src/bindings/verifier/` until `ctg generate verifier`
overwrites them after deploy.

Proof artifacts are written to `.artifacts/zk/main/` (gitignored). The Vite dev server exposes them at
`/zk-artifacts/*` — not under `public/zk-artifacts/`.

## Workflow

First-time on-chain verification with the shipped `circuits/input.json` (`a=3`, `b=11`):

```bash
npm install
npm test             # run Rust verifier contract tests
cargo test --manifest-path contracts/verifier/Cargo.toml
npm run caatinga:build
npm run caatinga:zk:setup   # zk build + prove → populates .artifacts/zk/main/
npm run caatinga:deploy
npm run caatinga:generate
npm run dev
# UI: connect wallet → Verify proof on-chain
```

Hybrid flow after changing inputs in the browser:

1. Set `a` / `b` in the UI and download `input.json`
2. Save it to `circuits/input.json`
3. Run `npm run caatinga:zk:prove` (or `npm run caatinga:zk:setup` after editing the circuit)
4. Refresh artifacts in the UI, then **Verify proof on-chain**

## Trusted setup

The default `ctg zk build` flow runs a **local, single-party** trusted setup suitable
for development only. Do not use those keys in production — run a proper MPC ceremony instead.

**Mainnet guardrail:** Caatinga blocks `zk build` when `defaultNetwork` is `mainnet`, and blocks
mainnet deploy/invoke of verifiers backed by dev-ceremony artifacts (`CAATINGA_ZK_DEV_CEREMONY_BLOCKED`)
unless you pass `--allow-dev-ceremony` for conscious testing. See [ZK production guardrails](https://github.com/Dione-b/caatinga/blob/main/docs/zk.md#production-guardrails).
