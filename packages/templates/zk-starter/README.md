# zk-starter

Editable ZK scaffold for Caatinga — not a black-box dependency. You own the circuit,
verifier contract, and trusted-setup artifacts in this project.

This template is the multiplier example used by default in `caatinga zk init`. It is not required
for custom circuits; use `caatinga zk init --minimal` when you want a ZK-only project with a blank
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

The template ships a Vite + React dApp modeled after `react-vite-counter`:

- edit private inputs (`a`, `b`) in the browser
- download `input.json` and save it to `circuits/input.json`
- run `npm run caatinga:zk:prove` (CLI prove)
- connect a wallet and click **Verify proof on-chain** (`caatingaClient` + generated verifier bindings)

Placeholder verifier bindings live under `src/bindings/verifier/` until `caatinga generate verifier`
overwrites them after deploy. The dev server serves `.artifacts/zk/main/*.json` at `/zk-artifacts/*`.

## Workflow

```bash
npm install
npm run caatinga:build
npm run caatinga:zk:build
npm run caatinga:deploy
npm run caatinga:generate
npm run dev
# UI: set a/b → download input.json → save to circuits/input.json
npm run caatinga:zk:prove
# UI: connect wallet → Verify proof on-chain
```

## Trusted setup

The default `caatinga zk build` flow runs a **local, single-party** trusted setup suitable
for development only. Do not use those keys in production — run a proper MPC ceremony instead.
