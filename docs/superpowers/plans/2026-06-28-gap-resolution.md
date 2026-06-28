# Caatinga Gap Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve gaps 1, 3, 5, 8, and 13 from the Radox gap analysis by adding buildFeatures, wasmHash sync, per-hook source, and post-deploy verification to Caatinga's config schema and core logic.

**Architecture:** All changes are additive and backwards-compatible. New optional fields on existing Zod schemas (`ContractConfigSchema`, `PostDeployHookSchema`) propagate through config parsing, build, wire, and sync-env. Each gap gets colocated tests.

**Tech Stack:** TypeScript, Zod, Vitest, pnpm monorepo

---

## File Map

| File                                                   | Change                                         |
| ------------------------------------------------------ | ---------------------------------------------- |
| `packages/core/src/config/config.schema.ts`            | Add `buildFeatures`, `source`, `expect` fields |
| `packages/core/src/errors/CaatingaErrorCode.ts`        | Add `POST_DEPLOY_VERIFY_FAILED`                |
| `packages/core/src/contracts/build-contract.ts`        | Pass `buildFeatures` to stellar CLI            |
| `packages/core/src/contracts/build-workspace.ts`       | Warn if `buildFeatures` + `buildRoot`          |
| `packages/core/src/contracts/run-post-deploy.ts`       | Per-hook source + verify step                  |
| `packages/core/src/frontend/sync-frontend-env.ts`      | Resolve `wasmHash` source keys                 |
| `packages/core/src/config/config.schema.test.ts`       | Test new schema fields                         |
| `packages/core/src/contracts/build-contract.test.ts`   | Test buildFeatures passed to CLI               |
| `packages/core/src/contracts/run-post-deploy.test.ts`  | Test per-hook source + verify                  |
| `packages/core/src/frontend/sync-frontend-env.test.ts` | Test wasmHash sync                             |

---

## Task 1: Add `buildFeatures` to ContractConfigSchema

**Files:**

- Modify: `packages/core/src/config/config.schema.ts:5-10`
- Test: `packages/core/src/config/config.schema.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/config/config.schema.test.ts` after the existing `accepts workspace buildRoot` test (line 112):

```ts
it("accepts buildFeatures array on a contract", () => {
  const result = CaatingaConfigSchema.parse({
    ...minimalValid,
    contracts: {
      token_sale: {
        path: "./contracts/token_sale",
        wasm: "./target/wasm32v1-none/release/token_sale.wasm",
        buildFeatures: ["--no-default-features", "--features", "testnet"],
      },
    },
  });

  expect(result.contracts.token_sale.buildFeatures).toEqual([
    "--no-default-features",
    "--features",
    "testnet",
  ]);
});

it("buildFeatures defaults to undefined when omitted", () => {
  const result = CaatingaConfigSchema.parse(minimalValid);
  expect(result.contracts.counter.buildFeatures).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @caatinga/core test -- config.schema.test`
