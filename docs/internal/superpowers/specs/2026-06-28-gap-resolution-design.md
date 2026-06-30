# Caatinga Gap Resolution — Design Spec

> Resolves Gaps 1, 3, 5, 8, and 13 from `docs/internal/CAATINGA_GAPS.md`.
>
> **Date:** 2026-06-28
> **Status:** Draft

---

## 1. Overview

Five P0/P1 gaps in Caatinga that block Radox testnet adoption. All changes are
backwards-compatible — existing configs continue to work without modification.

| Gap   | Problem                                      | Solution                                            |
| ----- | -------------------------------------------- | --------------------------------------------------- |
| 1 & 8 | Build features not configurable per contract | `buildFeatures` string array on `ContractConfig`    |
| 3     | WASM hashes not exported to frontend `.env`  | `${contract.wasmHash}` source key in `frontend.env` |
| 5     | PostDeploy hooks share single `--source`     | `source` override per hook                          |
| 13    | No post-deploy verification asserts          | `expect` field on hooks with placeholder resolution |

---

## 2. Gap 1 & 8 — Build Features Per Contract

### Current behavior

`buildContract()` in `packages/core/src/contracts/build-contract.ts:50` invokes:

```ts
runCommand("stellar", ["contract", "build"], { cwd: contract.sourcePath });
```

No flags are passed. All contracts compile with default Cargo features.

### Proposed change

Add optional `buildFeatures` to `ContractConfigSchema`:

```ts
export const ContractConfigSchema = z.object({
  path: z.string().min(1),
  wasm: z.string().min(1),
  dependsOn: z.array(z.string().min(1)).default([]),
  deployArgs: z.record(z.string().min(1), DeployArgValueSchema).default({}),
  buildFeatures: z.array(z.string().min(1)).optional(), // NEW
});
```

Usage in `caatinga.config.ts`:

```ts
contracts: {
  token_sale: {
    path: './contracts/token_sale',
    wasm: './target/wasm32v1-none/release/token_sale.wasm',
    buildFeatures: ['--no-default-features', '--features', 'testnet'],
  },
  yield_distributor: {
    path: './contracts/yield_distributor',
    wasm: './target/wasm32v1-none/release/yield_distributor.wasm',
    // no buildFeatures → uses defaults
  },
}
```

### Implementation

**`packages/core/src/contracts/build-contract.ts`** — line 50:

```ts
// Before
runCommand("stellar", ["contract", "build"], { cwd: contract.sourcePath });

// After
const contractConfig = options.config.contracts[options.contractName];
const buildArgs = ["contract", "build", ...(contractConfig.buildFeatures ?? [])];
runCommand("stellar", buildArgs, { cwd: contract.sourcePath });
```

**`packages/core/src/contracts/build-workspace.ts`** — workspace builds invoke
`stellar contract build` once from the workspace root. Cargo features are per-crate,
so `buildFeatures` is **ignored** for workspace builds. Add a warning if any contract
has `buildFeatures` configured with `buildRoot` set.

### Files to modify

| File                                                 | Change                                |
| ---------------------------------------------------- | ------------------------------------- |
| `packages/core/src/config/config.schema.ts`          | Add `buildFeatures` field             |
| `packages/core/src/contracts/build-contract.ts`      | Pass `buildFeatures` to CLI           |
| `packages/core/src/contracts/build-workspace.ts`     | Warn if `buildFeatures` + `buildRoot` |
| `packages/core/src/config/config.schema.test.ts`     | Test `buildFeatures` parsing          |
| `packages/core/src/contracts/build-contract.test.ts` | Test flags passed to stellar          |

---

## 3. Gap 3 — WASM Hash in sync-env

### Current behavior

`syncFrontendEnv()` in `packages/core/src/frontend/sync-frontend-env.ts:56-79`
resolves source keys as:

- `"rpcUrl"` → network RPC URL
- `"networkPassphrase"` → network passphrase
- Anything else → contract ID lookup

