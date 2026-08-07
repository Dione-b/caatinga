# @caatinga/zk

Circom Groth16 proof serialization and verification bridge for Soroban. Used by `ctg zk-*` commands and the `zk-starter` template.

## Install

```bash
npm install @caatinga/zk
```

## CLI workflow

```bash
ctg zk init      # scaffold verifier contract + circuit
ctg zk build     # compile Circom, run dev trusted setup
ctg zk prove     # generate proof.json + public.json
ctg zk invoke --source alice
```

`ctg zk build` runs a single-party development ceremony suitable for testnet/dev only. Production requires an external MPC ceremony.

## Documentation

- [ZK module](https://github.com/Dione-b/caatinga/blob/main/docs/zk.md)
- [ZK project tutorial](https://github.com/Dione-b/caatinga/blob/main/docs/tutorials/zk-project.md)

Browser subpath: `@caatinga/zk/browser` for client-side proof verification helpers.