Expected: FAIL — `buildFeatures` is not a recognized property

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/config/config.schema.ts`, add `buildFeatures` to `ContractConfigSchema` (line 9, before the closing brace):

```ts
export const ContractConfigSchema = z.object({
  path: z.string().min(1),
  wasm: z.string().min(1),
  dependsOn: z.array(z.string().min(1)).default([]),
  deployArgs: z.record(z.string().min(1), DeployArgValueSchema).default({}),
  buildFeatures: z.array(z.string().min(1)).optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @caatinga/core test -- config.schema.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/config.schema.ts packages/core/src/config/config.schema.test.ts
git commit -m "feat(core): add buildFeatures field to ContractConfigSchema"
```

---

## Task 2: Pass `buildFeatures` to stellar CLI in buildContract

**Files:**

- Modify: `packages/core/src/contracts/build-contract.ts:41-68`
- Test: `packages/core/src/contracts/build-contract.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/contracts/build-contract.test.ts` after the existing `should_run_stellar_contract_build` test (line 69):

```ts
it("should_pass_buildFeatures_flags_to_stellar_contract_build", async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-build-"));
  const sourceDir = path.join(tmpDir, "contracts", "counter");
  const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(path.dirname(wasmPath), { recursive: true });
  await writeFile(wasmPath, Buffer.from([0x00, 0x61, 0x73, 0x6d]), "binary");

  const config: CaatingaConfig = {
    ...baseConfig,
    contracts: {
      counter: {
        ...baseConfig.contracts.counter,
        buildFeatures: ["--no-default-features", "--features", "testnet"],
      },
    },
  };

  await buildContract({
    config,
    contractName: "counter",
    cwd: tmpDir,
  });

  expect(runCommand).toHaveBeenCalledWith(
    "stellar",
    ["contract", "build", "--no-default-features", "--features", "testnet"],
    {
      cwd: sourceDir,
      failureCode: CaatingaErrorCode.BUILD_FAILED,
    }
  );
});

it("should_not_pass_flags_when_buildFeatures_is_omitted", async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-build-"));
  const sourceDir = path.join(tmpDir, "contracts", "counter");
  const wasmPath = path.join(tmpDir, "rel", "counter.wasm");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(path.dirname(wasmPath), { recursive: true });
  await writeFile(wasmPath, Buffer.from([0x00, 0x61, 0x73, 0x6d]), "binary");

  await buildContract({
    config: baseConfig,
    contractName: "counter",
    cwd: tmpDir,
  });

  expect(runCommand).toHaveBeenCalledWith("stellar", ["contract", "build"], {
    cwd: sourceDir,
    failureCode: CaatingaErrorCode.BUILD_FAILED,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @caatinga/core test -- build-contract.test`
Expected: FAIL — `buildFeatures` not passed to `runCommand`

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/contracts/build-contract.ts`, replace line 50:

```ts
// Before (line 50):
result = await runCommand("stellar", ["contract", "build"], {
  cwd: contract.sourcePath,
  failureCode: CaatingaErrorCode.BUILD_FAILED,
});

// After:
const contractConfig = options.config.contracts[options.contractName];
const buildArgs = ["contract", "build", ...(contractConfig.buildFeatures ?? [])];
result = await runCommand("stellar", buildArgs, {
  cwd: contract.sourcePath,
  failureCode: CaatingaErrorCode.BUILD_FAILED,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @caatinga/core test -- build-contract.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/contracts/build-contract.ts packages/core/src/contracts/build-contract.test.ts
git commit -m "feat(core): pass buildFeatures flags to stellar contract build"
```

---

## Task 3: Warn if `buildFeatures` + `buildRoot` in buildWorkspace

**Files:**

- Modify: `packages/core/src/contracts/build-workspace.ts:41-63`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/contracts/build-workspace.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand,
}));

import { buildWorkspace } from "./build-workspace.js";

describe("buildWorkspace", () => {
  let tmpDir: string;

  beforeEach(() => {
    runCommand.mockReset();
    runCommand.mockResolvedValue({ stdout: "ok", stderr: "", all: "ok" });
  });

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_warn_when_buildRoot_and_buildFeatures_coexist", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-ws-"));
    const wasmPath = path.join(tmpDir, "target", "wasm32v1-none", "release", "counter.wasm");
    await mkdir(path.dirname(wasmPath), { recursive: true });
    await writeFile(wasmPath, Buffer.from([0x00, 0x61, 0x73, 0x6d]), "binary");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config: CaatingaConfig = {
      project: "app",
      defaultNetwork: "testnet",
      buildRoot: ".",
      contracts: {
        counter: {
          path: "./contracts/counter",
          wasm: "./target/wasm32v1-none/release/counter.wasm",
          buildFeatures: ["--no-default-features", "--features", "testnet"],
        },
      },
      networks: {
        testnet: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      },
    };

    await buildWorkspace({ config, cwd: tmpDir });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("buildFeatures"));
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @caatinga/core test -- build-workspace.test`
Expected: FAIL — no warning emitted

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/contracts/build-workspace.ts`, add after line 51 (after the `buildRoot` check):

