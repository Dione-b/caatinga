# Caatinga Audit Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 13 maturity-audit gaps (G01–G13) across v1 gate, beta, and technical-debt tiers so Track B readiness, consumer tests, and public error contracts are honest and actionable.

**Architecture:** Keep changes inside existing package boundaries (`@caatinga/core` orchestration, thin `@caatinga/cli`, `@caatinga/client` interop). Prefer colocated Vitest tests, documented `CAATINGA_*` codes, and bash CI gates over new abstractions. Correct spec drift: tests live beside `packages/core/src/**`, not under `packages/core/test/shell/`; error enum is `CaatingaErrorCode.ts`; source validation is `contracts/source-account.ts`.

**Tech Stack:** TypeScript ESM, pnpm 9.15.4, Turbo, Vitest, tsup, Commander CLI, Vite 6, Changesets, bash CI scripts.

**Origin spec:** User-provided *Caatinga — Audit Gaps Spec* (May 2026). Implement tiers in order: **Gate v1 (G01–G05)** → **Beta (G06–G09)** → **Debt (G10–G13)**. G13 should land on a dedicated branch after G04 if G04 still uses a local Vite shim.

**Recommended worktree:** Create an isolated worktree before starting (superpowers:using-git-worktrees).

---

## File map (by gap)

| Gap | Create | Modify |
|-----|--------|--------|
| G01 | `docs/superpowers/specs/00-v1-viability-index.md` | — |
| G02 | `scripts/check-fixture-references.sh`, `packages/core/src/stellar-cli/deploy-failure.fixtures.test.ts` | `package.json`, `docs/testing.md` |
| G03 | `packages/core/src/contracts/deploy-contract-graph.types.ts` (optional; types can live in graph file) | `deploy-contract-graph.ts`, `deploy-contract-graph.test.ts`, `deploy.command.ts`, `packages/core/src/index.ts`, `docs/cli.md` |
| G04 | `packages/templates/react-vite-counter/src/caatinga.ts`, `src/caatinga-core-browser.ts`, `src/hooks/useCaatingaCounter.ts` (names flexible) | `CounterCard.tsx`, `WalletButton.tsx`, `vite.config.ts`, `scripts/consumer-isolation-test.sh`, `docs/templates.md` |
| G05 | — | `CaatingaErrorCode.ts`, `contracts/source-account.ts`, `doctor.command.ts`, `source-account.test.ts`, `doctor.command.test.ts`, `error-surface.test.ts`, `docs/errors.md` |
| G06 | — | `packages/client/src/types.ts`, `caatinga-contract-client.ts`, `create-caatinga-client.ts`, tests, `CaatingaErrorCode.ts`, `docs/client.md`, `docs/errors.md` |
| G07 | — | `packages/client/src/xdr/build-xdr.ts`, `caatinga-contract-client.ts`, tests |
| G08 | `packages/cli/src/commands/doctor-deploy-coverage.ts` (helper) | `doctor.command.ts`, `doctor.command.test.ts`, `CaatingaErrorCode.ts`, `docs/cli.md`, `docs/errors.md` |
| G09 | — | `caatinga-contract-client.ts`, `caatinga-contract-client.test.ts` |
| G10 | — | `deploy-contract.ts`, `wasm.ts`, `deploy-contract.test.ts`, `deploy.command.ts`, `docs/cli.md` |
| G11 | `packages/core/src/contracts/verify-dependency-contract.ts` | `deploy-contract-graph.ts`, `deploy.command.ts`, `resolve-deploy-args.ts` (if needed), tests, docs |
| G12 | — | `packages/cli/CHANGELOG.md`, `packages/core/CHANGELOG.md`, `packages/client/CHANGELOG.md`, `docs/release.md` |
| G13 | `packages/core/src/browser.ts` | `packages/core/package.json`, client imports, `consumer-client-bundlers-test.sh`, `docs/client.md`, `docs/templates.md`, template shim → browser entry |

---

## Tier 1 — Gate v1 (G01–G05)

### Task 1: G01 — Create `00-v1-viability-index.md`

**Files:**
- Create: `docs/superpowers/specs/00-v1-viability-index.md`
- Verify: `docs/release/v1-readiness.md` (link already points here)

- [ ] **Step 1: Create index file**

