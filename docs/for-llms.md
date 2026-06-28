# Caatinga — AI-Optimized Reference

Caatinga is a **TypeScript-native CLI and browser toolkit** for Soroban smart contract deployment and dApp development on Stellar. It manages the full lifecycle: scaffold, build, deploy, generate TypeScript bindings, invoke, and wire browser clients — all git-driven, npm-first, with no mandatory registry.

Equivalent content available at [`/llms-full.txt`](../llms-full.txt).

---

## 1. Core Workflow

```mermaid
flowchart LR
  init["caatinga init"] --> build["caatinga build"]
  build --> deploy["caatinga deploy"]
  deploy --> generate["caatinga generate<br/>(auto after deploy)"]
  generate --> bindings["TypeScript bindings"]
  bindings --> invoke["caatinga invoke / read"]
  bindings --> client["@caatinga/client in browser"]
```

**Minimal loop:**
```bash
npx caatinga@next init my-dapp && cd my-dapp && npm install
npx caatinga doctor --network testnet --source alice   # verify env
npx caatinga build counter                              # compile WASM
npx caatinga deploy counter --network testnet --source alice  # deploy + auto-generate bindings
npx caatinga invoke counter.increment --network testnet --source alice
npx caatinga read counter.get --network testnet         # read-only, no signing
npx caatinga status --network testnet                   # deployed? bindings fresh?
```

**One-step env setup on a fresh machine:**
```bash
npx caatinga@next setup  # installs Rust + wasm32v1-none + Stellar CLI, funds `alice` on testnet
```

**Multi-contract graph deploy (with postDeploy hooks and frontend env sync):**
```bash
npx caatinga deploy --network testnet --source alice    # deploy all, wire, sync-env
```

---

## 2. Package Reference

| Package | Role | Browser-safe | Install command |
|---------|------|-------------|-----------------|
| `@caatinga/cli` | CLI binary (`caatinga` command) | No | `npm install -g @caatinga/cli@next` |
| `@caatinga/core` | Config loading, artifact I/O, Stellar CLI orchestration, shell layer | No (use `./browser`) | — (dep of cli) |
| `@caatinga/core/browser` | Errors + artifact types only; excludes Node-only modules | Yes | — (dep of client) |
| `@caatinga/client` | `createCaatingaClient`, wallet session, invoke/read/simulate/buildXdr | Yes | `npm install @caatinga/client` |
| `@caatinga/client/react` | `WalletProvider` + `useWallet` (React >=18 optional peer) | Yes | (subpath of client) |
| `@caatinga/client/vite` | SWK bundler helpers: `walletStubViteAliases`, `walletStubOverrides` | Yes | (subpath of client) |
| `@caatinga/client/freighter` | Freighter wallet adapter | Yes | (subpath of client) |
| `@caatinga/client/stellar-wallets-kit` | Multi-wallet adapter (Freighter, xBull, etc.) | Yes | (subpath of client) |
| `@caatinga/zk` | ZK proof serialization, Circom Groth16 helpers | No (use `./browser`) | — (dep of cli) |
| `@caatinga/zk/browser` | Browser ZK binding helpers | Yes | (subpath of zk) |

---

## 3. CLI Command Reference

### Setup & Scaffold

| Command | Purpose | Flags |
|---------|---------|-------|
| `caatinga setup` | Install prerequisites (Rust, wasm target, Stellar CLI, identity) | `--source`, `--network`, `--skip-rust`, `--skip-stellar`, `--skip-identity` |
| `caatinga init <dir>` | Scaffold project from template (default: react-vite-counter) | `-t`, `--minimal`, `--empty` |
| `caatinga zk init [dir]` | Scaffold ZK project (zk-starter) | `--minimal` |

### Build & Deploy

