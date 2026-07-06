# Runtime & Invocation Pipeline

This document describes the Caatinga browser-side runtime architecture, the `CaatingaWalletAdapter` contract, and the full invocation pipeline for Soroban smart contracts.

---

## 1. Runtime Architecture (Sprint 20)

The Caatinga Runtime lives in `@caatinga/client` and is responsible for the entire browser-side lifecycle of Soroban contract calls. It does **not** orchestrate deployments (that is the domain of `@caatinga/core` and the CLI).

### Packages

| Package | Responsibility |
|---|---|
| `@caatinga/core` | Server/Node orchestration: build, deploy, upgrade, artifacts, bindings |
| `@caatinga/client` | Browser/Node runtime: wallet integration, signing, contract invocation |

### Minimal API

The runtime exposes a single `createCaatingaClient(config)` factory that returns a typed proxy client per contract name:

```ts
const client = createCaatingaClient(config);

// State-changing call (sign + submit):
await client.myContract.invoke("transfer", { to, amount });

// Read-only call (simulate only):
const val = await client.myContract.read("balance", { address });
```

---

## 2. Wallet Layer (Sprint 21)

### `CaatingaWalletAdapter` Interface

```ts
interface CaatingaWalletAdapter {
  getPublicKey(): Promise<string>;
  signTransaction(input: { xdr: string; networkPassphrase: string }): Promise<string>;
}
```

**Contract rules:**
- `getPublicKey()` must resolve to a valid Ed25519 public key (G-prefixed Stellar address).
- `signTransaction()` must resolve to a Base64-encoded signed XDR string.
- Both methods **must reject** (not leave the promise pending) when the user cancels or when the wallet is not connected.
- Caatinga applies an optional `walletTimeout` (ms) via `CaatingaClientConfig.walletTimeout` if provided.

### Built-in Adapters

Adapters for Freighter, Stellar Wallets Kit, and SWKKit are available in `packages/client/src/adapters/`.

---

## 3. Invoke Pipeline (Sprint 22)

The full lifecycle of a state-changing transaction is:

```
invoke()
  │
  ├─ 1. getPublicKey()     ← wallet adapter
  ├─ 2. createClient()     ← binding adapter (Stellar SDK contract client)
  ├─ 3. callMethod()       ← binding adapter (assembles the AssembledTransaction)
  │
  ├─ 4. buildXdr()         ← prepares & simulates via RPC (Soroban prepareTransaction)
  │       └─ simulate  ──→ rpcUrl (Soroban RPC)
  │
  ├─ 5. signTransaction()  ← wallet adapter (user approves in wallet UI)
  │
  ├─ 6. submitTransaction() ← Stellar SDK signAndSend() via RPC
  │       └─ submit    ──→ rpcUrl (Soroban RPC)
  │       └─ watch     ──→ polls until COMPLETE or FAILED
  │
  └─ 7. normalizeSubmitResult() → CaatingaInvokeResult<T>
```

For read-only calls (`simulate` / `read`), only steps 1–4 run; signing and submission are skipped.

### Status Progression

```
built → prepared → signed → submitted → confirmed
                                      → failed
```

### Error Codes

| Situation | CaatingaErrorCode |
|---|---|
| Wallet not connected / key unavailable | `WALLET_NOT_CONNECTED` |
| User dismissed signing | `XDR_SIGN_FAILED` |
| Empty or invalid signed XDR | `XDR_SIGN_FAILED` |
| Simulation failure | `XDR_PREPARE_FAILED` |
| Submission/network failure | `XDR_SUBMIT_FAILED` |