Create `docs/superpowers/specs/00-v1-viability-index.md`:

```markdown
# v1 Viability Index

Track B in [`docs/release/v1-readiness.md`](../../release/v1-readiness.md) requires all five specs below to be **implemented and accepted** before `latest` is unfrozen.

| # | Spec | Path | Status |
|---|------|------|--------|
| 1 | Stellar CLI version contract | [`docs/stellar-cli-version-contract.md`](../../stellar-cli-version-contract.md) | Accepted |
| 2 | Public `CAATINGA_*` error surface | [`docs/errors.md`](../../errors.md), [`docs/adr/0004-error-codes-as-public-api.md`](../../adr/0004-error-codes-as-public-api.md) | Accepted |
| 3 | npm publish & consumer isolation | [`docs/superpowers/plans/2026-05-13-npm-publish-consumer-isolation.md`](../plans/2026-05-13-npm-publish-consumer-isolation.md) | Accepted |
| 4 | Live testnet smoke CI | [`.github/workflows/testnet-smoke.yml`](../../../.github/workflows/testnet-smoke.yml), [`docs/testing.md`](../../testing.md) | Accepted |
| 5 | Multi-contract dependency deploy | [`docs/adr/0005-multi-contract-dependency-deploy.md`](../../adr/0005-multi-contract-dependency-deploy.md) | Accepted (experimental template) |

Implementation history: [`docs/superpowers/plans/2026-05-12-v1-viability.md`](../plans/2026-05-12-v1-viability.md).

Do not tag `v1.0.0` / publish `latest` until Track B evidence in [`docs/release/v1-readiness.md`](../../release/v1-readiness.md) is complete.
```

- [ ] **Step 2: Verify link resolves**

Run:

```bash
test -f docs/superpowers/specs/00-v1-viability-index.md
rg -n "00-v1-viability-index" docs/release/v1-readiness.md
```

Expected: file exists; grep shows one reference.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/00-v1-viability-index.md
git commit -m "docs: add v1 viability index anchor for Track B gates"
```

---

### Task 2: G02 — Fixture reference CI gate + deploy-failure test

**Files:**
- Create: `scripts/check-fixture-references.sh`
- Create: `packages/core/src/stellar-cli/deploy-failure.fixtures.test.ts`
- Modify: `package.json` (root)
- Modify: `docs/testing.md`

**Note:** There is no `parseDeployOutput` module today. Deploy failures surface via `runCommand` → `CAATINGA_DEPLOY_FAILED` with CLI stderr in `hint`. The orphan fixture documents **simulation failure without contract ID** — wire it to `parseContractId` (must throw `CONTRACT_ID_NOT_FOUND`) plus a comment pointing to `runCommand` for exit-code failures.

- [ ] **Step 1: Write failing fixture reference test (script)**

Create `scripts/check-fixture-references.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_ROOT="$ROOT_DIR/packages/core/test/fixtures/stellar-cli"
SEARCH_ROOT="$ROOT_DIR/packages/core"

missing=0

while IFS= read -r -d '' fixture; do
  rel="${fixture#"$FIXTURE_ROOT/"}"
  base="$(basename "$rel")"
  if rg -q --fixed-strings "$rel" "$SEARCH_ROOT" --glob '*.test.ts' 2>/dev/null; then
    continue
  fi
  if rg -q --fixed-strings "$base" "$SEARCH_ROOT" --glob '*.test.ts' 2>/dev/null; then
    continue
  fi
  echo "Orphan fixture (no reference in packages/core/**/*.test.ts): $rel" >&2
  missing=1
done < <(find "$FIXTURE_ROOT" -type f ! -name '.gitkeep' -print0)

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "check-fixture-references: OK"
```

Run:

```bash
chmod +x scripts/check-fixture-references.sh
bash scripts/check-fixture-references.sh
```

Expected: **FAIL** (exit 1) mentioning `v26.0.0/deploy-failure.txt` until Step 3.

- [ ] **Step 2: Write failing Vitest for deploy-failure fixture**

Create `packages/core/src/stellar-cli/deploy-failure.fixtures.test.ts`:

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { parseContractId } from "./parse-contract-id.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "../../test/fixtures/stellar-cli");

async function fixture(relativePath: string): Promise<string> {
  return readFile(path.join(fixturesDir, relativePath), "utf8");
}

describe("deploy failure fixtures", () => {
  it("should_not_parse_contract_id_from_v26_deploy_failure_fixture", async () => {
    const output = await fixture("v26.0.0/deploy-failure.txt");

    expect(() => parseContractId(output)).toThrow(
      expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_ID_NOT_FOUND })
    );
  });

  it("should_document_simulation_failure_text_in_fixture", async () => {
    const output = await fixture("v26.0.0/deploy-failure.txt");

    expect(output).toMatch(/simulation failed/i);
  });
});
```