### Proposed change

Support `${contractName.wasmHash}` syntax in `frontend.env` source keys:

```ts
frontend: {
  envFile: './backend/.env',
  env: {
    token_sale: 'SALE_CONTRACT_ID',           // contract ID (existing)
    'token_sale.wasmHash': 'SALE_WASM_HASH',  // WASM hash (new)
    yield_distributor: 'YIELD_CONTRACT_ID',
    'yield_distributor.wasmHash': 'YIELD_WASM_HASH',
    rpcUrl: 'RPC_URL',
  },
}
```

### Implementation

**`packages/core/src/frontend/sync-frontend-env.ts`** — extend the resolution
logic at lines 56-79:

```ts
const WASM_HASH_PATTERN = /^(.+)\.wasmHash$/;

for (const [sourceKey, envKey] of Object.entries(frontend.env)) {
  let value: string | undefined;

  if (sourceKey === "rpcUrl") {
    value = network.config.rpcUrl;
  } else if (sourceKey === "networkPassphrase") {
    value = network.config.networkPassphrase;
  } else if (NETWORK_ENV_KEYS.has(sourceKey)) {
    throw new CaatingaError(/* ... */);
  } else {
    // Check for .wasmHash suffix
    const wasmHashMatch = sourceKey.match(WASM_HASH_PATTERN);
    const lookupKey = wasmHashMatch ? wasmHashMatch[1] : sourceKey;

    const contractArtifact = networkArtifacts.contracts[lookupKey];
    if (!contractArtifact?.contractId) {
      throw new CaatingaError(/* ... */);
    }

    value = wasmHashMatch ? contractArtifact.wasmHash : contractArtifact.contractId;
  }

  entries.push({ key: envKey, value });
}
```

### Files to modify

| File                                                   | Change                    |
| ------------------------------------------------------ | ------------------------- |
| `packages/core/src/frontend/sync-frontend-env.ts`      | Add `wasmHash` resolution |
| `packages/core/src/frontend/sync-frontend-env.test.ts` | Test wasmHash sync        |

---

## 4. Gap 5 — PostDeploy Source Override

### Current behavior

All hooks in `runPostDeployHooks()` use the same `source` passed via `--source`
CLI flag (line 118 of `run-post-deploy.ts`):

```ts
"--source-account",
source,
```

### Proposed change

Add optional `source` field to `PostDeployHookSchema`:

```ts
const PostDeployHookSchema = z.object({
  contract: z.string().min(1),
  method: z.string().min(1),
  args: z.record(z.string().min(1), DeployArgValueSchema).default({}),
  source: z.string().min(1).optional(), // NEW: override --source for this hook
});
```

Usage:

```ts
postDeploy: [
  { contract: "yield_distributor", method: "initialize", args: { admin: "${source.address}" } },
  {
    contract: "yield_distributor",
    method: "propose_admin",
    args: { new_admin: "${env.ISSUER_ADDRESS}" },
    source: "issuer",
  },
];
```

### Implementation

**`packages/core/src/contracts/run-post-deploy.ts`** — modify the invoke block
(lines 108-128) to use per-hook source:

```ts
// Resolve effective source for this hook
const hookSource = hook.source ?? source;  // fallback to CLI --source

// In the invoke call:
"--source-account",
hookSource,
```

The `resolveDeployArgs` call (line 85) must also use `hookSource` for `${source.address}`
resolution.

### Files to modify

| File                                                  | Change                                 |
| ----------------------------------------------------- | -------------------------------------- |
| `packages/core/src/config/config.schema.ts`           | Add `source` to `PostDeployHookSchema` |
| `packages/core/src/contracts/run-post-deploy.ts`      | Use per-hook source                    |
| `packages/core/src/contracts/run-post-deploy.test.ts` | Test per-hook source override          |

---

## 5. Gap 13 — PostDeploy Verify Asserts

### Current behavior

`runPostDeployHooks()` executes each hook and records the stdout result. No
verification is performed against the output.

