# Dogfood Simple dApp (Sprint 41)

Timed walkthrough using **only published APIs** — no monorepo `workspace:*` links.

## Goal

`init → build → deploy → generate → invoke → React dev` on testnet in under 60 minutes (target: 30 minutes with toolchain installed).

## Prerequisites

- Node.js 22+
- Packed tarballs: `pnpm build && pnpm pack:packages` from the Caatinga repo

## Steps

```bash
# 1. Isolated project directory
mkdir -p ~/caatinga-dogfood-simple && cd ~/caatinga-dogfood-simple
npm init -y

# 2. Install from packed tarballs (adjust paths)
npm install /path/to/caatinga/packed/caatinga-cli-3.8.0.tgz -g
# or local: npm install ./packed/caatinga-cli-3.8.0.tgz

# 3. Scaffold
npx ctg init counter-dapp --template react-vite-counter
cd counter-dapp
npm install

# 4. Verify toolchain (skip if already verified)
npx ctg doctor --network testnet --source alice

# 5. Build and deploy
npx ctg build counter
npx ctg deploy counter --network testnet --source alice

# 6. Generate bindings
npx ctg generate counter --network testnet

# 7. CLI invoke smoke
npx ctg read counter.get --network testnet

# 8. Browser
cp .env.example .env   # set VITE_WALLETCONNECT_PROJECT_ID if using SWK
npm run dev
```

## What to record

- Time per step
- First `CAATINGA_*` error (if any)
- Commands that required docs lookup

File findings in [dogfood-backlog.md](../../docs/dogfood-backlog.md).

## In-monorepo shortcut (maintainers only)

```bash
pnpm --filter counter-web dev
```

This uses workspace links and does **not** satisfy Sprint 41 acceptance — use the tarball flow above for validation.