Run:

```bash
pnpm --filter @caatinga/core exec vitest run src/stellar-cli/deploy-failure.fixtures.test.ts -v
```

Expected: PASS (fixture file already exists).

- [ ] **Step 3: Re-run fixture gate**

```bash
bash scripts/check-fixture-references.sh
```

Expected: `check-fixture-references: OK`

- [ ] **Step 4: Wire into CI**

In root `package.json`, add script and extend `ci:publish-matrix`:

```json
"check:fixtures": "bash scripts/check-fixture-references.sh",
"ci:publish-matrix": "bash scripts/check-version-alignment.sh && bash scripts/check-ci-stellar-pin.sh && bash scripts/check-fixture-references.sh && pnpm build && pnpm test && ..."
```

Run:

```bash
pnpm check:fixtures
```

Expected: exit 0.

- [ ] **Step 5: Update docs/testing.md**

Add under “When adding parser behavior”:

```markdown
CI runs `pnpm check:fixtures` (`scripts/check-fixture-references.sh`) to fail on orphaned files under `packages/core/test/fixtures/stellar-cli/`.
```

- [ ] **Step 6: Commit**

```bash
git add scripts/check-fixture-references.sh packages/core/src/stellar-cli/deploy-failure.fixtures.test.ts package.json docs/testing.md
git commit -m "test(core): gate orphaned stellar-cli fixtures and cover deploy-failure fixture"
```

---

### Task 3: G03 — Visible skip in deploy graph + CLI

**Files:**
- Modify: `packages/core/src/contracts/deploy-contract-graph.ts`
- Modify: `packages/core/src/contracts/deploy-contract-graph.test.ts`
- Modify: `packages/cli/src/commands/deploy.command.ts`
- Modify: `packages/cli/src/commands/deploy.command.test.ts` (create if missing)
- Modify: `packages/core/src/index.ts` (export types if public)
- Modify: `docs/cli.md`

- [ ] **Step 1: Write failing graph test for skippedContracts**

In `packages/core/src/contracts/deploy-contract-graph.test.ts`, add:

```typescript
it("should_report_skipped_contracts_when_artifact_already_has_contract_id", async () => {
  const existingId = "C".padEnd(56, "X");
  readArtifactsMock.mockResolvedValue({
    project: "marketplace-app",
    version: 1,
    networks: {
      testnet: {
        contracts: { token: { contractId: existingId } },
        dependencyGraph: {}
      }
    }
  });

  const result = await deployContractGraph({
    config: {
      ...config,
      contracts: {
        token: config.contracts.token
      }
    },
    contractName: "token",
    networkName: "testnet",
    source: "alice",
    cwd: "/tmp/app",
    includeDependencies: true,
    force: false
  });

  expect(deployContractMock).not.toHaveBeenCalled();
  expect(result.skippedContracts).toEqual([
    expect.objectContaining({
      name: "token",
      contractId: existingId,
      reason: "already-deployed"
    })
  ]);
  expect(result.deployedContracts).toEqual([]);
});
```

Run:

```bash
pnpm --filter @caatinga/core exec vitest run src/contracts/deploy-contract-graph.test.ts -v
```

Expected: FAIL (`skippedContracts` undefined).

- [ ] **Step 2: Implement skippedContracts in graph**

Update `deploy-contract-graph.ts`:

```typescript
export type SkippedContract = {
  name: string;
  contractId: string;
  network: string;
  reason: "already-deployed";
};

export type DeployContractGraphResult = {
  network: ResolvedNetwork;
  deployedContracts: Array<{ name: string; contractId: string }>;
  skippedContracts: SkippedContract[];
};

// Inside loop, replace early continue block:
if (existing?.contractId && !options.force) {
  skippedContracts.push({
    name: contractName,
    contractId: existing.contractId,
    network: network.name,
    reason: "already-deployed"
  });
  continue;
}

// When deployContract returns skipped: true, also push to skippedContracts
// (unify paths — remove duplicate skip only in graph OR only in deployContract;
//  prefer: graph pre-check + deployContract skip both append to skippedContracts)
```