| Command | Purpose | Flags |
|---------|---------|-------|
| `caatinga build [contract]` | Compile WASM with `stellar contract build`. Omit name = build all | — |
| `caatinga deploy [contract]` | Deploy, record artifacts, auto-generate bindings. Omit name = full graph | `--network`, `--source`, `--force`, `--no-deps`, `--verify-deps`, `--no-stale-check`, `--no-generate`, `--no-wire`, `--no-sync-env`, `--allow-dev-ceremony` |
| `caatinga wire` | Run `postDeploy` hooks after deploy (re-run if `--no-wire` was used) | `--network`, `--source` |
| `caatinga sync-env` | Write `frontend.envFile` from artifacts | `--network` |
| `caatinga generate [contract]` | (Re)generate TypeScript bindings. Omit name = all deployed | `--network` |

### Diagnostics & Status

| Command | Purpose | Flags |
|---------|---------|-------|
| `caatinga doctor` | Check Node, Stellar CLI, Rust, config, artifacts, network, identity | `--network`, `--source` |
| `caatinga status` | Table of deployed contracts + binding freshness per network | `--network`, `--json` |

### Invocation

| Command | Purpose | Flags |
|---------|---------|-------|
| `caatinga invoke <contract.method>` | Sign + submit a state-changing call | `--network`, `--source`, `[args...]` |
| `caatinga read <contract.method>` | Simulate a read-only call (no signing) | `--network`, `[args...]` |

### ZK Commands

| Command | Purpose | Flags |
|---------|---------|-------|
| `caatinga zk build [circuit]` | Compile Circom + dev trusted setup | `--embed-vk` (experimental) |
| `caatinga zk prove [circuit]` | Generate `proof.json` + `public.json` | — |
| `caatinga zk invoke [circuit]` | Call on-chain `verify_proof` | `--source`, `--network` |

Shared ZK flags: `--allow-dev-ceremony` (bypass mainnet guardrails), `--embed-vk`.

### Important Rules

- `--source` must be a **local Stellar CLI identity alias** (e.g. `alice`), never a `G...` address, secret key (`S...`), or seed phrase.
- `caatinga deploy` auto-generates bindings unless `--no-generate` is passed.
- Full graph deploy (no contract name) auto-runs `wire` + `sync-env` unless `--no-wire` / `--no-sync-env` is passed.
- Transient testnet failures are retried with exponential backoff.
- `caatinga doctor` checks deploy coverage (which contracts are deployed) but never blocks on it.

---

## 4. Config Schema (`caatinga.config.ts`)

```ts
import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "my-dapp",               // required, string min 1
  defaultNetwork: "testnet",         // optional, default "testnet"

  contracts: {
    counter: {
      path: "./contracts/counter",   // required: contract source dir
      wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm",  // required: compiled WASM
      dependsOn: ["token"],          // optional: contracts deployed first
      deployArgs: {                  // optional: constructor args; supports placeholders
        tokenContractId: "${contracts.token.contractId}"
      }
    }
  },

  buildRoot: "./contracts",          // optional: Cargo workspace root for single stellar contract build

  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",  // required
      networkPassphrase: "Test SDF Network ; September 2015"  // required
    }
  },

  frontend: {
    framework: "vite-react",         // optional, default "vite-react"
    bindingsOutput: "./src/contracts/generated",  // required if frontend is set
    envFile: "./frontend/.env.local",            // optional: written by sync-env
    env: {                                        // optional: maps to env var names
      counter: "VITE_COUNTER_ID",
      rpcUrl: "VITE_RPC_URL",
      networkPassphrase: "VITE_NETWORK_PASSPHRASE"
    }
  },

  postDeploy: [                      // optional: admin-signed invokes after full deploy
    {
      contract: "counter",
      method: "initialize",
      args: { owner: "${source.address}" }
    }
  ],

  zk: {                              // optional: ZK circuit configuration
    circuits: {
      main: {
        path: "./circuits/main",
        protocol: "groth16",
        curve: "bls12381",
        verifierContract: "verifier"
      }
    }
  }
});
```

### Deploy args placeholder resolution

