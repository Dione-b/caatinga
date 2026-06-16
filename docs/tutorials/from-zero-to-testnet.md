# From Zero to Testnet

This tutorial takes a new Caatinga project from scaffold to a deployed Soroban counter contract on Stellar testnet.

During alpha, use npm **`next`** for `@caatinga/cli`, `@caatinga/core`, `@caatinga/client`, and `@caatinga/zk`. Currently **`2.4.0`** on `next`; `latest` remains **`2.2.1`**.

## Prerequisites

Install Node.js 20+ and Rust first. Then install the supported Stellar CLI and Wasm target:

```bash
npm install -g @caatinga/cli@next
cargo install --locked stellar-cli --version 25.2.0
rustup target add wasm32v1-none
stellar --version
rustc --version
```

Confirm the published versions (`next` is currently **`2.4.0`**):

```bash
npm view @caatinga/cli@next version
npm view @caatinga/core@next version
npm view @caatinga/client@next version
```

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

Without a global CLI install, run `npx caatinga@latest init my-dapp` instead of `caatinga init`.

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

✓ Node.js 20.11.0
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

Browser code can compose artifacts, generated bindings, network config, and a wallet adapter:

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter/src/index.js";
import artifacts from "../caatinga.artifacts.json";

const client = createCaatingaClient({
  network: { name: "testnet", rpcUrl: "https://soroban-testnet.stellar.org", networkPassphrase: "Test SDF Network ; September 2015" },
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
- `npm audit` reports vulnerabilities after install: the official template blocks unused SWK deps
  (Trezor/HOT/Safe) via overrides so **critical** `protobufjs` findings from Trezor should not appear.
  Remaining low-severity items may still come from WalletConnect/Reown. Regenerate from a current
  template or copy the override blocks from [Templates](../templates.md#pnpm-1026--11x).
- `CAATINGA_ARTIFACT_NOT_FOUND` on deploy: WASM was not built yet. Run `npx caatinga build <contract>` before `deploy`.
  After a successful build, ensure `caatinga.config.ts` points to `target/wasm32v1-none/release/*.wasm`. Caatinga `0.2.2+` resolves legacy `wasm32-unknown-unknown` paths automatically.
- `CAATINGA_DOCTOR_PARTIAL_DEPLOY`: one or more configured contracts lack a `contractId` on the selected network. Run the `caatinga deploy` commands printed by `caatinga doctor --network <name>`.
- `CAATINGA_STELLAR_CLI_NOT_FOUND`: install Stellar CLI and ensure `stellar` is on `PATH`.
- `CAATINGA_UNSUPPORTED_CLI_VERSION`: install Stellar CLI 23.0.0 or newer (25.2.0 recommended). Versions newer than the last-tested 25.2.0 run with a non-fatal stderr advisory; no override flag is required.
- `CAATINGA_RUST_TARGET_NOT_FOUND`: run `rustup target add wasm32v1-none`.
- `CAATINGA_NETWORK_NOT_FOUND`: add the network to `caatinga.config.ts` or pass a configured `--network`.
- `CAATINGA_UNSAFE_SOURCE_ACCOUNT`: pass a local Stellar CLI identity such as `alice`, not a public `G...` address or secret.