Initialize `const skippedContracts: SkippedContract[] = []` before the loop; return both arrays.

Adjust existing tests to expect `skippedContracts: []` when none skipped.

- [ ] **Step 3: Write failing CLI test (optional snapshot)**

Create `packages/cli/src/commands/deploy.command.test.ts` with mocked `deployContractGraph` returning one skipped + one deployed; assert logger output contains `[skipped]`.

- [ ] **Step 4: Implement CLI output**

In `deploy.command.ts` after success:

```typescript
for (const skipped of result.skippedContracts) {
  logger.info(`[skipped] ${skipped.name} — already deployed on ${result.network.name}`);
  logger.info(`  Contract ID: ${skipped.contractId}`);
}
for (const contract of result.deployedContracts) {
  logger.info(`[deployed] ${contract.name}`);
  logger.info(`  Contract ID: ${contract.contractId}`);
}
```

Keep `logger.success("Deploy complete")` as command completion, not “all newly deployed”.

- [ ] **Step 5: Document in docs/cli.md**

Add subsection under `caatinga deploy`:

```markdown
When a contract already has a `contractId` in `caatinga.artifacts.json` for the selected network, Caatinga prints `[skipped]` and does not call Stellar CLI unless `--force` is set.
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @caatinga/core test -- src/contracts/deploy-contract-graph.test.ts
pnpm --filter @caatinga/cli test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/contracts/deploy-contract-graph.ts packages/core/src/contracts/deploy-contract-graph.test.ts packages/cli/src/commands/deploy.command.ts docs/cli.md
git commit -m "feat(core): surface skipped contracts in deploy graph and CLI output"
```

---

### Task 4: G04 — Wire `@caatinga/client` into react-vite-counter template

**Files:**
- Create: `packages/templates/react-vite-counter/src/caatinga-core-browser.ts`
- Create: `packages/templates/react-vite-counter/src/caatinga.ts`
- Modify: `packages/templates/react-vite-counter/vite.config.ts`
- Modify: `packages/templates/react-vite-counter/src/components/CounterCard.tsx`
- Modify: `packages/templates/react-vite-counter/src/components/WalletButton.tsx`
- Modify: `scripts/consumer-isolation-test.sh`
- Modify: `docs/templates.md`

**Prerequisite note:** Until G13 lands, use the same local shim pattern as `examples/counter-web` (duplicate minimal `CaatingaError` / `CaatingaErrorCode` in template — do **not** import full `@caatinga/core` in browser graph).

- [ ] **Step 1: Add browser shim + Vite alias**

Copy pattern from `examples/counter-web/src/caatinga-core-browser.ts` into `packages/templates/react-vite-counter/src/caatinga-core-browser.ts`.

Update `vite.config.ts`:

```typescript
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@caatinga/core": path.resolve(__dirname, "src/caatinga-core-browser.ts")
    }
  }
});
```

- [ ] **Step 2: Create `src/caatinga.ts` client factory**

```typescript
import { createCaatingaClient } from "@caatinga/client";
import { freighterWalletAdapter } from "@caatinga/client/freighter";
import artifacts from "../caatinga.artifacts.json";
import * as Counter from "./contracts/generated/counter";

export const caatingaClient = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  },
  artifacts,
  wallet: freighterWalletAdapter,
  contracts: {
    counter: { binding: Counter }
  }
});
```

Add placeholder `src/contracts/generated/counter.ts` minimal `Client` export (like `examples/counter-web`) so template builds **before** user runs `caatinga generate`.

- [ ] **Step 3: Replace mock UI with real wallet + invoke path**

`WalletButton.tsx`: call `freighterWalletAdapter.getPublicKey()`; show connected address or error.

`CounterCard.tsx`: on Increment, `await caatingaClient.contract("counter").invoke("increment")` with loading/error state; display `CAATINGA_*` code from `CaatingaError`.

- [ ] **Step 4: Extend consumer-isolation test**

After `npm run build` in `test-app`, add:

