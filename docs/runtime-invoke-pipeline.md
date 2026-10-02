# Runtime & Invocation Pipeline

This document describes the Caatinga browser-side runtime architecture, the `CaatingaWalletAdapter` contract, and the full invocation pipeline for Soroban smart contracts.

---

## 1. Runtime Architecture (Sprint 20)

The Caatinga Runtime lives in `@caatinga/client` and is responsible for the entire browser-side lifecycle of Soroban contract calls. It does **not** orchestrate deployments (that is the domain of `@caatinga/core` and the CLI).

### Packages

| Package            | Responsibility                                                         |
| ------------------ | ---------------------------------------------------------------------- |
| `@caatinga/core`   | Server/Node orchestration: build, deploy, upgrade, artifacts, bindings |
| `@caatinga/client` | Browser/Node runtime: wallet integration, signing, contract invocation |

### Minimal API

The runtime exposes a single `createCaatingaClient(config)` factory. `client.contract(name)` returns
the client for one configured contract:

```ts
const client = createCaatingaClient(config);
const token = client.contract("token");

// State-changing call (sign + submit):
await token.invoke("transfer", { to, amount });

// Read-only call (simulate only, returns the decoded value):
const val = await token.read<bigint>("balance", { address });

// Read-only call with metadata ({ status: "simulated", result, contractId, ... }):
const sim = await token.simulate<bigint>("balance", { address });
```

See [Client](./client.md) for the full config, including the `as CaatingaArtifacts` cast for the
imported artifacts JSON.

---

## 2. Wallet Layer (Sprint 21)

### `CaatingaWalletAdapter` Interface

```ts
interface CaatingaWalletAdapter {
  getPublicKey(): Promise<string>;
  signTransaction(input: { xdr: string; networkPassphrase: string }): Promise<string>;

  /** Optional: the wallet's current network passphrase, or undefined if unknown. */
  getNetworkPassphrase?(): Promise<string | undefined>;
}
```

**Contract rules:**

- Optional `getNetworkPassphrase()`: when it resolves to a passphrase different from the configured network, `invoke()` throws `CAATINGA_WALLET_NETWORK_MISMATCH` before building the transaction.
- `getPublicKey()` must resolve to a valid Ed25519 public key (G-prefixed Stellar address).
- `signTransaction()` must resolve to a Base64-encoded signed XDR string.
- Both methods **must reject** (not leave the promise pending) when the user cancels or when the wallet is not connected.
- Caatinga applies an optional `walletTimeout` (ms) via `CaatingaClientConfig.walletTimeout` if provided.

### Built-in Adapters

Two adapters ship in `packages/client/src/adapters/`: Freighter (`@caatinga/client/freighter`) and Stellar Wallets Kit (`@caatinga/client/stellar-wallets-kit`). See [Wallets](./wallets.md).

---

## 3. Invoke Pipeline (Sprint 22)

The full lifecycle of a state-changing transaction is:

```
invoke()
  │
  ├─ 1. getNetworkPassphrase() ← wallet adapter (optional; mismatch → WALLET_NETWORK_MISMATCH)
  ├─ 2. getPublicKey()     ← wallet adapter
  ├─ 3. createClient()     ← binding adapter (Stellar SDK contract client)
  ├─ 4. callMethod()       ← binding adapter (assembles the AssembledTransaction)
  │
  ├─ 5. buildXdr()         ← prepares & simulates via RPC (Soroban prepareTransaction)
  │       └─ simulate  ──→ rpcUrl (Soroban RPC)
  │
  ├─ 6. signTransaction()  ← wallet adapter (user approves in wallet UI)
  │
  ├─ 7. submitTransaction() ← Stellar SDK signAndSend() via RPC
  │       └─ submit    ──→ rpcUrl (Soroban RPC)
  │       └─ watch     ──→ polls until COMPLETE or FAILED
  │
  └─ 8. normalizeSubmitResult() → CaatingaInvokeResult<T>
```

Read-only calls (`simulate` / `read`) do **not** require a connected wallet. They skip the network
check, signing, and submission, and simulate with `prepareReadTransaction` using this source account,
in order: the per-call `sourceAccount` option, the connected wallet's public key (if available),
`CaatingaClientConfig.readSourceAccount`, then a built-in default account. `simulate` returns
`{ status: "simulated", result, ... }`; `read` returns only `result`.

### Status Progression

```
built → prepared → signed → submitted → confirmed
                                      → failed
                                      → pending
```

The terminal status is read from the transaction's real on-chain outcome —
`getTransactionResponse.status`, falling back to `sendTransactionResponse.status`
— never assumed from the fact that submission returned:

| Soroban RPC status     | `CaatingaInvokeResult.status` |
| ---------------------- | ----------------------------- |
| `SUCCESS`              | `confirmed`                   |
| `FAILED`               | `failed`                      |
| `ERROR`                | `failed`                      |
| `TRY_AGAIN_LATER`      | `pending`                     |
| `NOT_FOUND`            | `pending`                     |
| absent or unrecognized | `pending`                     |

`ERROR` is a definitive rejection by the RPC — the transaction was never
accepted and will not land — so it is reported as a failure rather than as
something to keep waiting on. `pending` means the outcome is genuinely unknown:
the submission may still reach a ledger, or the SDK's polling window expired
before it did. Treat it as "check the transaction hash", not as success.

A payload with no status field at all also reports `pending`. This is reachable
only through a custom binding adapter's `send()` result — the SDK's
`signAndSend` always populates `sendTransactionResponse` and
`getTransactionResponse`.

On `failed`, the result carries `resultXdr` and `diagnosticEvents` when the RPC
returned them, so the on-chain failure can be decoded without re-running the
call with `debugRaw`.

### Error Codes

| Situation                                                         | CaatingaErrorCode         |
| ----------------------------------------------------------------- | ------------------------- |
| Wallet not connected / key unavailable                            | `WALLET_NOT_CONNECTED`    |
| User dismissed signing                                            | `XDR_SIGN_FAILED`         |
| Empty or invalid signed XDR                                       | `XDR_SIGN_FAILED`         |
| Simulation failure                                                | `XDR_PREPARE_FAILED`      |
| Submission/network failure                                        | `XDR_SUBMIT_FAILED`       |
| Wallet did not answer within `walletTimeout`                      | `WALLET_TIMEOUT`          |
| Wallet on a different network                                     | `WALLET_NETWORK_MISMATCH` |
| Extra non-invoker auth signatures needed                          | `MULTI_AUTH_REQUIRED`     |
| Simulation returned no result value                               | `READ_RESULT_MISSING`     |
| Contract returned an error result, or submit payload unrecognized | `XDR_RESULT_FAILED`       |
