# Caatinga v0.1.0-alpha Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare an auditable internal `v0.1.0-alpha` release that includes the CLI/core MVP, `@caatinga/client`, and a counter template smoke path.

**Architecture:** Keep the release gate deterministic: unit tests and workspace build run without testnet, wallet, or secret keys. The template/client confidence comes from static package/docs checks plus documented manual smoke steps, not from live network CI.

**Tech Stack:** pnpm workspace, Turbo, TypeScript ESM, Vitest, tsup, GitHub Actions, Caatinga CLI/core/client packages.

---

## File Structure

- `packages/templates/react-vite-counter/package.json`: add alpha client/Freighter dependencies so generated apps can follow `docs/client.md`.
- `packages/templates/react-vite-counter/README.md`: document CLI flow and the client/Freighter smoke path.
- `packages/core/src/templates/create-project-from-template.test.ts`: add a regression check that official template dependencies include the alpha client packages.
- `docs/release/v0.1.0-alpha.md`: release notes with automated checks, manual smoke checklist, scope, and non-goals.
- `README.md`: link release notes if the release doc is created.
- No changes to `doctor`, CLI XDR, `generate --interop`, React hooks, multi-contract deploy, or npm publish.

### Task 1: Template Dependency Gate

**Files:**
- Modify: `packages/core/src/templates/create-project-from-template.test.ts`
- Modify: `packages/templates/react-vite-counter/package.json`

- [ ] **Step 1: Write failing test for official template client dependencies**

Add this test to `packages/core/src/templates/create-project-from-template.test.ts`:

```ts
it("should_include_client_dependencies_in_react_vite_counter_template", async () => {
  const templatePackageJsonPath = path.join(
    process.cwd(),
    "../../packages/templates/react-vite-counter/package.json"
  );
  const packageJson = JSON.parse(await fs.readFile(templatePackageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  expect(packageJson.dependencies?.["@caatinga/client"]).toBe("^0.1.0");
  expect(packageJson.dependencies?.["@stellar/freighter-api"]).toBe("^4.0.0");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @caatinga/core test -- src/templates/create-project-from-template.test.ts
```

Expected: FAIL because `packages/templates/react-vite-counter/package.json` does not yet include `@caatinga/client` or `@stellar/freighter-api`.

- [ ] **Step 3: Add template dependencies**

Change `packages/templates/react-vite-counter/package.json` dependencies to include:

```json
"dependencies": {
  "@caatinga/client": "^0.1.0",
  "@caatinga/core": "^0.1.0",
  "@stellar/freighter-api": "^4.0.0",
  "@vitejs/plugin-react": "^4.3.4",
  "vite": "^6.0.6",
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

- [ ] **Step 4: Verify template dependency test passes**

Run:

```bash
pnpm --filter @caatinga/core test -- src/templates/create-project-from-template.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/templates/create-project-from-template.test.ts packages/templates/react-vite-counter/package.json
git commit -m "test: gate alpha template client dependencies"
```

### Task 2: Template Client Smoke Documentation

**Files:**
- Modify: `packages/templates/react-vite-counter/README.md`

- [ ] **Step 1: Replace template README with alpha smoke instructions**

Update `packages/templates/react-vite-counter/README.md` to:

````md
# __PROJECT_NAME__

Caatinga counter dApp for Stellar/Soroban.

## CLI Flow

```bash
npm install
npx caatinga build counter
npx caatinga deploy counter --network testnet --source alice
npx caatinga generate counter --network testnet
npx caatinga invoke counter.increment --network testnet --source alice
npm run dev
```

Use a local Stellar CLI identity alias for `--source`; public account addresses, seed phrases, and secret keys are rejected for signing operations.

## Client Smoke Path

After `caatinga generate`, wire generated bindings to the client:

```ts
import { createCaatingaClient } from "@caatinga/client";
import { freighterWalletAdapter } from "@caatinga/client/freighter";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

export const caatingaClient = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  },
  artifacts,
  wallet: freighterWalletAdapter,
  contracts: {
    counter: {
      binding: Counter
    }
  }
});
```

Build XDR without wallet signing:

```ts
const tx = await caatingaClient.contract("counter").buildXdr("increment");
console.log(tx.preparedXdr);
```

Invoke through Freighter:

```ts
const result = await caatingaClient.contract("counter").invoke("increment", {
  debugXdr: true
});
console.log(result.transactionHash);
```
````

- [ ] **Step 2: Inspect README markdown**

Run:

```bash
sed -n '1,220p' packages/templates/react-vite-counter/README.md
```

Expected: output includes `CLI Flow`, `Client Smoke Path`, `createCaatingaClient`, and `freighterWalletAdapter`.

- [ ] **Step 3: Commit**

Run:

```bash
git add packages/templates/react-vite-counter/README.md
git commit -m "docs: document alpha template client smoke path"
```

### Task 3: Release Notes

**Files:**
- Create: `docs/release/v0.1.0-alpha.md`
- Modify: `README.md`

- [ ] **Step 1: Create release notes**

Create `docs/release/v0.1.0-alpha.md`:

````md
# v0.1.0-alpha

Internal alpha release for Caatinga.

## Included

- `@caatinga/cli`
- `@caatinga/core`
- `@caatinga/client`
- `react-vite-counter` official template

## Supported Alpha Flow

```bash
caatinga init <projectName>
caatinga build counter
caatinga deploy counter --network testnet --source <identity>
caatinga generate counter --network testnet
caatinga invoke counter.increment --network testnet --source <identity>
```

## Client Alpha Flow

`@caatinga/client` supports generated binding registration, artifact-based `contractId` lookup, wallet signing through `CaatingaWalletAdapter`, `invoke()`, `buildXdr()`, and explicit `debugXdr`/`debugRaw` output.

## Non-goals

- npm publish
- `caatinga doctor`
- CLI XDR commands
- `caatinga generate --interop`
- React hooks
- multi-contract dependency deploy
- live testnet CI

## Automated Verification

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
```