### Proposed change

Add optional `expect` field to `PostDeployHookSchema`:

```ts
const PostDeployHookSchema = z.object({
  contract: z.string().min(1),
  method: z.string().min(1),
  args: z.record(z.string().min(1), DeployArgValueSchema).default({}),
  source: z.string().min(1).optional(),
  expect: z.string().optional(), // NEW: expected output after invoke
});
```

When `expect` is set, the hook result is compared against the resolved expected
value. If they don't match, the hook fails with a verification error.

Usage:

```ts
postDeploy: [
  { contract: "yield_distributor", method: "initialize", args: { admin: "${source.address}" } },
  { contract: "yield_distributor", method: "get_admin", expect: "${source.address}" },
];
```

### Implementation

**`packages/core/src/config/config.schema.ts`** — add `expect` field.

**`packages/core/src/contracts/run-post-deploy.ts`** — after the invoke succeeds
(line 152), add verification:

```ts
// After successful invoke
if (hook.expect !== undefined) {
  const resolvedExpect = await resolveDeployArgs({
    deployArgs: { expected: hook.expect },
    artifacts,
    network: network.name,
    source: hookSource,
    cwd,
  });

  const actual = (result.stdout || result.all || "").trim();
  const expected = String(resolvedExpect.expected).trim();

  if (actual !== expected) {
    throw new CaatingaError(
      `Post-deploy verification failed for "${hook.contract}.${hook.method}".`,
      CaatingaErrorCode.POST_DEPLOY_VERIFY_FAILED,
      `Expected "${expected}" but got "${actual}".`
    );
  }
}
```

Add new error code `POST_DEPLOY_VERIFY_FAILED` to `CaatingaErrorCode`.

### Files to modify

| File                                                  | Change                               |
| ----------------------------------------------------- | ------------------------------------ |
| `packages/core/src/config/config.schema.ts`           | Add `expect` field                   |
| `packages/core/src/errors/CaatingaError.ts`           | Add `POST_DEPLOY_VERIFY_FAILED` code |
| `packages/core/src/contracts/run-post-deploy.ts`      | Add verify step                      |
| `packages/core/src/contracts/run-post-deploy.test.ts` | Test verify pass/fail                |

---

## 6. Error Codes

New error code to add to `CaatingaErrorCode` in `packages/core/src/errors/CaatingaError.ts`:

```ts
POST_DEPLOY_VERIFY_FAILED = "POST_DEPLOY_VERIFY_FAILED",
```

---

## 7. Testing Strategy

Each gap gets colocated tests following existing patterns:

- **Config schema tests** (`config.schema.test.ts`): validate new fields parse correctly
- **Build tests** (`build-contract.test.ts`): verify flags passed to stellar CLI
- **Wire tests** (`run-post-deploy.test.ts`): test per-hook source and verify asserts
- **Sync-env tests** (`sync-frontend-env.test.ts`): test wasmHash resolution

Run `pnpm test` and `pnpm typecheck` before committing.

---

## 8. Backwards Compatibility

All changes are additive and optional:

- `buildFeatures` defaults to `undefined` → no flags added
- `source` on hooks defaults to `undefined` → uses CLI `--source`
- `expect` on hooks defaults to `undefined` → no verification
- `wasmHash` source key is opt-in via `frontend.env` config

Existing `caatinga.config.ts` files work without modification.

---

## 9. Out of Scope

These gaps are **not addressed** (backend-only or per-offer concerns):

- Gap 2: Per-offer deploy with deterministic salt
- Gap 4: Docker secret signing
- Gap 6: Multi-batch distribution with Redis
- Gap 7: Per-offer deploy via REST API
- Gap 9: Precompute contractId offline
- Gap 10: Frontend wallet provider migration
- Gap 11: Passkey/WebAuthn signing
- Gap 12: Multi-sig with Freighter/Ledger
- Gap 14: WASM upload without deploy
- Gap 15: On-chain crash recovery verification
