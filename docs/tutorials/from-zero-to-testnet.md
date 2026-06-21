# From Zero to Testnet

This tutorial takes a new Caatinga project from scaffold to a deployed Soroban counter contract on Stellar testnet.

Install `@caatinga/cli`, `@caatinga/core`, `@caatinga/client`, and `@caatinga/zk` from npm. The current line is **`3.2.0`** on **`next`** (`latest` is **`3.1.2`** until promoted).

## Prerequisites

Install Node.js 22+ and Rust first. Then install the supported Stellar CLI and Wasm target:

```bash
npm install -g @caatinga/cli
cargo install --locked stellar-cli --version 25.2.0
rustup target add wasm32v1-none
stellar --version
rustc --version
```

Confirm the published dist-tags and versions:

```bash
npm view @caatinga/cli dist-tags
npm view @caatinga/cli version
npm view @caatinga/core version
npm view @caatinga/client version
```

For the current line, prefer `npm install -g @caatinga/cli@next` or `@3.2.0`.

Create and fund a local Stellar CLI identity:

```bash
stellar keys generate alice --fund --network testnet
```

`--source` must be a local Stellar CLI identity, not a public `G...` address. Caatinga rejects public addresses for deploy/invoke because those operations need a signer.

## Create the Project

```bash
caatinga init my-dapp
cd my-dapp
npm install
```