```bash
if ! grep -r 'createCaatingaClient' test-app/dist/ >/dev/null 2>&1; then
  echo "Bundled template dist missing createCaatingaClient" >&2
  exit 1
fi
```

- [ ] **Step 5: Document shim in docs/templates.md**

```markdown
Browser-facing templates must alias `@caatinga/core` to a browser-safe shim (see `react-vite-counter/vite.config.ts`). After `@caatinga/core/browser` ships, prefer that entry over local duplicates.
```

- [ ] **Step 6: Verify**

```bash
pnpm --filter @caatinga/core test
cd packages/templates/react-vite-counter && npm install && npm run build
pnpm test:consumer
```

Expected: template build passes; consumer grep passes.

- [ ] **Step 7: Commit**

```bash
git add packages/templates/react-vite-counter scripts/consumer-isolation-test.sh docs/templates.md
git commit -m "feat(templates): wire react-vite-counter to @caatinga/client and gate bundle"
```

---

### Task 5: G05 — Split `UNSAFE_SOURCE_ACCOUNT` into specific codes

**Files:**
- Modify: `packages/core/src/errors/CaatingaErrorCode.ts`
- Modify: `packages/core/src/contracts/source-account.ts`
- Modify: `packages/cli/src/commands/doctor.command.ts`
- Modify: `packages/core/src/contracts/source-account.test.ts`
- Modify: `packages/cli/src/commands/doctor.command.test.ts`
- Modify: `packages/core/src/errors/error-surface.test.ts`
- Modify: `packages/core/src/errors/error-codes.test.ts`
- Modify: `docs/errors.md`

- [ ] **Step 1: Write failing tests for new codes**

In `packages/core/src/contracts/source-account.test.ts`:

```typescript
it("should_throw_SOURCE_IS_PUBLIC_KEY_when_G_address", () => {
  expect(() =>
    assertSafeSourceAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")
  ).toThrowError(
    expect.objectContaining({ code: CaatingaErrorCode.SOURCE_IS_PUBLIC_KEY })
  );
});

it("should_throw_SOURCE_IS_SECRET_KEY_when_S_address", () => {
  expect(() =>
    assertSafeSourceAccount("SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
  ).toThrowError(
    expect.objectContaining({ code: CaatingaErrorCode.SOURCE_IS_SECRET_KEY })
  );
});

it("should_throw_SOURCE_IS_SEED_PHRASE_when_input_has_spaces", () => {
  expect(() => assertSafeSourceAccount("my seed phrase")).toThrowError(
    expect.objectContaining({ code: CaatingaErrorCode.SOURCE_IS_SEED_PHRASE })
  );
});
```

Run:

```bash
pnpm --filter @caatinga/core exec vitest run src/contracts/source-account.test.ts -v
```

Expected: FAIL (codes missing).

- [ ] **Step 2: Add codes to CaatingaErrorCode.ts**

```typescript
SOURCE_IS_SECRET_KEY: "CAATINGA_SOURCE_IS_SECRET_KEY",
SOURCE_IS_SEED_PHRASE: "CAATINGA_SOURCE_IS_SEED_PHRASE",
SOURCE_IS_PUBLIC_KEY: "CAATINGA_SOURCE_IS_PUBLIC_KEY",
// keep UNSAFE_SOURCE_ACCOUNT for unknown unsafe shapes if needed
```

- [ ] **Step 3: Implement in source-account.ts**

Replace single branch with ordered checks (`S…`, spaces, `G…` via `isLikelyPublicKeySource`) and distinct hints per spec.

- [ ] **Step 4: Mirror in doctor validateSourceShape**

Import shared helper from `contracts/source-account.ts` (extract `validateSourceShape` to core to avoid duplication):

```typescript
// packages/core/src/contracts/validate-source-shape.ts
export function validateSourceShape(source: string): CaatingaError | undefined { ... }
```

Use in both doctor and `assertSafeSourceAccount`.

- [ ] **Step 5: Update error-surface.test.ts + docs/errors.md**

Add rows for three codes; map each to `source-account.test.ts` triggers.

- [ ] **Step 6: Run full core tests**

```bash
pnpm --filter @caatinga/core test
pnpm --filter @caatinga/cli test
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/errors packages/core/src/contracts/source-account.ts packages/cli/src/commands/doctor.command.ts docs/errors.md
git commit -m "feat(core): split unsafe --source errors into specific CAATINGA codes"
```

