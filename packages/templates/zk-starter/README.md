# zk-starter

Editable ZK scaffold for Caatinga — not a black-box dependency. You own the circuit,
verifier contract, and trusted-setup artifacts in this project.

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

## Workflow

```bash
npm install
caatinga build
caatinga zk build
caatinga deploy verifier --network testnet --source <identity>
caatinga zk prove
caatinga zk invoke --source-account <account>
```

## Trusted setup

The default `caatinga zk build` flow runs a **local, single-party** trusted setup suitable
for development only. Do not use those keys in production — run a proper MPC ceremony instead.