| Placeholder | Resolved to | Example |
|-------------|-------------|---------|
| `${contracts.<name>.contractId}` | Deployed contract ID from `caatinga.artifacts.json` | `${contracts.token.contractId}` |
| `${source.address}` | Stellar CLI identity address (`stellar keys address <source>`) | `${source.address}` |

Resolution happens after dependencies deploy. A cyclic dependency throws `CAATINGA_CONTRACT_DEPENDENCY_CYCLE`. An unresolvable placeholder throws `CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED`.

---

## 5. Artifacts Schema (`caatinga.artifacts.json`)

```json
{
  "project": "my-dapp",
  "version": 2,
  "networks": {
    "testnet": {
      "contracts": {
        "counter": {
          "contractId": "C...",
          "wasmHash": "...",
          "deployedAt": "2026-01-01T00:00:00.000Z",
          "sourcePath": "./contracts/counter",
          "wasmPath": "./contracts/counter/target/wasm32v1-none/release/counter.wasm",
          "dependencies": [],
          "resolvedDeployArgs": {}
        }
      },
      "dependencyGraph": {}
    }
  }
}
```

### ContractArtifact fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `contractId` | string | yes | On-chain deployed ID |
| `wasmHash` | string | yes | Hash of deployed WASM |
| `deployedAt` | ISO 8601 | yes | |
| `sourcePath` | string | yes | |
| `wasmPath` | string | yes | |
| `dependencies` | string[] | no, default `[]` | Resolved dependency contract names |
| `resolvedDeployArgs` | object | no, default `{}` | Deploy args after placeholder resolution |

Schema **v2** is current. v1 files are auto-readable. Run `caatinga migrate artifacts` to bump version without redeploying.

---

## 6. Client API (`@caatinga/client`)

### createCaatingaClient

```ts
import { createCaatingaClient } from "@caatinga/client";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

const client = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  artifacts,
  wallet: myWalletAdapter,            // CaatingaWalletAdapter
  contracts: {
    counter: {
      binding: Counter,                // generated binding (must export `Client`)
      contractId: "C...",             // optional: override artifacts lookup
    },
  },
  walletTimeout: 30_000,             // optional: ms timeout for wallet calls
});
```

### Contract methods

```ts
// Read-only — returns parsed value directly
const value = await client.contract("counter").read<number>("get");

// Simulate — returns full result with metadata
const sim = await client.contract("counter").simulate<number>("get", { debugRaw: true });

// State-changing — signs and submits
const result = await client.contract("counter").invoke<number>("increment");
// result = { status, contract, method, contractId, transactionHash, result? }

// With args
await client.contract("token").invoke("transfer", { to: addr, amount: 100n });

// Build XDR only (no sign, no submit)
const tx = await client.contract("counter").buildXdr("increment");
// tx = { unsignedXdr, preparedXdr }

// Debug XDR
const result = await client.contract("counter").invoke("increment", {
  debugXdr: true,   // includes xdr.unsigned, xdr.prepared, xdr.signed
  debugRaw: true,   // includes raw binding output
});
```

### Read vs Simulate vs Invoke

| API | Signs? | Submits? | Returns |
|-----|--------|----------|---------|
| `read()` | No | No | Parsed value directly |
| `simulate()` | No | No | `{ status, contractId, result, raw? }` |
| `invoke()` | Yes | Yes | `{ status, contractId, transactionHash, result?, xdr?, raw? }` |

### Wallet adapter interface

```ts
interface CaatingaWalletAdapter {
  getPublicKey(): Promise<string>;
  signTransaction(input: { xdr: string; networkPassphrase: string }): Promise<string>;
}
```

Rules:
- **Must reject on user dismissal** (never leave promise pending).
- Caatinga imposes no default timeout. Pass `walletTimeout` on config.

### Wallet session (framework-agnostic)

```ts
import { createWalletSession } from "@caatinga/client";

const session = createWalletSession(adapter, { persist: true });
session.subscribe(() => render(session.getState()));
await session.connect();   // modal when available, else getPublicKey
await session.restore();   // silent reconnect on page load — never rejects
await session.disconnect();
```