```ts
const hasBuildFeatures = Object.values(options.config.contracts).some(
  (c) => c.buildFeatures && c.buildFeatures.length > 0
);
if (hasBuildFeatures) {
  console.warn(
    "Warning: buildFeatures is set on one or more contracts but is ignored in workspace builds (buildRoot). " +
      "Use individual contract builds (caatinga build <contract>) to apply buildFeatures."
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @caatinga/core test -- build-workspace.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/contracts/build-workspace.ts packages/core/src/contracts/build-workspace.test.ts
git commit -m "feat(core): warn when buildFeatures is set with workspace buildRoot"
```

---

## Task 4: Add `wasmHash` resolution to syncFrontendEnv

**Files:**

- Modify: `packages/core/src/frontend/sync-frontend-env.ts:56-79`
- Test: `packages/core/src/frontend/sync-frontend-env.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/frontend/sync-frontend-env.test.ts` after the existing test (line 91):

```ts
it("writes wasmHash values when source key uses .wasmHash suffix", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-sync-env-"));
  tempDirs.push(cwd);

  const wasmHashConfig: CaatingaConfig = {
    ...config,
    frontend: {
      framework: "vite-react",
      bindingsOutput: "./frontend/src/contracts",
      envFile: "./frontend/.env.local",
      env: {
        coin: "VITE_COIN",
        "coin.wasmHash": "VITE_COIN_WASM_HASH",
        rpcUrl: "VITE_RPC_URL",
      },
    },
  };

  await writeArtifacts(
    {
      project: "stellar-album",
      version: 1,
      networks: {
        testnet: {
          contracts: {
            coin: {
              contractId: "CCOINCONTRACTID",
              wasmHash: "abcdef1234567890",
              deployedAt: "2026-06-25T00:00:00.000Z",
              sourcePath: "./contracts/coin",
              wasmPath: "./target/wasm32v1-none/release/coin.wasm",
              dependencies: [],
              resolvedDeployArgs: {},
            },
          },
          dependencyGraph: { coin: [] },
        },
      },
    },
    cwd
  );

  const result = await syncFrontendEnv({ config: wasmHashConfig, cwd });
  const contents = await readFile(result.envFile, "utf8");

  expect(result.entries).toEqual([
    { key: "VITE_COIN", value: "CCOINCONTRACTID" },
    { key: "VITE_COIN_WASM_HASH", value: "abcdef1234567890" },
    { key: "VITE_RPC_URL", value: "https://soroban-testnet.stellar.org" },
  ]);
  expect(contents).toContain("VITE_COIN_WASM_HASH=abcdef1234567890");
});

it("fails when .wasmHash source key references unknown contract", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-sync-env-"));
  tempDirs.push(cwd);

  const badConfig: CaatingaConfig = {
    ...config,
    frontend: {
      framework: "vite-react",
      bindingsOutput: "./frontend/src/contracts",
      envFile: "./frontend/.env.local",
      env: {
        "unknown.wasmHash": "VITE_UNKNOWN_HASH",
      },
    },
  };

  await writeArtifacts(
    {
      project: "stellar-album",
      version: 1,
      networks: {
        testnet: {
          contracts: {},
          dependencyGraph: {},
        },
      },
    },
    cwd
  );

  await expect(syncFrontendEnv({ config: badConfig, cwd })).rejects.toMatchObject({
    code: CaatingaErrorCode.ARTIFACT_NOT_FOUND,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @caatinga/core test -- sync-frontend-env.test`
