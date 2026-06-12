---
"@caatinga/cli": minor
"@caatinga/core": minor
"@caatinga/client": minor
---

DX refactor: deploy auto-generates bindings, `caatinga status`, wallet sessions + React hooks.

**Behavior change — `caatinga deploy` now generates TypeScript bindings automatically** for the
contracts it deploys. Pass `--no-generate` to keep the old deploy-only behavior (recommended for
CI jobs that deploy without binding prerequisites). A generation failure never fails the deploy:
the CLI prints a warning and the recovery command (`npx caatinga generate --network <network>`).

CLI:

- New `caatinga status [--network <name>] [--json]` command: per-network table of deployed
  contracts, contract IDs, WASM hashes, dependencies, and binding freshness.
- `caatinga doctor --network <name>` prints an advisory `Bindings (<network>)` section with
  per-contract freshness (never blocks).
- `caatinga generate` (all-contracts mode) prints binding freshness before regenerating.

Core:

- Binding freshness tracking via a `.caatinga-bindings.json` sidecar marker written next to each
  generated binding package (records `contractId`, `wasmHash`, network, `generatedAt`). New
  exports: `evaluateBindingFreshness`, `evaluateBindingsFreshness`, `readBindingMarker`,
  `writeBindingMarker`, `collectProjectStatus`.
- `generateBindingsGraph` accepts `contractNames` to regenerate a specific subset.

Client:

- `createWalletSession(adapter, options?)`: framework-agnostic wallet connection state
  (`disconnected`/`connecting`/`connected`), subscriptions, optional `localStorage` persistence,
  and silent `restore()` for page-load reconnects.
- New `@caatinga/client/react` subpath with `WalletProvider`, `useWallet`, and
  `useWalletSession` (optional `react >= 18` peer dependency).
- Stellar Wallets Kit adapter exposes `getWalletId()` so sessions can persist and re-select the
  chosen wallet.
- The `react-vite-counter` template and `examples/counter-web` now use the provider/hook instead
  of a hand-rolled wallet context.