---

## Tier 2 — Beta (G06–G09)

### Task 6: G06 — Wallet adapter contract + optional `walletTimeout`

**Files:**
- Modify: `packages/client/src/types.ts`
- Modify: `packages/client/src/client/caatinga-contract-client.ts`
- Modify: `packages/client/src/client/create-caatinga-client.test.ts`
- Modify: `packages/core/src/errors/CaatingaErrorCode.ts`
- Modify: `docs/client.md`, `docs/errors.md`

- [ ] **Step 1: Write failing timeout test**

```typescript
it("should_reject_with_WALLET_TIMEOUT_when_sign_never_resolves", async () => {
  vi.useFakeTimers();
  const config = createClientConfig({
    walletTimeout: 50,
    wallet: {
      getPublicKey: vi.fn(async () => "GPUBLIC"),
      signTransaction: vi.fn(() => new Promise(() => {}))
    }
  });
  const client = createCaatingaClient(config);
  const promise = client.contract("counter").invoke("increment");
  await vi.advanceTimersByTimeAsync(50);
  await expect(promise).rejects.toMatchObject({
    code: CaatingaErrorCode.WALLET_TIMEOUT
  });
  vi.useRealTimers();
});
```

- [ ] **Step 2: Add `walletTimeout?: number` to `CaatingaClientConfig`**

- [ ] **Step 3: Implement `withWalletTimeout` private method in `CaatingaContractClient`**

Wrap `getPublicKey` and `signTransaction` (spec sketch in audit — use `CaatingaError` + `WALLET_TIMEOUT`).

- [ ] **Step 4: Document adapter contract in docs/client.md**

Section **Implementing a wallet adapter**:
- Must reject on user dismissal (do not hang unresolved).
- Caatinga does not impose a default timeout; optional `walletTimeout` on client config.

Add JSDoc on `CaatingaWalletAdapter` in `types.ts`.

- [ ] **Step 5: Register code in error-surface + docs/errors.md**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(client): optional walletTimeout and document adapter rejection contract"
```

---

### Task 7: G07 — Include `rpcUrl` in XDR error hints

**Files:**
- Modify: `packages/client/src/xdr/build-xdr.ts`
- Modify: `packages/client/src/client/caatinga-contract-client.ts`
- Modify: `packages/client/src/xdr/build-xdr.test.ts`
- Modify: `packages/client/src/client/caatinga-contract-client.test.ts`

- [ ] **Step 1: Write failing tests**

`buildXdr` must accept `rpcUrl` in input; on prepare failure, hint contains `https://soroban-testnet.stellar.org`.

- [ ] **Step 2: Thread `rpcUrl` into `buildTransactionXdr` call from `createTransaction`**

Update `build-xdr.ts` signature:

```typescript
export async function buildXdr(input: {
  contractName: string;
  method: string;
  contractId: string;
  transaction: unknown;
  rpcUrl: string;
  debug?: boolean;
}): Promise<CaatingaXdrBuildResult>
```

Hint:

```typescript
`RPC: ${input.rpcUrl}. Check connectivity, simulation errors, and binding compatibility.`
```

Submit path in `caatinga-contract-client.ts`:

```typescript
`RPC: ${this.config.network.rpcUrl}. Check wallet signature and RPC connectivity.`
```

- [ ] **Step 3: Run client tests**

```bash
pnpm --filter @caatinga/client test
```

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(client): include rpcUrl in XDR prepare and submit error hints"
```

---

### Task 8: G08 — Doctor partial deploy coverage

**Files:**
- Create: `packages/cli/src/commands/doctor-deploy-coverage.ts`
- Modify: `packages/cli/src/commands/doctor.command.ts`
- Modify: `packages/cli/src/commands/doctor.command.test.ts`
- Modify: `packages/core/src/errors/CaatingaErrorCode.ts`
- Modify: `docs/cli.md`, `docs/errors.md`

- [ ] **Step 1: Write failing test**

When config has `token` + `marketplace`, artifacts only has `token`, `evaluateDeployCoverage` returns one missing.

- [ ] **Step 2: Implement helper**

```typescript
export type DeployCoverageLine = {
  name: string;
  ok: boolean;
  contractId?: string;
  fix?: string;
};