### React hooks

```tsx
import { WalletProvider, useWallet } from "@caatinga/client/react";

<WalletProvider adapter={wallet} options={{ persist: true }}>
  <App />
</WalletProvider>;

function App() {
  const { publicKey, connected, connecting, error, connect, disconnect } = useWallet();
  // ...
}
```

---

## 7. Error Codes

All errors use `CAATINGA_*` codes. **Automation must key on the code, never on message text.**

### Common CLI errors

| Code | Trigger |
|------|---------|
| `CAATINGA_CONFIG_NOT_FOUND` | `caatinga.config.ts` not found |
| `CAATINGA_INVALID_CONFIG` | Config failed validation |
| `CAATINGA_STELLAR_CLI_NOT_FOUND` | `stellar` binary not in PATH |
| `CAATINGA_BUILD_FAILED` | Contract build failed (Cargo error) |
| `CAATINGA_DEPLOY_FAILED` | Deploy failed (Stellar CLI error) |
| `CAATINGA_BINDINGS_FAILED` | Binding generation failed |
| `CAATINGA_INVOKE_FAILED` | Contract invoke failed |
| `CAATINGA_CONTRACT_NOT_FOUND` | Unknown contract name in config |
| `CAATINGA_NETWORK_NOT_FOUND` | Unknown `--network` value |
| `CAATINGA_ARTIFACT_NOT_FOUND` | Missing artifacts file or record |
| `CAATINGA_SOURCE_ACCOUNT_REQUIRED` | `--source` omitted |
| `CAATINGA_SOURCE_IS_SECRET_KEY` | `S...` passed as `--source` |
| `CAATINGA_SOURCE_IS_SEED_PHRASE` | Seed phrase passed as `--source` |
| `CAATINGA_SOURCE_IS_PUBLIC_KEY` | `G...` address passed as `--source` |
| `CAATINGA_INVOKE_TARGET_INVALID` | Target not in `contract.method` format |
| `CAATINGA_UNSUPPORTED_CLI_VERSION` | Stellar CLI below hard floor (23.0.0) |

### Multi-contract / dependency errors

| Code | Trigger |
|------|---------|
| `CAATINGA_CONTRACT_DEPENDENCY_NOT_FOUND` | `dependsOn` references unknown contract |
| `CAATINGA_CONTRACT_DEPENDENCY_CYCLE` | Circular dependency detected |
| `CAATINGA_CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND` | Dependency not deployed yet |
| `CAATINGA_DEPLOY_ARG_PLACEHOLDER_INVALID` | Malformed `${...}` placeholder |
| `CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED` | Placeholder not resolved at deploy time |
| `CAATINGA_SOURCE_ADDRESS_UNRESOLVED` | `${source.address}` used without `--source` |

### Client errors

| Code | Trigger |
|------|---------|
| `CAATINGA_CONTRACT_ARTIFACT_NOT_FOUND` | Contract not deployed on selected network |
| `CAATINGA_BINDING_CLIENT_NOT_FOUND` | Generated binding missing `Client` export |
| `CAATINGA_BINDING_METHOD_NOT_FOUND` | Method not found in binding |
| `CAATINGA_PLACEHOLDER_BINDING` | Still using scaffold placeholder; run `generate` |
| `CAATINGA_WALLET_NOT_CONNECTED` | `getPublicKey()` rejected |
| `CAATINGA_WALLET_TIMEOUT` | Wallet call exceeded `walletTimeout` |
| `CAATINGA_XDR_BUILD_FAILED` | Could not build transaction XDR |
| `CAATINGA_XDR_SIGN_FAILED` | Wallet rejected signing |
| `CAATINGA_XDR_SUBMIT_FAILED` | RPC rejected submission |
| `CAATINGA_READ_RESULT_MISSING` | Simulated read returned no result |
| `CAATINGA_MULTI_AUTH_REQUIRED` | Multi-signer needed; not supported until v1.0 |