Expected: FAIL — `wasmHash` suffix not handled

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/frontend/sync-frontend-env.ts`, add the pattern constant after line 19:

```ts
const WASM_HASH_PATTERN = /^(.+)\.wasmHash$/;
```

Replace the resolution loop (lines 56-82) with:

```ts
for (const [sourceKey, envKey] of Object.entries(frontend.env)) {
  let value: string | undefined;

  if (sourceKey === "rpcUrl") {
    value = network.config.rpcUrl;
  } else if (sourceKey === "networkPassphrase") {
    value = network.config.networkPassphrase;
  } else if (NETWORK_ENV_KEYS.has(sourceKey)) {
    throw new CaatingaError(
      `Unsupported frontend env source key "${sourceKey}".`,
      CaatingaErrorCode.INVALID_CONFIG,
      "Use rpcUrl or networkPassphrase for network values."
    );
  } else {
    const wasmHashMatch = sourceKey.match(WASM_HASH_PATTERN);
    const lookupKey = wasmHashMatch ? wasmHashMatch[1] : sourceKey;

    const contractArtifact = networkArtifacts.contracts[lookupKey];
    if (!contractArtifact?.contractId) {
      throw new CaatingaError(
        `No deployed artifact found for "${lookupKey}" on "${network.name}".`,
        CaatingaErrorCode.ARTIFACT_NOT_FOUND,
        `Deploy ${lookupKey} before running caatinga sync-env.`
      );
    }

    value = wasmHashMatch ? contractArtifact.wasmHash : contractArtifact.contractId;
  }

  entries.push({ key: envKey, value });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @caatinga/core test -- sync-frontend-env.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/frontend/sync-frontend-env.ts packages/core/src/frontend/sync-frontend-env.test.ts
git commit -m "feat(core): support wasmHash source key in frontend env sync"
```

---

## Task 5: Add `source` override to PostDeployHookSchema

**Files:**

- Modify: `packages/core/src/config/config.schema.ts:30-34`
- Test: `packages/core/src/config/config.schema.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/config/config.schema.test.ts` after the existing postDeploy test (line 112):

```ts
it("accepts per-hook source override", () => {
  const result = CaatingaConfigSchema.parse({
    ...minimalValid,
    postDeploy: [
      {
        contract: "counter",
        method: "initialize",
        args: {},
        source: "issuer",
      },
    ],
  });

  expect(result.postDeploy![0].source).toBe("issuer");
});

it("per-hook source defaults to undefined when omitted", () => {
  const result = CaatingaConfigSchema.parse({
    ...minimalValid,
    postDeploy: [
      {
        contract: "counter",
        method: "initialize",
        args: {},
      },
    ],
  });

  expect(result.postDeploy![0].source).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @caatinga/core test -- config.schema.test`
Expected: FAIL — `source` is not a recognized property

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/config/config.schema.ts`, add `source` to `PostDeployHookSchema` (line 33, before the closing brace):

```ts
const PostDeployHookSchema = z.object({
  contract: z.string().min(1),
  method: z.string().min(1),
  args: z.record(z.string().min(1), DeployArgValueSchema).default({}),
  source: z.string().min(1).optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @caatinga/core test -- config.schema.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/config.schema.ts packages/core/src/config/config.schema.test.ts
git commit -m "feat(core): add per-hook source override to PostDeployHookSchema"
```

---

## Task 6: Use per-hook source in runPostDeployHooks

**Files:**

- Modify: `packages/core/src/contracts/run-post-deploy.ts:85-128`
- Test: `packages/core/src/contracts/run-post-deploy.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/contracts/run-post-deploy.test.ts` after the existing tests (line 133):

```ts
it("should_use_hook_source_override_when_provided", async () => {
  const configWithSourceOverride: CaatingaConfig = {
    ...config,
    postDeploy: [{ contract: "coin", method: "set_minter", args: {}, source: "issuer" }],
  };

  const result = await runPostDeployHooks({
    config: configWithSourceOverride,
    source: "alice",
    cwd: tmpDir,
    hookRetryDelaysMs: [0],
  });

  expect(result).toEqual([{ contract: "coin", method: "set_minter", result: undefined }]);

  const invokeCalls = runCommand.mock.calls.filter(
    ([command, args]: [string, string[]]) =>
      command === "stellar" && args[0] === "contract" && args[1] === "invoke"
  );
  expect(invokeCalls).toHaveLength(1);
  expect(invokeCalls[0][1]).toContain("--source-account");
  expect(invokeCalls[0][1]).toContain("issuer");
});

it("should_fallback_to_cli_source_when_hook_source_is_omitted", async () => {
  const result = await runPostDeployHooks({
    config,
    source: "alice",
    cwd: tmpDir,
    hookRetryDelaysMs: [0],
  });

  expect(result).toEqual([{ contract: "coin", method: "set_minter", result: undefined }]);

  const invokeCalls = runCommand.mock.calls.filter(
    ([command, args]: [string, string[]]) =>
      command === "stellar" && args[0] === "contract" && args[1] === "invoke"
  );
  expect(invokeCalls).toHaveLength(1);
  expect(invokeCalls[0][1]).toContain("--source-account");
  expect(invokeCalls[0][1]).toContain("alice");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @caatinga/core test -- run-post-deploy.test`
Expected: FAIL — hook source not used

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/contracts/run-post-deploy.ts`, modify the hook loop (around line 85-128):

Replace the `resolveDeployArgs` call and invoke block with:

```ts
const hookSource = hook.source ?? source;

const resolvedArgs = await resolveDeployArgs({
  deployArgs: hook.args,
  artifacts,
  network: network.name,
  source: hookSource,
  cwd,
});

// ... (placeholder check stays the same)

const namedArgs = formatNamedCliArgs(resolvedArgs);
// ... (retry loop stays the same, but change line 118):

// Before:
"--source-account",
source,

// After:
"--source-account",
hookSource,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @caatinga/core test -- run-post-deploy.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/contracts/run-post-deploy.ts packages/core/src/contracts/run-post-deploy.test.ts
git commit -m "feat(core): use per-hook source override in post-deploy hooks"
```

---

## Task 7: Add `expect` field to PostDeployHookSchema

**Files:**

- Modify: `packages/core/src/config/config.schema.ts:30-34`
- Test: `packages/core/src/config/config.schema.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/config/config.schema.test.ts` after the per-hook source tests:

```ts
it("accepts expect field on postDeploy hook", () => {
  const result = CaatingaConfigSchema.parse({
    ...minimalValid,
    postDeploy: [
      {
        contract: "counter",
        method: "get_admin",
        expect: "${source.address}",
      },
    ],
  });

  expect(result.postDeploy![0].expect).toBe("${source.address}");
});

it("expect defaults to undefined when omitted", () => {
  const result = CaatingaConfigSchema.parse({
    ...minimalValid,
    postDeploy: [
      {
        contract: "counter",
        method: "initialize",
        args: {},
      },
    ],
  });

  expect(result.postDeploy![0].expect).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @caatinga/core test -- config.schema.test`
Expected: FAIL — `expect` is not a recognized property

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/config/config.schema.ts`, add `expect` to `PostDeployHookSchema`:

```ts
const PostDeployHookSchema = z.object({
  contract: z.string().min(1),
  method: z.string().min(1),
  args: z.record(z.string().min(1), DeployArgValueSchema).default({}),
  source: z.string().min(1).optional(),
  expect: z.string().optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @caatinga/core test -- config.schema.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/config.schema.ts packages/core/src/config/config.schema.test.ts
git commit -m "feat(core): add expect field to PostDeployHookSchema"
```

---

## Task 8: Add `POST_DEPLOY_VERIFY_FAILED` error code

**Files:**

- Modify: `packages/core/src/errors/CaatingaErrorCode.ts:57-58`

- [ ] **Step 1: Write the failing test**

No separate test needed — the error code is a const value. Verify it compiles in Task 9.

- [ ] **Step 2: Write minimal implementation**

In `packages/core/src/errors/CaatingaErrorCode.ts`, add before the closing `} as const` (line 58):

```ts
POST_DEPLOY_VERIFY_FAILED: "CAATINGA_POST_DEPLOY_VERIFY_FAILED",
```

- [ ] **Step 3: Run typecheck to verify it compiles**

Run: `pnpm --filter @caatinga/core typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/errors/CaatingaErrorCode.ts
git commit -m "feat(core): add POST_DEPLOY_VERIFY_FAILED error code"
```

---

## Task 9: Add verify step to runPostDeployHooks

**Files:**

- Modify: `packages/core/src/contracts/run-post-deploy.ts:152-158`
- Test: `packages/core/src/contracts/run-post-deploy.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/contracts/run-post-deploy.test.ts` after the source override tests:

```ts
it("should_pass_when_expect_matches_invoke_output", async () => {
  runCommand.mockImplementation(async (command: string, args: string[]) => {
    if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
      return { stdout: "CADMINADDRESS123", stderr: "", all: "CADMINADDRESS123" };
    }
    return { stdout: "stellar 23.0.0", stderr: "", all: "stellar 23.0.0" };
  });

  const configWithExpect: CaatingaConfig = {
    ...config,
    postDeploy: [{ contract: "coin", method: "get_admin", args: {}, expect: "CADMINADDRESS123" }],
  };

  const result = await runPostDeployHooks({
    config: configWithExpect,
    source: "alice",
    cwd: tmpDir,
    hookRetryDelaysMs: [0],
  });

  expect(result).toEqual([{ contract: "coin", method: "get_admin", result: "CADMINADDRESS123" }]);
});

it("should_throw_when_expect_does_not_match_invoke_output", async () => {
  runCommand.mockImplementation(async (command: string, args: string[]) => {
    if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
      return { stdout: "COTHERADDRESS", stderr: "", all: "COTHERADDRESS" };
    }
    return { stdout: "stellar 23.0.0", stderr: "", all: "stellar 23.0.0" };
  });

  const configWithExpect: CaatingaConfig = {
    ...config,
    postDeploy: [{ contract: "coin", method: "get_admin", args: {}, expect: "CADMINADDRESS123" }],
  };

  await expect(
    runPostDeployHooks({
      config: configWithExpect,
      source: "alice",
      cwd: tmpDir,
      hookRetryDelaysMs: [0],
    })
  ).rejects.toMatchObject({ code: "CAATINGA_POST_DEPLOY_VERIFY_FAILED" });
});

it("should_resolve_source_address_placeholder_in_expect", async () => {
  runCommand.mockImplementation(async (command: string, args: string[]) => {
    if (command === "stellar" && args[0] === "keys" && args[1] === "address") {
      return { stdout: "GALICEADDRESS123", stderr: "", all: "GALICEADDRESS123" };
    }
    if (command === "stellar" && args[0] === "contract" && args[1] === "invoke") {
      return { stdout: "GALICEADDRESS123", stderr: "", all: "GALICEADDRESS123" };
    }
    return { stdout: "stellar 23.0.0", stderr: "", all: "stellar 23.0.0" };
  });

  const configWithExpect: CaatingaConfig = {
    ...config,
    postDeploy: [{ contract: "coin", method: "get_admin", args: {}, expect: "${source.address}" }],
  };

  const result = await runPostDeployHooks({
    config: configWithExpect,
    source: "alice",
    cwd: tmpDir,
    hookRetryDelaysMs: [0],
  });

  expect(result).toEqual([{ contract: "coin", method: "get_admin", result: "GALICEADDRESS123" }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @caatinga/core test -- run-post-deploy.test`
Expected: FAIL — no verify step implemented

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/contracts/run-post-deploy.ts`, add after the invoke success (after line 152, before `results.push`):

```ts
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

Also add the import at the top of the file if not already present:

```ts
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
```

(This import already exists at line 3.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @caatinga/core test -- run-post-deploy.test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/contracts/run-post-deploy.ts packages/core/src/contracts/run-post-deploy.test.ts
git commit -m "feat(core): add post-deploy verify step with expect assertions"
```

---

## Task 10: Run full test suite and typecheck

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `pnpm format`
Expected: No changes or auto-fixes applied

- [ ] **Step 4: Final commit if lint made changes**

```bash
git add -A
git commit -m "chore: format after gap resolution"
```