export async function evaluateDeployCoverage(options: {
  networkName: string;
  cwd?: string;
}): Promise<{ lines: DeployCoverageLine[]; complete: boolean }> {
  const config = await loadConfig(options.cwd);
  const network = resolveNetwork(config, options.networkName);
  const artifacts = await readArtifacts(options.cwd);
  const lines: DeployCoverageLine[] = [];
  for (const name of Object.keys(config.contracts)) {
    const id = artifacts.networks[network.name]?.contracts[name]?.contractId;
    if (id) {
      lines.push({ name, ok: true, contractId: id });
    } else {
      lines.push({
        name,
        ok: false,
        fix: `Run: caatinga deploy ${name} --network ${network.name}`
      });
    }
  }
  return { lines, complete: lines.every((l) => l.ok) };
}
```

- [ ] **Step 3: Integrate in doctor when `--network` set**

Print lines; if incomplete, set `process.exitCode = 1` and throw `CaatingaError` with `DOCTOR_PARTIAL_DEPLOY` **or** set exit code only (prefer throw for consistent `runCliAction` printing).

- [ ] **Step 4: Document + error table**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(cli): doctor reports per-contract deploy coverage for --network"
```

---

### Task 9: G09 — Reject empty signed XDR

**Files:**
- Modify: `packages/client/src/client/caatinga-contract-client.ts`
- Modify: `packages/client/src/client/caatinga-contract-client.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
it("should_throw_XDR_SIGN_FAILED_when_signTransaction_returns_empty_string", async () => {
  const config = createClientConfig({
    wallet: {
      getPublicKey: vi.fn(async () => "GPUBLIC"),
      signTransaction: vi.fn(async () => "")
    }
  });
  await expect(
    createCaatingaClient(config).contract("counter").invoke("increment")
  ).rejects.toMatchObject({
    code: CaatingaErrorCode.XDR_SIGN_FAILED,
    hint: expect.stringContaining("empty")
  });
});
```

Add case for `undefined` resolved value.

- [ ] **Step 2: Validate after sign**

```typescript
if (typeof signedXdr !== "string" || signedXdr.trim().length === 0) {
  throw new CaatingaError(
    `Failed to sign XDR for "${this.contractName}.${method}".`,
    CaatingaErrorCode.XDR_SIGN_FAILED,
    "Wallet returned an empty or invalid signed XDR. The user may have dismissed the signing prompt.",
    signedXdr
  );
}
```

- [ ] **Step 3: Run tests + commit**

```bash
git commit -m "fix(client): reject empty wallet signed XDR before submit"
```

---

## Tier 3 — Technical debt (G10–G13)

### Task 10: G10 — WASM stale warning (non-blocking)

**Files:**
- Modify: `packages/core/src/contracts/wasm.ts` (add `isWasmOlderThanSources` helper)
- Modify: `packages/core/src/contracts/deploy-contract.ts`
- Modify: `packages/cli/src/commands/deploy.command.ts` (`--no-stale-check`)
- Modify: `packages/core/src/contracts/deploy-contract.test.ts`
- Modify: `docs/cli.md`

- [ ] **Step 1: Failing test** — existing artifact hash matches file, but `src/lib.rs` mtime newer than wasm → returns warning string.

- [ ] **Step 2: Implement best-effort mtime check** under `contracts/<name>/src`.

- [ ] **Step 3: CLI prints `logger.warn`**, deploy continues.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(core): warn on possibly stale wasm before deploy"
```

---

### Task 11: G11 — Opt-in `--verify-deps` on-chain

**Files:**
- Create: `packages/core/src/contracts/verify-dependency-contract.ts`
- Modify: `packages/core/src/contracts/deploy-contract-graph.ts`
- Modify: `packages/cli/src/commands/deploy.command.ts`
- Modify: `packages/core/src/errors/CaatingaErrorCode.ts`
- Modify: `docs/cli.md`, `docs/errors.md`

- [ ] **Step 1: Failing test** with mocked `runCommand` for `stellar contract info` failure → `DEPENDENCY_CONTRACT_NOT_FOUND`.

- [ ] **Step 2: Implement verifier** before `resolveDeployArgs` when flag set.

- [ ] **Step 3: Wire CLI flag `--verify-deps`**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(core): add optional --verify-deps for dependency contract ids"
```