`pnpm install` also works. The default `react-vite-counter` template includes `pnpm-workspace.yaml` for pnpm 10.26+/11.x (see [Templates](../templates.md#pnpm-1026--11x)).

Without a global CLI install, run `npx caatinga@3.2.0 init my-dapp` (or `npx caatinga@next init my-dapp`) instead of `caatinga init`.

The default template creates:

- `caatinga.config.ts` with contracts, output paths, and networks.
- `caatinga.artifacts.json` for per-network deployed contract IDs.
- `contracts/` with Rust Soroban contract source.
- `src/` with frontend/client code.

## Verify the Environment

```bash
npx caatinga doctor --network testnet --source alice
```

Expected shape:

```txt
Caatinga Doctor

✓ Node.js 22
✓ Stellar CLI 25.2.0
✓ Rust 1.84.0
✓ wasm32v1-none target installed
✓ caatinga.config.ts found
✓ caatinga.artifacts.json found
✓ network testnet found
✓ source identity alice found

Status: ready
```

If `caatinga doctor` reports `✓ Stellar CLI 26.0.0 (1 warning)` followed by a
`STELLAR_CLI_UNTESTED_VERSION` bullet, the command is still `ready` — that warning is
advisory and does not block deploys, generates, or invokes. See the
[Stellar CLI version contract](../stellar-cli-version-contract.md) for the warning
semantics.

If Stellar CLI is missing, install it:

```bash
cargo install --locked stellar-cli --version 25.2.0
```

If the Wasm target is missing, install it:

```bash
rustup target add wasm32v1-none
```

## Build, Deploy, Invoke

```bash
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga invoke counter.increment --network testnet --source alice
```

`deploy` saves the deployed `contractId` under the selected network in `caatinga.artifacts.json`
and then **generates TypeScript bindings automatically** under the bindings directory configured
in `caatinga.config.ts`. Pass `--no-generate` to skip generation; if generation fails the deploy
still succeeds and the CLI prints the recovery command (`npx caatinga generate --network testnet`).

Check the result at any time:

```bash
npx caatinga status --network testnet
```

The table shows each contract's contract ID, whether it is deployed, and whether its bindings are
still fresh (a redeploy marks them `stale` until the next generate).

To redeploy even when an artifact already contains a contract ID:

```bash
npx caatinga deploy counter --network testnet --source alice --force
```

## Use the Contract in a Client

After deploy (which generated the bindings), install the browser packages from `next`:

```bash
npm install @caatinga/client @caatinga/core @creit.tech/stellar-wallets-kit
```

Browser code can compose artifacts, generated bindings, network config, and a wallet adapter (**single-invoker only until v1.0** — see [Client scope](../client.md#single-invoker-scope-until-v10)):

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

const client = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  artifacts,
  wallet: createStellarWalletsKitAdapter(),
  contracts: { counter: { binding: Counter } },
});

const before = await client.contract("counter").read<number>("get");
const increment = await client.contract("counter").invoke<number>("increment");
```

For the full client contract, XDR debug options, and wallet adapter rules, see [Client](../client.md).
For wallet sessions, persistence, and the React `WalletProvider`/`useWallet` hooks used by the
default template, see [Wallets](../wallets.md).

## Troubleshooting

- `ERR_PNPM_IGNORED_BUILDS` (esbuild): pnpm 11 blocks lifecycle scripts by default. Ensure `pnpm-workspace.yaml` contains `allowBuilds.esbuild: true` (already in the official `react-vite-counter` template).
  If you ran `pnpm approve-builds` interactively, replace any placeholder value with the boolean `true` — incomplete approval leaves invalid YAML.
- Deprecated `uuid` warnings on install: the official `react-vite-counter` template pins `uuid@^14` via `package.json` overrides. Regenerate from a current template or add the same override if you created the project before this change.
- Deprecated `@safe-global/safe-gateway-typescript-sdk` on install: optional Safe packages from Reown
  AppKit (via Stellar Wallets Kit). The official template blocks them with npm/pnpm overrides —
  regenerate from a current template or copy the Safe override block from
  [Templates](../templates.md#pnpm-1026--11x).
- `npm audit` reports **~14 high** vulnerabilities after install: the usual cause is transitive
  **`ws@<8.21.0`** via `@creit.tech/stellar-wallets-kit` → Reown AppKit → `viem`
  ([GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)), **not** Trezor.
  Official templates pin `"ws": "^8.21.0"` in npm/pnpm overrides. Regenerate from a current
  template or copy the override block from
  [Templates — Install override contract](../templates.md#install-time-dependency-overrides-maintainer-contract).
  Verify with `npm install && npm audit`.
- `npm audit` reports **critical** `protobufjs` findings: Trezor Connect was not stubbed.
  Official templates replace `@trezor/connect-web` with local stubs under `src/stubs/` — Caatinga
  does not support hardware wallets yet. See the same
  [override contract](../templates.md#install-time-dependency-overrides-maintainer-contract).
- `CAATINGA_ARTIFACT_NOT_FOUND` on deploy: WASM was not built yet. Run `npx caatinga build <contract>` before `deploy`.
  After a successful build, ensure `caatinga.config.ts` points to `target/wasm32v1-none/release/*.wasm`. Caatinga `0.2.2+` resolves legacy `wasm32-unknown-unknown` paths automatically.
  If you have `CARGO_TARGET_DIR` set, Stellar CLI writes the Wasm under that directory instead of `contracts/<name>/target`. Caatinga `2.4.1+` resolves the Wasm from `CARGO_TARGET_DIR` automatically, but if it still fails, unset `CARGO_TARGET_DIR` or update the `wasm` path in `caatinga.config.ts`.
- Partial deploy coverage: `caatinga doctor` prints missing `contractId`s as an advisory section (exit code stays `0` when the toolchain is ready). Run the `caatinga deploy` commands it suggests before invoke/read on testnet.
- `CAATINGA_STELLAR_CLI_NOT_FOUND`: install Stellar CLI and ensure `stellar` is on `PATH`.
- `CAATINGA_UNSUPPORTED_CLI_VERSION`: install Stellar CLI 23.0.0 or newer (25.2.0 recommended). Versions newer than the last-tested 25.2.0 run with a non-fatal stderr advisory; no override flag is required.
- `CAATINGA_RUST_TARGET_NOT_FOUND`: run `rustup target add wasm32v1-none`.
- `CAATINGA_NETWORK_NOT_FOUND`: add the network to `caatinga.config.ts` or pass a configured `--network`.
- `CAATINGA_UNSAFE_SOURCE_ACCOUNT`: pass a local Stellar CLI identity such as `alice`, not a public `G...` address or secret.
