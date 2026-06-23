# Signing Strategy

Caatinga does not store private keys or run silent signing. This document describes what signing models are supported today, what is explicitly out of scope for alpha, and recommended patterns for testnet vs mainnet.

## CLI signing (`--source`)

All state-changing CLI commands (`deploy`, `invoke`, `zk invoke`) require `--source`:

- **Value:** a **local Stellar CLI identity alias** (e.g. `alice`), not a public `G...` address or seed phrase.
- **Mechanism:** Caatinga passes `--source-account <alias>` to Stellar CLI; the CLI loads the key from its local keystore.
- **Validation:** `CAATINGA_SOURCE_IS_PUBLIC_KEY`, `CAATINGA_SOURCE_IS_SECRET_KEY`, and related codes reject unsafe shapes early.

```bash
stellar keys generate alice --fund --network testnet
caatinga deploy counter --network testnet --source alice
```

Run `caatinga doctor --source alice` to verify the identity exists and can sign on the selected network.

## Browser signing (`@caatinga/client`)

Browser flows use a **wallet adapter** — the wallet extension or Stellar Wallets Kit signs transactions:

- **Scope (alpha):** **single-invoker** only. The connected wallet signs as the transaction source.
- **Not supported (alpha):** delegated AddressV2 / non-invoker `signAuthEntry` orchestration. Contracts requiring multi-auth fail with `CAATINGA_MULTI_AUTH_REQUIRED`.
- **Adapters:** Freighter, Stellar Wallets Kit (xBull, Albedo, Rabet, WalletConnect, etc.). Hardware wallets inside SWK are stubbed for bundle size — not registered in the default adapter.

See [Wallets](./wallets.md) and [Client](./client.md#single-invoker-scope-until-v10).

## CI signing

Caatinga does not manage CI secrets. Recommended pattern:

1. Generate a dedicated deployer identity on the runner or inject a secret-backed alias.
2. Fund the identity on testnet (or use a platform secret for mainnet).
3. Pass `--source ci-deployer` (or your alias) to `caatinga deploy` / `invoke`.
4. Commit updated `caatinga.artifacts.json` from the pipeline or store as a build artifact.

See [Testing — CI without local secrets](./internal/testing.md).

## Testnet vs mainnet

| Concern          | Testnet                                             | Mainnet                                                      |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------ |
| Identity         | `stellar keys generate --fund`                      | Pre-funded account; never commit seeds                       |
| Source alias     | Dev alias (`alice`) acceptable                      | Dedicated deployer alias per environment                     |
| ZK dev ceremony  | Allowed on testnet with warnings                    | Blocked by default (`CAATINGA_ZK_DEV_CEREMONY_BLOCKED`)      |
| Cost awareness   | Use `caatinga estimate deploy` before large deploys | **Required** — estimate fees; monitor resource limits        |
| Artifact history | Optional                                            | Use `caatinga migrate artifacts` + upgrade/rollback workflow |

## Explicitly not supported (alpha)

| Model                                | Status         | Notes                                                                        |
| ------------------------------------ | -------------- | ---------------------------------------------------------------------------- |
| Hardware wallets (Ledger/Trezor)     | Not supported  | SWK stubs only; no native Ledger integration                                 |
| KMS / cloud signing (AWS KMS, GCP)   | Non-goal alpha | Use Stellar CLI or custom signing outside Caatinga                           |
| Backend / server-side signing        | Non-goal alpha | Application responsibility                                                   |
| Multisig / `signAuthEntry` in client | v1.0 candidate |                                                                              |
| Caatinga-managed key storage         | Never          | By design — see [ADR 0002](./adr/0002-local-artifacts-as-source-of-truth.md) |

## Related docs

- [Production readiness](./production-readiness.md)
- [CLI reference](./cli.md)
- [Errors — source codes](./errors.md)