---

### Task 12: G12 — CHANGELOG policy header

**Files:**
- Modify: `packages/cli/CHANGELOG.md`, `packages/core/CHANGELOG.md`, `packages/client/CHANGELOG.md`
- Modify: `docs/release.md` (cross-link; no root CHANGELOG exists)

- [ ] **Step 1: Insert header block** (audit text) at top of each package CHANGELOG.

- [ ] **Step 2: Add note in docs/release.md** that package changelogs link to v1 contract.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: link package changelogs to breaking-change policy"
```

---

### Task 13: G13 — `@caatinga/core/browser` entry (dedicated branch)

**Files:**
- Create: `packages/core/src/browser.ts`
- Modify: `packages/core/package.json` (`exports`, `build` script)
- Modify: all `packages/client/src/**` imports of `@caatinga/core` → `@caatinga/core/browser` where only errors/types needed
- Modify: `scripts/consumer-client-bundlers-test.sh`
- Modify: `docs/client.md`, `docs/templates.md`
- Modify: template to use `@caatinga/core/browser` and remove duplicate shim constants

- [ ] **Step 1: Create browser barrel**

```typescript
// packages/core/src/browser.ts
export { CaatingaError, CaatingaErrorCode, toCaatingaError } from "./errors/CaatingaError.js";
export type { CaatingaArtifacts, ContractArtifact } from "./artifacts/artifact.schema.js";
```

Verify `artifact.schema.ts` does not import Node-only modules (only `zod`).

- [ ] **Step 2: Update package.json exports + build**

```json
"exports": {
  ".": { ... },
  "./browser": {
    "types": "./dist/browser.d.ts",
    "import": "./dist/browser.js",
    "require": "./dist/browser.cjs"
  }
},
"scripts": {
  "build": "tsup src/index.ts src/browser.ts --format esm,cjs --dts"
}
```

- [ ] **Step 3: Switch client imports**

- [ ] **Step 4: Extend consumer-client-bundlers-test.sh**

```bash
if grep -r 'execa' "$tmp/dist" >/dev/null 2>&1; then
  echo "execa leaked into client bundler output" >&2
  exit 1
fi
```

- [ ] **Step 5: Full verification + commit**

```bash
git commit -m "feat(core): add @caatinga/core/browser entry for client bundles"
```

---

## Final verification (all tiers)

- [ ] **Run full gate**

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm check:fixtures
pnpm test:consumer
pnpm test:consumer:client-bundlers
pnpm knip
pnpm ci:publish-matrix
```

Expected: all exit 0.

- [ ] **Manual smoke (optional)**

```bash
# multi-contract skip visibility
caatinga deploy --network testnet --source alice
caatinga deploy --network testnet --source alice  # should show [skipped]

# doctor partial
caatinga doctor --network testnet
```

---

## Self-review (spec coverage)

| Gap | Task | Notes |
|-----|------|-------|
| G01 | Task 1 | Index lists five specs with real paths |
| G02 | Task 2 | No `parseDeployOutput`; uses `parseContractId` + CI script |
| G03 | Task 3 | `skippedContracts` + CLI labels |
| G04 | Task 4 | Real client in template + consumer grep |
| G05 | Task 5 | Three new codes + docs |
| G06 | Task 6 | Docs + optional timeout |
| G07 | Task 7 | rpcUrl in hints only |
| G08 | Task 8 | Doctor `--network` coverage |
| G09 | Task 9 | Empty signed XDR guard |
| G10 | Task 10 | Non-blocking warn + `--no-stale-check` |
| G11 | Task 11 | Opt-in `--verify-deps` |
| G12 | Task 12 | CHANGELOG headers (packages only) |
| G13 | Task 13 | `/browser` entry; separate branch recommended |

**Placeholder scan:** No TBD steps; all code paths reference real files.

**Type consistency:** `SkippedContract`, `DeployContractGraphResult`, `CaatingaClientConfig.walletTimeout` used consistently across tasks 3 and 6.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-05-18-caatinga-audit-gaps.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — fresh subagent per task (G01→G05 first), review between tasks.
2. **Inline execution** — implement in this session with executing-plans checkpoints after each tier.

Which approach do you want?