### ZK errors

| Code | Trigger |
|------|---------|
| `CAATINGA_ZK_VERIFICATION_FAILED` | On-chain verify_proof returned false |
| `CAATINGA_ZK_DEV_CEREMONY_BLOCKED` | Dev ceremony artifacts on mainnet without `--allow-dev-ceremony` |

### Stellar CLI warnings (advisory, non-fatal)

| Code | Meaning |
|------|---------|
| `STELLAR_CLI_UNTESTED_VERSION` | CLI newer than last-tested version |
| `STELLAR_CLI_MISSING_FEATURE` | Required feature not advertised |

---

## 8. Key Gotchas & Rules

1. **`--source` must be a CLI identity alias** — never a `G...`, `S...`, or seed phrase.
2. **Deploy auto-generates bindings** — pass `--no-generate` to skip in CI.
3. **Full graph deploy auto-runs `wire` + `sync-env`** — pass `--no-wire` / `--no-sync-env` to skip.
4. **Browser invoke is single-invoker only until v1.0** — multi-signer (`signAuthEntry`) is application code and throws `CAATINGA_MULTI_AUTH_REQUIRED`.
5. **ZK on mainnet is blocked by default** — dev ceremony artifacts require `--allow-dev-ceremony` (not for production).
6. **zcash** — Install node 22+, `caatinga setup` does the rest.
7. **Errors are public API** — automation must parse `CAATINGA_*` codes, not message text.
8. **`read()` vs `invoke()`** — `read` = simulate (no sign), `invoke` = sign + submit.
9. **Wallet adapters must reject on dismissal** — never leave promise pending.
10. **`caatinga.artifacts.json` is git-versioned** — the artifacts file stays in your repo even if you stop using Caatinga.
11. **Binding freshness** is tracked by `.caatinga-bindings.json` marker. States: `fresh`, `stale`, `missing`, `unknown`.
12. **`caatinga doctor` deploy coverage is advisory** — never blocks exit code.
13. **Stellar CLI compatibility** — hard floor 23.0.0, last tested 25.2.0. Newer versions produce advisory warnings only.
14. **`buildRoot`** — when set, a single `stellar contract build` runs from the Cargo workspace root instead of per-contract builds.

---

## 9. Templates

| Template | Command | Description |
|----------|---------|-------------|
| `react-vite-counter` (default) | `caatinga init <dir>` | Vite + React + counter contract + wallet stubs |
| `zk-starter` | `caatinga zk init <dir>` | Circom multiplier circuit + Groth16 verifier |

Minimal scaffolds (CLI-only, no frontend):
```bash
caatinga init <dir> --minimal     # Soroban contract stub
caatinga zk init <dir> --minimal  # ZK-only with empty starter circuit
```

---

## 10. Binding Freshness

| State | Meaning | Fix |
|-------|---------|-----|
| `fresh` | Bindings match deployed `contractId` + `wasmHash` | — |
| `stale` | Contract redeployed since last generate | `caatinga generate <name> --network <net>` |
| `missing` | No bindings on disk | `caatinga generate` |
| `unknown` | Bindings exist but predate freshness tracking | Regenerate once |

Freshness tracked via `.caatinga-bindings.json` marker next to each generated binding package.

---

## 11. Project File Layout

```
my-dapp/
├── caatinga.config.ts           # Config: contracts, networks, frontend
├── caatinga.artifacts.json      # Deployed contract IDs per network
├── contracts/
│   └── counter/                 # Soroban Rust contract
│       ├── Cargo.toml
│       └── src/lib.rs
├── src/
│   ├── contracts/generated/     # TypeScript bindings (auto-generated)
│   │   └── counter/
│   │       ├── src/index.ts
│   │       └── .caatinga-bindings.json  # freshness marker
│   ├── caatinga.ts              # Client wiring (static imports)
│   └── App.tsx
└── package.json
```