## Manual Smoke Checklist

- `react-vite-counter` uses `wasm32v1-none`.
- `react-vite-counter` documents `init -> build -> deploy -> generate -> invoke`.
- `react-vite-counter` documents `@caatinga/client` with generated bindings, artifacts, and Freighter.
- No default CI step requires testnet, Freighter, or secret keys.

## Tag

Tag after all checks pass and release changes are committed:

```bash
git tag v0.1.0-alpha
```
````

- [ ] **Step 2: Link release notes from README**

Add this bullet under `README.md` Documentation:

```md
- **[v0.1.0-alpha release notes](./docs/release/v0.1.0-alpha.md)** — internal alpha scope and verification gates.
```

- [ ] **Step 3: Inspect release notes**

Run:

```bash
sed -n '1,240p' docs/release/v0.1.0-alpha.md
```

Expected: output includes included packages, non-goals, automated verification, manual smoke checklist, and tag command.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/release/v0.1.0-alpha.md README.md
git commit -m "docs: add v0.1.0-alpha release notes"
```

### Task 4: Frozen Install and Full Verification

**Files:**
- Verify: `pnpm-lock.yaml`
- Verify: `.github/workflows/ci.yml`
- Verify: all workspace packages

- [ ] **Step 1: Verify frozen lockfile install**

Run:

```bash
pnpm install --frozen-lockfile
```

Expected: PASS. If it fails because `packages/templates/react-vite-counter/package.json` dependency changes are not in the lockfile, run `pnpm install`, then repeat `pnpm install --frozen-lockfile`.

- [ ] **Step 2: Verify typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS for `@caatinga/core`, `@caatinga/client`, and `@caatinga/cli`.

- [ ] **Step 3: Verify build**

Run:

```bash
pnpm build
```

Expected: PASS for `@caatinga/core`, `@caatinga/client`, and `@caatinga/cli`.

- [ ] **Step 4: Verify tests**

Run:

```bash
pnpm test
```

Expected: PASS for core, client, and cli tests.

- [ ] **Step 5: Commit lockfile if changed**

Run:

```bash
git add pnpm-lock.yaml
git commit -m "chore: update alpha lockfile"
```

Only run this commit if `git status --short` shows `pnpm-lock.yaml` changed after dependency updates.

### Task 5: Release Readiness Audit

**Files:**
- Verify: `docs/superpowers/specs/2026-05-12-caatinga-alpha-release-design.md`
- Verify: `docs/release/v0.1.0-alpha.md`
- Verify: `.github/workflows/ci.yml`
- Verify: `packages/templates/react-vite-counter/caatinga.config.ts`

- [ ] **Step 1: Confirm no out-of-scope commands were added**

Run:

```bash
rg -n "doctor|xdr build|xdr simulate|xdr inspect|--interop|useCaatinga|useContract" packages docs README.md
```

Expected: only non-goal/spec/doc references. No CLI implementation files should register these commands.

- [ ] **Step 2: Confirm wasm target**

Run:

```bash
rg -n "wasm32v1-none" packages/templates/react-vite-counter README.md docs
```

Expected: `wasm32v1-none` appears for current guidance.

- [ ] **Step 3: Confirm CI remains deterministic**

Run:

```bash
sed -n '1,220p' .github/workflows/ci.yml
```

Expected: workflow runs install, typecheck, build, and test; it does not require testnet credentials, Freighter, or secret keys.

- [ ] **Step 4: Inspect working tree**

Run:

```bash
git status --short
```

Expected: only intentional release changes remain. If unrelated changes are present, do not revert them; document them in the handoff.

- [ ] **Step 5: Final release handoff**

Report:

```txt
Ready for v0.1.0-alpha tag after user approval.

Automated checks:
- pnpm install --frozen-lockfile
- pnpm typecheck
- pnpm build
- pnpm test

Manual smoke:
- template client dependencies present
- template client smoke path documented
- no CI testnet/wallet/secret dependency

Recommended tag:
- v0.1.0-alpha
```

Do not create the tag unless explicitly instructed.

## Self-Review

- Spec coverage: covers `@caatinga/client` inclusion, README/client/errors docs, template compatibility, deterministic CI, frozen install, full checks, release notes, and auditable working tree.
- Scope control: excludes `doctor`, CLI XDR, `generate --interop`, React hooks, multi-contract deploy, live testnet CI, and npm publishing.
- Placeholder scan: no `TBD`, no `TODO`, no unbounded "handle/process" requirements.
- Type consistency: client package names, command names, release tag, and file paths match the approved spec.
