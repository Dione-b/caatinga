## Breaking changes policy

## 2.3.1

### Patch Changes

- Add hybrid zk-starter browser verification, `@caatinga/zk/browser`, and unwrap Stellar `Result` values in client read/simulate flows.
- Updated dependencies
  - @caatinga/core@2.3.1

## 2.3.0

### Minor Changes

- Add ZK workflow support: publish `@caatinga/zk`, CLI commands (`zk-init`, `zk-build`, `zk-prove`, `zk-invoke`), and the `zk-starter` template for Circom Groth16 verifiers on Soroban.
- Add `@caatinga/zk/browser` for browser-safe proof serialization and verifier binding args.
- Document compatibility with both `zk-starter` and the new minimal ZK scaffold.

### Patch Changes

- Updated dependencies
  - @caatinga/core@2.3.0

## 2.2.1

### Minor Changes

- Initial `@caatinga/zk` release: Circom Groth16 proof serialization, circuit build/prove helpers, and Soroban verifier invoke bridge for the Caatinga ZK workflow.
