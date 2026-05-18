# Caatinga v1 Viability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the five required v1 viability specs: Stellar CLI version contract, complete `CAATINGA_*` error surface, npm publish consumer isolation, live testnet smoke CI, and experimental multi-contract dependency deploy.

**Architecture:** Keep `@caatinga/cli` thin and put runtime behavior in `@caatinga/core`; keep `@caatinga/client` package validation isolated to packaging/browser-consumer tests. Add dependency deploy as explicit graph resolution plus safe placeholder substitution, not shell/env interpolation.

**Tech Stack:** TypeScript, pnpm 9, Turbo, Vitest, Zod, semver, tsup, GitHub Actions, Changesets, Stellar CLI.

---

## Scope Check

The index spec covers five related but separately testable subsystems. This is a single v1 viability plan because the specs have an explicit order and later specs depend on earlier ones:

1. Stellar CLI version contract
2. Complete public error surface
3. npm publish and consumer isolation
4. live testnet smoke CI
5. multi-contract dependency deploy

Do not tag `v1.0.0` until all tasks are implemented and accepted. Pre-v1 publishing remains allowed only under `0.x`, `alpha`, `beta`, or `next`.

## File Structure

- Create `packages/core/src/stellar-cli/version.ts`: supported Stellar CLI range constants and semver helper.
- Create `packages/core/src/stellar-cli/check-stellar-cli-version.ts`: parse `stellar --version`, enforce range, allow local untested override.
- Modify `packages/core/src/shell/run-command.ts`: run the Stellar CLI version gate before `stellar ...` commands.
- Modify CLI command files in `packages/cli/src/commands/*.command.ts`: expose `--allow-untested-stellar-cli` only where commands shell out to Stellar.
- Modify `packages/core/src/errors/CaatingaError.ts`: add all missing public error codes.
- Create `packages/core/src/errors/error-surface.test.ts`: static and docs coverage checks for error codes.
- Modify `docs/errors.md`: complete table with semver stability.
- Create `docs/release/error-code-policy.md`: explicit error code semver policy.
- Modify package manifests in `packages/cli`, `packages/core`, `packages/client`: dual ESM/CJS exports, `files`, and publish-safe metadata.
- Modify package build scripts: emit ESM and CJS artifacts.
- Create `.changeset/config.json`: Changesets release config.
- Create `scripts/consumer-isolation-test.sh`: pack/install/import CLI/client outside the monorepo.
- Create `.github/workflows/release.yml`: typecheck, build, test, pack, consumer isolation, publish with provenance.
- Create `.github/workflows/testnet-smoke.yml`: scheduled/manual/release-gated testnet smoke.
- Modify `packages/core/src/config/config.schema.ts`: add `dependsOn` and `deployArgs`.
- Modify `packages/core/src/artifacts/artifact.schema.ts`: add optional `dependencies`, `resolvedDeployArgs`, and network `dependencyGraph`.
- Create `packages/core/src/contracts/dependency-graph.ts`: validate dependency references and cycles.
- Create `packages/core/src/contracts/resolve-deploy-order.ts`: deterministic topological sort.
- Create `packages/core/src/contracts/resolve-deploy-args.ts`: safe `${contracts.<name>.contractId}` placeholder resolver.
- Create `packages/core/src/contracts/deploy-contract-graph.ts`: deploy all or selected contract with dependency behavior.
- Modify `packages/core/src/contracts/deploy-contract.ts`: accept `deployArgs`, `force`, dependency metadata, and reusable deploy inputs.
- Modify `packages/cli/src/commands/deploy.command.ts`: support `caatinga deploy --network testnet`, `--force`, and `--no-deps`.
- Create `packages/templates/marketplace-with-token`: official experimental multi-contract template.
- Modify `docs/adr/0005-multi-contract-dependency-deploy.md`: promote to Accepted and document trade-offs.
- Create or modify docs: `docs/stellar-cli-version-contract.md`, `docs/cli.md`, `docs/config.md`, `docs/templates.md`, `docs/testing.md`, `docs/release/v1-readiness.md`.

---

### Task 1: Stellar CLI Version Parser and Constants

**Files:**
- Create: `packages/core/src/stellar-cli/version.ts`
- Create: `packages/core/src/stellar-cli/check-stellar-cli-version.test.ts`
- Modify: `packages/core/src/errors/CaatingaError.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add failing tests for version parsing**

Create `packages/core/src/stellar-cli/check-stellar-cli-version.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import {
  STELLAR_CLI_MIN_VERSION,
  STELLAR_CLI_TESTED_MAX_VERSION,
  assertSupportedStellarCliVersion,
  parseStellarCliVersion
} from "./version.js";

describe("Stellar CLI version contract", () => {
  it("parses semver from known Stellar CLI outputs", () => {
    expect(parseStellarCliVersion("stellar 22.0.1")).toBe("22.0.1");
    expect(parseStellarCliVersion("stellar-cli 21.3.0 (build abc123)")).toBe("21.3.0");
    expect(parseStellarCliVersion("Stellar CLI version 22.1.0")).toBe("22.1.0");
  });

  it("fails when version output has no semver", () => {
    expect(() => parseStellarCliVersion("stellar dev build")).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED
      })
    );
  });

  it("rejects versions below the minimum", () => {
    expect(() =>
      assertSupportedStellarCliVersion({
        version: "0.1.0",
        allowUntested: false
      })
    ).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.UNSUPPORTED_CLI_VERSION
      })
    );
  });

  it("rejects versions above the tested maximum by default", () => {
    expect(() =>
      assertSupportedStellarCliVersion({
        version: "99.0.0",
        allowUntested: false
      })
    ).toThrowError(
      expect.objectContaining({
        code: CaatingaErrorCode.UNTESTED_CLI_VERSION
      })
    );
  });

  it("allows versions above the tested maximum with explicit local override", () => {
    expect(
      assertSupportedStellarCliVersion({
        version: "99.0.0",
        allowUntested: true
      })
    ).toBe("99.0.0");
  });

  it("declares concrete supported range constants", () => {
    expect(STELLAR_CLI_MIN_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(STELLAR_CLI_TESTED_MAX_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/stellar-cli/check-stellar-cli-version.test.ts
```

Expected: FAIL because `./version.js` and new error codes do not exist.

- [ ] **Step 3: Add version constants and parser**

Modify `packages/core/src/errors/CaatingaError.ts` to add:

```ts
STELLAR_CLI_VERSION_PARSE_FAILED: "CAATINGA_STELLAR_CLI_VERSION_PARSE_FAILED",
UNSUPPORTED_CLI_VERSION: "CAATINGA_UNSUPPORTED_CLI_VERSION",
UNTESTED_CLI_VERSION: "CAATINGA_UNTESTED_CLI_VERSION",
```

Create `packages/core/src/stellar-cli/version.ts`:

```ts
import semver from "semver";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

export const STELLAR_CLI_MIN_VERSION = "22.0.0";
export const STELLAR_CLI_TESTED_MAX_VERSION = "22.0.1";

export function parseStellarCliVersion(output: string): string {
  const match = output.match(/\b(\d+\.\d+\.\d+)\b/);

  if (!match) {
    throw new CaatingaError(
      "Could not parse Stellar CLI version.",
      CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED,
      "Run `stellar --version` and check the output."
    );
  }

  return match[1];
}

export function assertSupportedStellarCliVersion(input: {
  version: string;
  allowUntested: boolean;
}): string {
  if (semver.lt(input.version, STELLAR_CLI_MIN_VERSION)) {
    throw new CaatingaError(
      `Unsupported Stellar CLI version ${input.version}.`,
      CaatingaErrorCode.UNSUPPORTED_CLI_VERSION,
      `Install Stellar CLI ${STELLAR_CLI_MIN_VERSION} or newer.`
    );
  }

  if (semver.gt(input.version, STELLAR_CLI_TESTED_MAX_VERSION) && !input.allowUntested) {
    throw new CaatingaError(
      `Untested Stellar CLI version ${input.version}.`,
      CaatingaErrorCode.UNTESTED_CLI_VERSION,
      `Use Stellar CLI <= ${STELLAR_CLI_TESTED_MAX_VERSION}, or pass --allow-untested-stellar-cli for local experiments.`
    );
  }

  return input.version;
}
```

Modify `packages/core/src/index.ts` to export the new module:

```ts
export * from "./stellar-cli/version.js";
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/stellar-cli/check-stellar-cli-version.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/errors/CaatingaError.ts packages/core/src/stellar-cli/version.ts packages/core/src/stellar-cli/check-stellar-cli-version.test.ts packages/core/src/index.ts
git commit -m "feat: add stellar cli version contract"
```

---

### Task 2: Runtime Stellar CLI Version Gate

**Files:**
- Create: `packages/core/src/stellar-cli/check-stellar-cli-version.ts`
- Create: `packages/core/src/stellar-cli/run-command-version.test.ts`
- Modify: `packages/core/src/shell/run-command.ts`
- Modify: `packages/core/src/contracts/build-contract.ts`
- Modify: `packages/core/src/contracts/deploy-contract.ts`
- Modify: `packages/core/src/contracts/generate-bindings.ts`
- Modify: `packages/core/src/contracts/invoke-contract.ts`
- Modify: `packages/cli/src/commands/build.command.ts`
- Modify: `packages/cli/src/commands/deploy.command.ts`
- Modify: `packages/cli/src/commands/generate.command.ts`
- Modify: `packages/cli/src/commands/invoke.command.ts`

- [ ] **Step 1: Add failing tests for runtime gate**

Create `packages/core/src/stellar-cli/run-command-version.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { checkStellarCliVersion } from "./check-stellar-cli-version.js";

const runCommandMock = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand: runCommandMock
}));

describe("checkStellarCliVersion", () => {
  it("checks stellar --version and returns parsed version", async () => {
    runCommandMock.mockResolvedValueOnce({
      stdout: "stellar 22.0.1",
      stderr: "",
      all: "stellar 22.0.1"
    });

    await expect(checkStellarCliVersion({ allowUntested: false })).resolves.toBe("22.0.1");
    expect(runCommandMock).toHaveBeenCalledWith("stellar", ["--version"], {
      skipStellarVersionCheck: true
    });
  });

  it("normalizes missing stellar binary to CAATINGA_STELLAR_CLI_NOT_FOUND", async () => {
    runCommandMock.mockRejectedValueOnce(Object.assign(new Error("not found"), { code: "ENOENT" }));

    await expect(checkStellarCliVersion({ allowUntested: false })).rejects.toMatchObject({
      code: CaatingaErrorCode.STELLAR_CLI_NOT_FOUND
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/stellar-cli/run-command-version.test.ts
```

Expected: FAIL because `check-stellar-cli-version.ts` does not exist and `runCommand` has no `skipStellarVersionCheck` option.

- [ ] **Step 3: Implement check helper**

Create `packages/core/src/stellar-cli/check-stellar-cli-version.ts`:

```ts
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { runCommand } from "../shell/run-command.js";
import { assertSupportedStellarCliVersion, parseStellarCliVersion } from "./version.js";

export async function checkStellarCliVersion(input: {
  allowUntested: boolean;
}): Promise<string> {
  try {
    const result = await runCommand("stellar", ["--version"], {
      skipStellarVersionCheck: true
    });
    const output = result.all || result.stdout || result.stderr;
    return assertSupportedStellarCliVersion({
      version: parseStellarCliVersion(output),
      allowUntested: input.allowUntested
    });
  } catch (error) {
    if (error instanceof CaatingaError) {
      throw error;
    }

    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT") {
      throw new CaatingaError(
        "Stellar CLI was not found.",
        CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
        "Install Stellar CLI and ensure `stellar` is in PATH.",
        error
      );
    }

    throw error;
  }
}
```

- [ ] **Step 4: Extend `runCommand` options and gate Stellar commands**

Modify `packages/core/src/shell/run-command.ts`:

```ts
import { execa, type Options } from "execa";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { checkStellarCliVersion } from "../stellar-cli/check-stellar-cli-version.js";

export type RunCommandResult = {
  stdout: string;
  stderr: string;
  all: string;
};

export type RunCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  allowUntestedStellarCli?: boolean;
  skipStellarVersionCheck?: boolean;
};

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<RunCommandResult> {
  if (command === "stellar" && options.skipStellarVersionCheck !== true) {
    await checkStellarCliVersion({
      allowUntested: options.allowUntestedStellarCli === true
    });
  }

  try {
    const result = await execa(command, args, {
      cwd: options.cwd,
      env: options.env,
      all: true,
      reject: true
    } satisfies Options);

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      all: result.all ?? ""
    };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ENOENT" && command === "stellar") {
      throw new CaatingaError(
        "Stellar CLI was not found.",
        CaatingaErrorCode.STELLAR_CLI_NOT_FOUND,
        "Install Stellar CLI and ensure `stellar` is in PATH.",
        error
      );
    }

    const output = typeof error === "object" && error && "all" in error ? String(error.all) : undefined;
    throw new CaatingaError(
      `Command failed: ${command} ${args.join(" ")}`,
      CaatingaErrorCode.COMMAND_FAILED,
      output || "Re-run the command with the underlying tool directly for full diagnostics.",
      error
    );
  }
}
```

- [ ] **Step 5: Thread override through core options**

Add `allowUntestedStellarCli?: boolean` to `BuildContractOptions`, `DeployContractOptions`, `GenerateBindingsOptions`, and `InvokeContractOptions`, then pass it into every `runCommand("stellar", ..., { ... })` call:

```ts
await runCommand("stellar", args, {
  cwd,
  allowUntestedStellarCli: options.allowUntestedStellarCli
});
```

- [ ] **Step 6: Add CLI flag for local override**

In each Stellar-backed command (`build`, `deploy`, `generate`, `invoke`), add:

```ts
.option("--allow-untested-stellar-cli", "Allow local use of a Stellar CLI version newer than Caatinga's tested maximum")
```

Pass the option to core:

```ts
allowUntestedStellarCli: options.allowUntestedStellarCli === true
```

Do not add this flag to CI workflows.

- [ ] **Step 7: Run targeted tests and typecheck**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/stellar-cli/check-stellar-cli-version.test.ts packages/core/src/stellar-cli/run-command-version.test.ts
pnpm typecheck
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/stellar-cli packages/core/src/shell/run-command.ts packages/core/src/contracts packages/cli/src/commands
git commit -m "feat: enforce stellar cli version range"
```

---

### Task 3: Stellar CLI Version Documentation and Fixtures

**Files:**
- Create: `docs/stellar-cli-version-contract.md`
- Create: `packages/core/test/fixtures/stellar-cli/v22.0.0/version.v22.0.0.fixture.txt`
- Create: `packages/core/test/fixtures/stellar-cli/v22.0.1/version.v22.0.1.fixture.txt`
- Modify: `docs/testing.md`
- Modify: `docs/cli.md`

- [ ] **Step 1: Add version fixtures**

Create `packages/core/test/fixtures/stellar-cli/v22.0.0/version.v22.0.0.fixture.txt`:

```txt
stellar 22.0.0
```

Create `packages/core/test/fixtures/stellar-cli/v22.0.1/version.v22.0.1.fixture.txt`:

```txt
stellar 22.0.1
```

- [ ] **Step 2: Add docs**

Create `docs/stellar-cli-version-contract.md`:

```md
# Stellar CLI Version Contract

Caatinga shells out to Stellar CLI for build, deploy, bindings, invoke, and future XDR/doctor commands. Unsupported CLI versions are not assumed safe.

## Supported Range

- Minimum: `22.0.0`
- Tested maximum: `22.0.1`

Runtime behavior:

- Below the minimum: fail with `CAATINGA_UNSUPPORTED_CLI_VERSION`.
- Above the tested maximum: fail with `CAATINGA_UNTESTED_CLI_VERSION`.
- Local override: pass `--allow-untested-stellar-cli`.
- CI must not use the override.

## Upgrade Process

1. Install the new Stellar CLI locally.
2. Capture `stellar --version` in a versioned fixture.
3. Add or update parser fixtures for build, deploy, bindings, and invoke output.
4. Run `pnpm test`.
5. Raise `STELLAR_CLI_TESTED_MAX_VERSION` only after fixtures and smoke validation pass.

## CI Rule

CI must use a pinned Stellar CLI version within the supported range. The override flag is for local experiments only because CI is the release boundary.
```

- [ ] **Step 3: Link docs**

Modify `docs/testing.md` to add:

```md
Stellar CLI version fixtures must include the CLI semver in the filename, for example `version.v22.0.1.fixture.txt`.
```

Modify `docs/cli.md` to add:

```md
Use `--allow-untested-stellar-cli` only for local experiments. CI and release workflows must run a supported Stellar CLI version.
```

- [ ] **Step 4: Run docs-safe checks**

Run:

```bash
git diff --check
pnpm --filter @caatinga/core test -- --run packages/core/src/stellar-cli/check-stellar-cli-version.test.ts
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/stellar-cli-version-contract.md docs/testing.md docs/cli.md packages/core/test/fixtures/stellar-cli
git commit -m "docs: document stellar cli version contract"
```

---

### Task 4: Complete Error Code Surface

**Files:**
- Modify: `packages/core/src/errors/CaatingaError.ts`
- Create: `packages/core/src/errors/error-surface.test.ts`
- Modify: `docs/errors.md`
- Create: `docs/release/error-code-policy.md`

- [ ] **Step 1: Add failing error surface tests**

Create `packages/core/src/errors/error-surface.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "./CaatingaError.js";

const repoRoot = join(__dirname, "../../../..");

describe("public error surface", () => {
  it("exports only CAATINGA_* codes", () => {
    for (const code of Object.values(CaatingaErrorCode)) {
      expect(code).toMatch(/^CAATINGA_/);
    }
  });

  it("documents every exported code in docs/errors.md", () => {
    const docs = readFileSync(join(repoRoot, "docs/errors.md"), "utf8");

    for (const code of Object.values(CaatingaErrorCode)) {
      expect(docs).toContain(`\`${code}\``);
    }
  });

  it("does not document codes missing from implementation", () => {
    const docs = readFileSync(join(repoRoot, "docs/errors.md"), "utf8");
    const documented = [...docs.matchAll(/`(CAATINGA_[A-Z0-9_]+)`/g)].map((match) => match[1]);
    const exported = new Set(Object.values(CaatingaErrorCode));

    for (const code of documented) {
      expect(exported.has(code)).toBe(true);
    }
  });

  it("does not construct CaatingaError with raw string codes", () => {
    const files = [
      "packages/cli/src",
      "packages/core/src",
      "packages/client/src"
    ];
    const source = files
      .flatMap((path) => collectTsFiles(join(repoRoot, path)))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(source).not.toMatch(/new CaatingaError\([^)]*,\s*["']CAATINGA_/);
  });
});

function collectTsFiles(path: string): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  return readdirSync(path)
    .flatMap((entry) => {
      const fullPath = join(path, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        return collectTsFiles(fullPath);
      }
      return fullPath.endsWith(".ts") ? [fullPath] : [];
    });
}
```

- [ ] **Step 2: Run failing error surface test**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/errors/error-surface.test.ts
```

Expected: FAIL until all spec-required codes exist and docs are complete.

- [ ] **Step 3: Add missing codes**

Modify `CaatingaErrorCode` in `packages/core/src/errors/CaatingaError.ts` so the minimum public list includes:

```ts
DEPLOY_FAILED: "CAATINGA_DEPLOY_FAILED",
BUILD_FAILED: "CAATINGA_BUILD_FAILED",
BINDINGS_FAILED: "CAATINGA_BINDINGS_FAILED",
INVOKE_FAILED: "CAATINGA_INVOKE_FAILED",
INVALID_TEMPLATE_MANIFEST: "CAATINGA_INVALID_TEMPLATE_MANIFEST",
CONTRACT_DEPENDENCY_NOT_FOUND: "CAATINGA_CONTRACT_DEPENDENCY_NOT_FOUND",
CONTRACT_DEPENDENCY_CYCLE: "CAATINGA_CONTRACT_DEPENDENCY_CYCLE",
CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND: "CAATINGA_CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND",
DEPLOY_ARG_PLACEHOLDER_INVALID: "CAATINGA_DEPLOY_ARG_PLACEHOLDER_INVALID",
DEPLOY_ARG_PLACEHOLDER_UNRESOLVED: "CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED",
```

Keep all existing codes.

- [ ] **Step 4: Document error policy**

Create `docs/release/error-code-policy.md`:

```md
# Error Code Policy

`CAATINGA_*` error codes are public API. Automation may parse `code`; it must not parse message text.

## Semver Rules

- Adding a new `CAATINGA_*` code: minor change.
- Removing a `CAATINGA_*` code: major change.
- Renaming a `CAATINGA_*` code: major change.
- Changing the meaning of a code: major change.
- Changing message text only: patch change.

## Required Fields

Every documented code must include meaning, likely cause, suggested fix, CI handling recommendation, and semver stability.
```

- [ ] **Step 5: Expand `docs/errors.md` format**

Update `docs/errors.md` table header to:

```md
| Error code | Meaning | Likely cause | Suggested fix | CI handling | Semver stability |
| --- | --- | --- | --- | --- | --- |
```

For every code in `CaatingaErrorCode`, add a row with a concrete CI recommendation and semver stability. Example row:

```md
| `CAATINGA_UNTESTED_CLI_VERSION` | Stellar CLI version is newer than Caatinga's tested maximum. | Local or CI runner upgraded Stellar CLI before Caatinga fixtures were updated. | Use a supported Stellar CLI version, or pass `--allow-untested-stellar-cli` only for local experiments. | Fail CI; do not override in release jobs. | Public code; rename/removal is major. |
```

- [ ] **Step 6: Run error tests**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/errors/error-codes.test.ts packages/core/src/errors/error-surface.test.ts
pnpm typecheck
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/errors docs/errors.md docs/release/error-code-policy.md
git commit -m "chore: complete public error surface"
```

---

### Task 5: Package Manifests and Dual Builds

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/client/package.json`
- Modify: `packages/cli/src/program.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Add package manifest checks as failing tests**

Create `packages/core/src/release/package-manifest.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packages = ["cli", "core", "client"];
const repoRoot = join(__dirname, "../../../..");

describe("publish package manifests", () => {
  for (const packageName of packages) {
    it(`${packageName} has publish-safe exports`, () => {
      const packageJson = JSON.parse(
        readFileSync(join(repoRoot, `packages/${packageName}/package.json`), "utf8")
      );

      expect(packageJson.type).toBe("module");
      expect(packageJson.main).toBe("./dist/index.cjs");
      expect(packageJson.module).toBe("./dist/index.js");
      expect(packageJson.types).toBe("./dist/index.d.ts");
      expect(packageJson.files).toEqual(expect.arrayContaining(["dist", "README.md", "LICENSE"]));
      expect(JSON.stringify(packageJson)).not.toContain("workspace:*");
    });
  }

  it("cli exposes caatinga bin", () => {
    const packageJson = JSON.parse(
      readFileSync(join(repoRoot, "packages/cli/package.json"), "utf8")
    );
    expect(packageJson.bin).toEqual({ caatinga: "./dist/index.js" });
  });
});
```

- [ ] **Step 2: Run failing manifest test**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/release/package-manifest.test.ts
```

Expected: FAIL because manifests do not yet have CJS exports/files and contain `workspace:*`.

- [ ] **Step 3: Update package manifests**

For each package, use this shape. Example for `packages/core/package.json`:

```json
{
  "name": "@caatinga/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

For `@caatinga/client`, preserve `./freighter` export and add require/types:

```json
"./freighter": {
  "types": "./dist/freighter.d.ts",
  "import": "./dist/freighter.js",
  "require": "./dist/freighter.cjs"
}
```

Replace internal published dependencies:

```json
"@caatinga/core": "^0.1.0"
```

Keep `workspace:*` only if a prepack or Changesets step rewrites it before packing; otherwise the consumer isolation test must fail.

- [ ] **Step 4: Add README/LICENSE files or package files rule**

If package-level README/LICENSE files are missing, create small package README files and copy/link license content. Minimum `packages/core/README.md`:

```md
# @caatinga/core

Core config, artifacts, command orchestration, and error primitives for Caatinga.
```

Repeat for `packages/cli/README.md` and `packages/client/README.md`. Add root `LICENSE` if none exists before using `files: ["LICENSE"]`.

- [ ] **Step 5: Verify build artifacts**

Run:

```bash
pnpm build
test -f packages/core/dist/index.js
test -f packages/core/dist/index.cjs
test -f packages/client/dist/freighter.cjs
pnpm --filter @caatinga/core test -- --run packages/core/src/release/package-manifest.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json packages/*/package.json packages/*/README.md LICENSE packages/core/src/release/package-manifest.test.ts
git commit -m "chore: prepare packages for npm publishing"
```

---

### Task 6: Changesets and Consumer Isolation Script

**Files:**
- Create: `.changeset/config.json`
- Create: `scripts/consumer-isolation-test.sh`
- Modify: `package.json`

- [ ] **Step 1: Add Changesets config**

Create `.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [["@caatinga/cli", "@caatinga/core", "@caatinga/client"]],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

Modify root `package.json`:

```json
"scripts": {
  "build": "turbo build",
  "dev": "pnpm --filter @caatinga/cli dev",
  "test": "turbo test",
  "typecheck": "turbo typecheck",
  "changeset": "changeset",
  "pack:packages": "pnpm -r --filter @caatinga/cli --filter @caatinga/core --filter @caatinga/client pack --pack-destination ./packed",
  "test:consumer": "bash scripts/consumer-isolation-test.sh"
}
```

- [ ] **Step 2: Add consumer isolation script**

Create `scripts/consumer-isolation-test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKED_DIR="$ROOT_DIR/packed"
TMP_DIR="${TMPDIR:-/tmp}/caatinga-consumer-test"

rm -rf "$PACKED_DIR" "$TMP_DIR"
mkdir -p "$PACKED_DIR" "$TMP_DIR"

pnpm --dir "$ROOT_DIR" build
pnpm --dir "$ROOT_DIR" -r --filter @caatinga/core --filter @caatinga/client --filter @caatinga/cli pack --pack-destination "$PACKED_DIR"

if tar -xOf "$PACKED_DIR"/*.tgz package/package.json | grep -E 'workspace:\*|link:|file:'; then
  echo "Packed package contains a monorepo-only dependency reference." >&2
  exit 1
fi

cd "$TMP_DIR"
npm init -y >/dev/null
npm install "$PACKED_DIR"/caatinga-core-*.tgz "$PACKED_DIR"/caatinga-client-*.tgz "$PACKED_DIR"/caatinga-cli-*.tgz

node --input-type=module -e 'import { defineConfig } from "@caatinga/core"; console.log(typeof defineConfig)'
node --input-type=module -e 'import { createCaatingaClient } from "@caatinga/client"; console.log(typeof createCaatingaClient)'
npx caatinga --version
npx caatinga init test-app --template react-vite-counter
test -f test-app/caatinga.config.ts
test -f test-app/caatinga.artifacts.json
```

- [ ] **Step 3: Make script executable**

Run:

```bash
chmod +x scripts/consumer-isolation-test.sh
```

- [ ] **Step 4: Run consumer isolation**

Run:

```bash
pnpm test:consumer
```

Expected: exits 0; installed packages are from tarballs in `/tmp/caatinga-consumer-test`, not workspace links.

- [ ] **Step 5: Commit**

```bash
git add .changeset/config.json package.json scripts/consumer-isolation-test.sh pnpm-lock.yaml
git commit -m "chore: add consumer isolation packaging test"
```

---

### Task 7: Release Workflow with Provenance

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `.github/workflows/ci.yml`
- Create: `docs/release/v1-readiness.md`

- [ ] **Step 1: Add release workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      tag:
        description: "Dist tag: alpha, beta, next, or latest"
        required: true
        default: "next"
  release:
    types:
      - published

permissions:
  contents: read
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: "https://registry.npmjs.org"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test

      - name: Consumer isolation
        run: pnpm test:consumer

      - name: Publish
        if: github.event_name == 'release'
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: pnpm publish -r --access public --provenance --tag next
```

- [ ] **Step 2: Add CI consumer isolation as non-release gate**

Modify `.github/workflows/ci.yml` to add after tests:

```yaml
      - name: Consumer isolation
        run: pnpm test:consumer
```

- [ ] **Step 3: Document v1 readiness gate**

Create `docs/release/v1-readiness.md`:

```md
# v1 Readiness

Do not tag `v1.0.0` until these specs are implemented and accepted:

1. Stellar CLI version contract
2. Complete `CAATINGA_*` error surface
3. npm publish and consumer isolation
4. live testnet smoke CI
5. experimental multi-contract dependency deploy

Pre-v1 publishing is allowed only under `0.x`, `alpha`, `beta`, or `next`.

Before `latest`, require:

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:consumer`
- three consecutive successful scheduled testnet smoke runs
- no unretried testnet smoke failure in the last 7 days
```

- [ ] **Step 4: Run workflow-adjacent local checks**

Run:

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm test:consumer
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml docs/release/v1-readiness.md
git commit -m "ci: add release packaging gate"
```

---

### Task 8: Live Testnet Smoke CI

**Files:**
- Create: `.github/workflows/testnet-smoke.yml`
- Create: `scripts/testnet-smoke.sh`
- Modify: `docs/testing.md`
- Modify: `docs/release/v1-readiness.md`

- [ ] **Step 1: Add smoke script**

Create `scripts/testnet-smoke.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${1:-smoke-app}"
IDENTITY_ALIAS="${CAATINGA_CI_IDENTITY_ALIAS:?CAATINGA_CI_IDENTITY_ALIAS is required}"

rm -rf "$APP_NAME"

caatinga --version
stellar --version
caatinga init "$APP_NAME" --template react-vite-counter
cd "$APP_NAME"

caatinga build counter
caatinga deploy counter --network testnet --source "$IDENTITY_ALIAS"

test -f caatinga.artifacts.json
node --input-type=module -e '
import fs from "node:fs";
const artifacts = JSON.parse(fs.readFileSync("caatinga.artifacts.json", "utf8"));
const contractId = artifacts.networks?.testnet?.contracts?.counter?.contractId;
if (!/^C[A-Z0-9]{55}$/.test(contractId ?? "")) {
  console.error(`Invalid contractId: ${contractId}`);
  process.exit(1);
}
'

caatinga generate counter --network testnet
test -d src/contracts/generated

caatinga invoke counter.increment --network testnet --source "$IDENTITY_ALIAS"
```

- [ ] **Step 2: Make script executable**

Run:

```bash
chmod +x scripts/testnet-smoke.sh
```

- [ ] **Step 3: Add GitHub workflow**

Create `.github/workflows/testnet-smoke.yml`:

```yaml
name: Testnet Smoke

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:
  release:
    types:
      - published

jobs:
  smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Restore Stellar CLI config
        env:
          CAATINGA_CI_STELLAR_CONFIG_B64: ${{ secrets.CAATINGA_CI_STELLAR_CONFIG_B64 }}
        run: |
          test -n "$CAATINGA_CI_STELLAR_CONFIG_B64"
          mkdir -p "$HOME/.config/stellar"
          echo "$CAATINGA_CI_STELLAR_CONFIG_B64" | base64 --decode > "$HOME/.config/stellar/config.toml"
          chmod 600 "$HOME/.config/stellar/config.toml"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build packages
        run: pnpm build

      - name: Link CLI
        run: npm install -g ./packages/core ./packages/cli

      - name: Smoke attempt 1
        id: smoke1
        continue-on-error: true
        env:
          CAATINGA_CI_IDENTITY_ALIAS: ${{ secrets.CAATINGA_CI_IDENTITY_ALIAS }}
        run: scripts/testnet-smoke.sh smoke-app

      - name: Smoke retry
        if: steps.smoke1.outcome == 'failure'
        env:
          CAATINGA_CI_IDENTITY_ALIAS: ${{ secrets.CAATINGA_CI_IDENTITY_ALIAS }}
        run: scripts/testnet-smoke.sh smoke-app-retry

      - name: Upload smoke artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: testnet-smoke-artifacts
          path: |
            smoke-app/caatinga.artifacts.json
            smoke-app-retry/caatinga.artifacts.json
          if-no-files-found: ignore

      - name: Remove Stellar CLI config
        if: always()
        run: rm -f "$HOME/.config/stellar/config.toml"
```

- [ ] **Step 4: Document secrets and release gate**

Modify `docs/testing.md`:

```md
Live testnet smoke uses `CAATINGA_CI_IDENTITY_ALIAS` and `CAATINGA_CI_STELLAR_CONFIG_B64`. Caatinga receives only the identity alias through `--source`; secret material is restored into Stellar CLI config and deleted after the job.
```

Modify `docs/release/v1-readiness.md`:

```md
The v1 release requires three consecutive successful scheduled `Testnet Smoke` runs and no unretried smoke failure in the previous 7 days.
```

- [ ] **Step 5: Run local syntax and default checks**

Run:

```bash
bash -n scripts/testnet-smoke.sh
git diff --check
pnpm typecheck
```

Expected: all commands exit 0. Do not run live testnet locally unless credentials are configured.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/testnet-smoke.yml scripts/testnet-smoke.sh docs/testing.md docs/release/v1-readiness.md
git commit -m "ci: add live testnet smoke workflow"
```

---

### Task 9: Multi-Contract Config and Artifact Schema

**Files:**
- Modify: `packages/core/src/config/config.schema.ts`
- Modify: `packages/core/src/config/config.schema.test.ts`
- Modify: `packages/core/src/artifacts/artifact.schema.ts`
- Modify: `packages/core/src/artifacts/read-write-artifacts.test.ts`
- Modify: `docs/config.md`

- [ ] **Step 1: Add failing config schema tests**

Add to `packages/core/src/config/config.schema.test.ts`:

```ts
it("accepts contract dependencies and deploy args", () => {
  const result = CaatingaConfigSchema.parse({
    project: "marketplace-app",
    defaultNetwork: "testnet",
    contracts: {
      token: {
        path: "./contracts/token",
        wasm: "./contracts/token/target/wasm32v1-none/release/token.wasm"
      },
      marketplace: {
        path: "./contracts/marketplace",
        wasm: "./contracts/marketplace/target/wasm32v1-none/release/marketplace.wasm",
        dependsOn: ["token"],
        deployArgs: {
          tokenContractId: "${contracts.token.contractId}"
        }
      }
    },
    networks: {
      testnet: {
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015"
      }
    },
    frontend: {
      framework: "vite-react",
      bindingsOutput: "./src/contracts/generated"
    }
  });

  expect(result.contracts.marketplace.dependsOn).toEqual(["token"]);
  expect(result.contracts.marketplace.deployArgs).toEqual({
    tokenContractId: "${contracts.token.contractId}"
  });
});
```

- [ ] **Step 2: Add failing artifact schema test**

Add to `packages/core/src/artifacts/read-write-artifacts.test.ts`:

```ts
it("accepts dependency metadata in version 1 artifacts", () => {
  const artifacts = CaatingaArtifactsSchema.parse({
    project: "marketplace-app",
    version: 1,
    networks: {
      testnet: {
        contracts: {
          token: {
            contractId: "C".padEnd(56, "A"),
            wasmHash: "hash-token",
            deployedAt: "2026-05-12T00:00:00.000Z",
            sourcePath: "./contracts/token",
            wasmPath: "./contracts/token.wasm",
            dependencies: []
          },
          marketplace: {
            contractId: "C".padEnd(56, "B"),
            wasmHash: "hash-marketplace",
            deployedAt: "2026-05-12T00:00:00.000Z",
            sourcePath: "./contracts/marketplace",
            wasmPath: "./contracts/marketplace.wasm",
            dependencies: ["token"],
            resolvedDeployArgs: {
              tokenContractId: "C".padEnd(56, "A")
            }
          }
        },
        dependencyGraph: {
          token: [],
          marketplace: ["token"]
        }
      }
    }
  });

  expect(artifacts.networks.testnet.dependencyGraph?.marketplace).toEqual(["token"]);
});
```

- [ ] **Step 3: Run failing schema tests**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/config/config.schema.test.ts packages/core/src/artifacts/read-write-artifacts.test.ts
```

Expected: FAIL because schema does not accept the new fields.

- [ ] **Step 4: Update config schema**

Modify `packages/core/src/config/config.schema.ts`:

```ts
const DeployArgValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const ContractConfigSchema = z.object({
  path: z.string().min(1),
  wasm: z.string().min(1),
  dependsOn: z.array(z.string().min(1)).default([]),
  deployArgs: z.record(z.string().min(1), DeployArgValueSchema).default({})
});
```

- [ ] **Step 5: Update artifact schema**

Modify `packages/core/src/artifacts/artifact.schema.ts`:

```ts
export const ContractArtifactSchema = z.object({
  contractId: z.string().min(1),
  wasmHash: z.string().min(1),
  deployedAt: z.string().datetime(),
  sourcePath: z.string().min(1),
  wasmPath: z.string().min(1),
  dependencies: z.array(z.string().min(1)).default([]),
  resolvedDeployArgs: z.record(z.string().min(1), z.union([z.string(), z.number(), z.boolean()])).default({})
});

export const NetworkArtifactsSchema = z.object({
  contracts: z.record(z.string().min(1), ContractArtifactSchema).default({}),
  dependencyGraph: z.record(z.string().min(1), z.array(z.string().min(1))).default({})
});
```

- [ ] **Step 6: Document config shape**

Modify `docs/config.md` with a multi-contract example matching Spec 05.

- [ ] **Step 7: Run schema tests**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/config/config.schema.test.ts packages/core/src/artifacts/read-write-artifacts.test.ts
pnpm typecheck
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/config packages/core/src/artifacts docs/config.md
git commit -m "feat: add multi-contract config schema"
```

---

### Task 10: Dependency Graph and Deploy Arg Resolution

**Files:**
- Create: `packages/core/src/contracts/dependency-graph.ts`
- Create: `packages/core/src/contracts/dependency-graph.test.ts`
- Create: `packages/core/src/contracts/resolve-deploy-order.ts`
- Create: `packages/core/src/contracts/resolve-deploy-order.test.ts`
- Create: `packages/core/src/contracts/resolve-deploy-args.ts`
- Create: `packages/core/src/contracts/resolve-deploy-args.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add graph tests**

Create `packages/core/src/contracts/resolve-deploy-order.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveDeployOrder } from "./resolve-deploy-order.js";

describe("resolveDeployOrder", () => {
  const contracts = {
    token: { path: "./contracts/token", wasm: "./token.wasm", dependsOn: [], deployArgs: {} },
    marketplace: { path: "./contracts/marketplace", wasm: "./marketplace.wasm", dependsOn: ["token"], deployArgs: {} },
    rewards: { path: "./contracts/rewards", wasm: "./rewards.wasm", dependsOn: ["marketplace"], deployArgs: {} }
  };

  it("sorts two contracts in dependency order", () => {
    expect(resolveDeployOrder({ contracts, selectedContract: "marketplace", includeDependencies: true })).toEqual([
      "token",
      "marketplace"
    ]);
  });

  it("sorts three contracts in dependency order", () => {
    expect(resolveDeployOrder({ contracts, includeDependencies: true })).toEqual([
      "token",
      "marketplace",
      "rewards"
    ]);
  });

  it("fails for unknown dependency", () => {
    expect(() =>
      resolveDeployOrder({
        contracts: {
          marketplace: { path: "./contracts/marketplace", wasm: "./marketplace.wasm", dependsOn: ["token"], deployArgs: {} }
        },
        includeDependencies: true
      })
    ).toThrowError(expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_NOT_FOUND }));
  });

  it("fails for dependency cycles", () => {
    expect(() =>
      resolveDeployOrder({
        contracts: {
          a: { path: "./a", wasm: "./a.wasm", dependsOn: ["b"], deployArgs: {} },
          b: { path: "./b", wasm: "./b.wasm", dependsOn: ["a"], deployArgs: {} }
        },
        includeDependencies: true
      })
    ).toThrowError(expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_CYCLE }));
  });
});
```

- [ ] **Step 2: Add deploy arg tests**

Create `packages/core/src/contracts/resolve-deploy-args.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveDeployArgs } from "./resolve-deploy-args.js";

describe("resolveDeployArgs", () => {
  const artifacts = {
    project: "marketplace-app",
    version: 1 as const,
    networks: {
      testnet: {
        contracts: {
          token: {
            contractId: "C".padEnd(56, "A"),
            wasmHash: "hash",
            deployedAt: "2026-05-12T00:00:00.000Z",
            sourcePath: "./contracts/token",
            wasmPath: "./token.wasm",
            dependencies: [],
            resolvedDeployArgs: {}
          }
        },
        dependencyGraph: {
          token: []
        }
      }
    }
  };

  it("resolves contractId placeholders from artifacts", () => {
    expect(
      resolveDeployArgs({
        deployArgs: { tokenContractId: "${contracts.token.contractId}", supply: 1000 },
        artifacts,
        network: "testnet"
      })
    ).toEqual({
      tokenContractId: "C".padEnd(56, "A"),
      supply: 1000
    });
  });

  it("rejects unsupported placeholders", () => {
    expect(() =>
      resolveDeployArgs({
        deployArgs: { secret: "${env.SECRET}" },
        artifacts,
        network: "testnet"
      })
    ).toThrowError(expect.objectContaining({ code: CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_INVALID }));
  });

  it("fails when dependency artifact is missing", () => {
    expect(() =>
      resolveDeployArgs({
        deployArgs: { tokenContractId: "${contracts.missing.contractId}" },
        artifacts,
        network: "testnet"
      })
    ).toThrowError(expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND }));
  });
});
```

- [ ] **Step 3: Run failing graph tests**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/contracts/resolve-deploy-order.test.ts packages/core/src/contracts/resolve-deploy-args.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement deploy order**

Create `packages/core/src/contracts/resolve-deploy-order.ts` with deterministic DFS topological sort:

```ts
import type { ContractConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

type VisitState = "visiting" | "visited";

export function resolveDeployOrder(input: {
  contracts: Record<string, ContractConfig>;
  selectedContract?: string;
  includeDependencies: boolean;
}): string[] {
  const order: string[] = [];
  const state = new Map<string, VisitState>();
  const selected = input.selectedContract ? [input.selectedContract] : Object.keys(input.contracts);

  for (const contractName of selected) {
    visit(contractName, []);
  }

  return order;

  function visit(contractName: string, stack: string[]): void {
    const contract = input.contracts[contractName];

    if (!contract) {
      throw new CaatingaError(
        `Contract dependency "${contractName}" was not found.`,
        CaatingaErrorCode.CONTRACT_DEPENDENCY_NOT_FOUND,
        "Add the dependency to caatinga.config.ts or remove it from dependsOn."
      );
    }

    if (state.get(contractName) === "visited") {
      return;
    }

    if (state.get(contractName) === "visiting") {
      throw new CaatingaError(
        `Contract dependency cycle detected: ${[...stack, contractName].join(" -> ")}.`,
        CaatingaErrorCode.CONTRACT_DEPENDENCY_CYCLE,
        "Remove the cycle from dependsOn."
      );
    }

    state.set(contractName, "visiting");

    if (input.includeDependencies) {
      for (const dependency of contract.dependsOn) {
        visit(dependency, [...stack, contractName]);
      }
    } else if (contract.dependsOn.length > 0 && input.selectedContract === contractName) {
      for (const dependency of contract.dependsOn) {
        if (!input.contracts[dependency]) {
          throw new CaatingaError(
            `Contract dependency "${dependency}" was not found.`,
            CaatingaErrorCode.CONTRACT_DEPENDENCY_NOT_FOUND,
            "Add the dependency to caatinga.config.ts or remove it from dependsOn."
          );
        }
      }
    }

    state.set(contractName, "visited");
    if (!order.includes(contractName)) {
      order.push(contractName);
    }
  }
}
```

- [ ] **Step 5: Implement deploy arg resolver**

Create `packages/core/src/contracts/resolve-deploy-args.ts`:

```ts
import type { CaatingaArtifacts } from "../artifacts/artifact.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const CONTRACT_ID_PLACEHOLDER = /^\$\{contracts\.([A-Za-z0-9_-]+)\.contractId\}$/;

export type DeployArgValue = string | number | boolean;

export function resolveDeployArgs(input: {
  deployArgs: Record<string, DeployArgValue>;
  artifacts: CaatingaArtifacts;
  network: string;
}): Record<string, DeployArgValue> {
  const resolved: Record<string, DeployArgValue> = {};

  for (const [key, value] of Object.entries(input.deployArgs)) {
    if (typeof value !== "string" || !value.includes("${")) {
      resolved[key] = value;
      continue;
    }

    const match = value.match(CONTRACT_ID_PLACEHOLDER);
    if (!match) {
      throw new CaatingaError(
        `Deploy arg "${key}" contains an unsupported placeholder.`,
        CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_INVALID,
        "Use only ${contracts.<contractName>.contractId}."
      );
    }

    const contractName = match[1];
    const contractArtifact = input.artifacts.networks[input.network]?.contracts[contractName];

    if (!contractArtifact?.contractId) {
      throw new CaatingaError(
        `No dependency artifact found for "${contractName}" on "${input.network}".`,
        CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND,
        "Deploy the dependency first or run deploy without --no-deps."
      );
    }

    resolved[key] = contractArtifact.contractId;
  }

  return resolved;
}
```

- [ ] **Step 6: Export modules**

Modify `packages/core/src/index.ts`:

```ts
export * from "./contracts/resolve-deploy-order.js";
export * from "./contracts/resolve-deploy-args.js";
```

- [ ] **Step 7: Run graph tests**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/contracts/resolve-deploy-order.test.ts packages/core/src/contracts/resolve-deploy-args.test.ts
pnpm typecheck
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/contracts/resolve-deploy-order.ts packages/core/src/contracts/resolve-deploy-order.test.ts packages/core/src/contracts/resolve-deploy-args.ts packages/core/src/contracts/resolve-deploy-args.test.ts packages/core/src/index.ts
git commit -m "feat: resolve contract dependency deploy order"
```

---

### Task 11: Deploy Graph Runtime and CLI

**Files:**
- Create: `packages/core/src/contracts/deploy-contract-graph.ts`
- Create: `packages/core/src/contracts/deploy-contract-graph.test.ts`
- Modify: `packages/core/src/contracts/deploy-contract.ts`
- Modify: `packages/core/src/artifacts/update-artifact.ts`
- Modify: `packages/cli/src/commands/deploy.command.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add deploy graph tests with mocked single deploy**

Create `packages/core/src/contracts/deploy-contract-graph.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { deployContractGraph } from "./deploy-contract-graph.js";

const deployContractMock = vi.hoisted(() => vi.fn());
const readArtifactsMock = vi.hoisted(() => vi.fn());

vi.mock("./deploy-contract.js", () => ({
  deployContract: deployContractMock
}));

vi.mock("../artifacts/read-artifacts.js", () => ({
  readArtifacts: readArtifactsMock
}));

const config: CaatingaConfig = {
  project: "marketplace-app",
  defaultNetwork: "testnet",
  contracts: {
    token: {
      path: "./contracts/token",
      wasm: "./token.wasm",
      dependsOn: [],
      deployArgs: {}
    },
    marketplace: {
      path: "./contracts/marketplace",
      wasm: "./marketplace.wasm",
      dependsOn: ["token"],
      deployArgs: {
        tokenContractId: "${contracts.token.contractId}"
      }
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./src/contracts/generated"
  }
};

describe("deployContractGraph", () => {
  it("deploys dependencies before dependents", async () => {
    readArtifactsMock.mockResolvedValue({
      project: "marketplace-app",
      version: 1,
      networks: { testnet: { contracts: {}, dependencyGraph: {} } }
    });
    deployContractMock
      .mockResolvedValueOnce({ contractId: "C".padEnd(56, "A"), contract: { name: "token" } })
      .mockResolvedValueOnce({ contractId: "C".padEnd(56, "B"), contract: { name: "marketplace" } });

    const result = await deployContractGraph({
      config,
      contractName: "marketplace",
      networkName: "testnet",
      source: "alice",
      cwd: "/tmp/app",
      includeDependencies: true,
      force: false
    });

    expect(result.deployedContracts.map((contract) => contract.name)).toEqual(["token", "marketplace"]);
    expect(deployContractMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ contractName: "token" }));
    expect(deployContractMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        contractName: "marketplace",
        resolvedDeployArgs: { tokenContractId: "C".padEnd(56, "A") }
      })
    );
  });

  it("fails --no-deps when dependency artifact is missing", async () => {
    readArtifactsMock.mockResolvedValue({
      project: "marketplace-app",
      version: 1,
      networks: { testnet: { contracts: {}, dependencyGraph: {} } }
    });

    await expect(
      deployContractGraph({
        config,
        contractName: "marketplace",
        networkName: "testnet",
        source: "alice",
        cwd: "/tmp/app",
        includeDependencies: false,
        force: false
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND });
  });
});
```

- [ ] **Step 2: Run failing deploy graph test**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/contracts/deploy-contract-graph.test.ts
```

Expected: FAIL because deploy graph module does not exist.

- [ ] **Step 3: Extend `deployContract` inputs**

Modify `DeployContractOptions` in `packages/core/src/contracts/deploy-contract.ts`:

```ts
export type DeployContractOptions = {
  config: CaatingaConfig;
  contractName: string;
  networkName?: string;
  source?: string;
  cwd?: string;
  allowUntestedStellarCli?: boolean;
  force?: boolean;
  resolvedDeployArgs?: Record<string, string | number | boolean>;
  dependencies?: string[];
};
```

Append resolved deploy args to Stellar CLI args using explicit `--` only if the current Stellar CLI deploy command expects init args. If deploy args are not supported by the current CLI command shape, fail with `CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED` rather than silently ignoring them.

When writing artifacts, include:

```ts
dependencies: options.dependencies ?? contract.config.dependsOn,
resolvedDeployArgs: options.resolvedDeployArgs ?? {}
```

- [ ] **Step 4: Implement deploy graph**

Create `packages/core/src/contracts/deploy-contract-graph.ts`:

```ts
import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { deployContract } from "./deploy-contract.js";
import { resolveDeployArgs } from "./resolve-deploy-args.js";
import { resolveDeployOrder } from "./resolve-deploy-order.js";

export async function deployContractGraph(options: {
  config: CaatingaConfig;
  contractName?: string;
  networkName?: string;
  source?: string;
  cwd?: string;
  includeDependencies: boolean;
  force: boolean;
  allowUntestedStellarCli?: boolean;
}) {
  const cwd = options.cwd ?? process.cwd();
  const network = resolveNetwork(options.config, options.networkName);
  const order = resolveDeployOrder({
    contracts: options.config.contracts,
    selectedContract: options.contractName,
    includeDependencies: options.includeDependencies
  });
  const deployedContracts: Array<{ name: string; contractId: string }> = [];

  for (const contractName of order) {
    const artifacts = await readArtifacts(cwd);
    const existing = artifacts.networks[network.name]?.contracts[contractName];
    const contractConfig = options.config.contracts[contractName];
    const resolvedDeployArgs = resolveDeployArgs({
      deployArgs: contractConfig.deployArgs,
      artifacts,
      network: network.name
    });

    if (existing?.contractId && !options.force) {
      deployedContracts.push({ name: contractName, contractId: existing.contractId });
      continue;
    }

    const result = await deployContract({
      config: options.config,
      contractName,
      networkName: network.name,
      source: options.source,
      cwd,
      allowUntestedStellarCli: options.allowUntestedStellarCli,
      force: options.force,
      resolvedDeployArgs,
      dependencies: contractConfig.dependsOn
    });

    deployedContracts.push({ name: contractName, contractId: result.contractId });
  }

  return {
    network,
    deployedContracts
  };
}
```

- [ ] **Step 5: Update CLI deploy command**

Modify `packages/cli/src/commands/deploy.command.ts`:

```ts
program
  .command("deploy")
  .description("Deploy one or all configured Soroban contracts")
  .argument("[contract]", "Contract name")
  .option("-n, --network <network>", "Configured network name")
  .requiredOption("-s, --source <source>", "Stellar CLI identity alias")
  .option("--force", "Redeploy contracts even if artifacts already contain contract IDs")
  .option("--no-deps", "Do not deploy missing dependencies for a selected contract")
  .option("--allow-untested-stellar-cli", "Allow local use of a Stellar CLI version newer than Caatinga's tested maximum")
  .action((contractName: string | undefined, options: {
    network?: string;
    source: string;
    force?: boolean;
    deps?: boolean;
    allowUntestedStellarCli?: boolean;
  }) => runCliAction(async () => {
    const config = await loadConfig();
    const result = await deployContractGraph({
      config,
      contractName,
      networkName: options.network,
      source: options.source,
      includeDependencies: options.deps !== false,
      force: options.force === true,
      allowUntestedStellarCli: options.allowUntestedStellarCli === true
    });

    logger.success("Deploy complete");
    logger.info("");
    logger.info(`Network: ${result.network.name}`);
    for (const contract of result.deployedContracts) {
      logger.info(`Contract: ${contract.name}`);
      logger.info(`Contract ID: ${contract.contractId}`);
    }
    logger.info("Artifacts updated: caatinga.artifacts.json");
  }));
```

- [ ] **Step 6: Export deploy graph**

Modify `packages/core/src/index.ts`:

```ts
export * from "./contracts/deploy-contract-graph.js";
```

- [ ] **Step 7: Run deploy graph tests**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/contracts/deploy-contract-graph.test.ts packages/core/src/contracts/deploy-contract.test.ts
pnpm typecheck
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/contracts packages/core/src/artifacts packages/cli/src/commands/deploy.command.ts packages/core/src/index.ts
git commit -m "feat: deploy contracts by dependency graph"
```

---

### Task 12: Multi-Contract Template and ADR

**Files:**
- Create: `packages/templates/marketplace-with-token/caatinga.template.json`
- Create: `packages/templates/marketplace-with-token/caatinga.config.ts`
- Create: `packages/templates/marketplace-with-token/caatinga.artifacts.json`
- Create: `packages/templates/marketplace-with-token/README.md`
- Create: minimal template source files under `packages/templates/marketplace-with-token`
- Modify: `packages/core/src/templates/create-project-from-template.test.ts`
- Modify: `docs/templates.md`
- Modify: `docs/adr/0005-multi-contract-dependency-deploy.md`

- [ ] **Step 1: Add template regression test**

Modify `packages/core/src/templates/create-project-from-template.test.ts` to add:

```ts
it("ships marketplace-with-token as a multi-contract dependency template", async () => {
  const templatePath = join(templateRoot, "marketplace-with-token");
  const manifest = JSON.parse(readFileSync(join(templatePath, "caatinga.template.json"), "utf8"));
  const config = readFileSync(join(templatePath, "caatinga.config.ts"), "utf8");

  expect(manifest.name).toBe("marketplace-with-token");
  expect(config).toContain("dependsOn: [\"token\"]");
  expect(config).toContain("tokenContractId: \"${contracts.token.contractId}\"");
});
```

- [ ] **Step 2: Run failing template test**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/templates/create-project-from-template.test.ts
```

Expected: FAIL because the template does not exist.

- [ ] **Step 3: Create template manifest**

Create `packages/templates/marketplace-with-token/caatinga.template.json`:

```json
{
  "name": "marketplace-with-token",
  "version": "0.1.0",
  "description": "Experimental multi-contract Soroban template with token dependency injection.",
  "caatinga": {
    "compatibleCore": "^0.1.0",
    "templateVersion": 1
  },
  "frontend": {
    "framework": "vite-react",
    "packageManager": "npm"
  },
  "contracts": {
    "path": "contracts",
    "default": "marketplace"
  },
  "files": {
    "config": "caatinga.config.ts",
    "artifacts": "caatinga.artifacts.json"
  }
}
```

- [ ] **Step 4: Create template config**

Create `packages/templates/marketplace-with-token/caatinga.config.ts`:

```ts
import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "__PROJECT_NAME__",
  defaultNetwork: "testnet",
  contracts: {
    token: {
      path: "./contracts/token",
      wasm: "./contracts/token/target/wasm32v1-none/release/token.wasm"
    },
    marketplace: {
      path: "./contracts/marketplace",
      wasm: "./contracts/marketplace/target/wasm32v1-none/release/marketplace.wasm",
      dependsOn: ["token"],
      deployArgs: {
        tokenContractId: "${contracts.token.contractId}"
      }
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./src/contracts/generated"
  }
});
```

- [ ] **Step 5: Create template README**

Create `packages/templates/marketplace-with-token/README.md`:

```md
# __PROJECT_NAME__

Experimental Caatinga multi-contract template.

## Deploy

```bash
npm install
npx caatinga build token
npx caatinga build marketplace
npx caatinga deploy --network testnet --source alice
```

Deploy order:

1. `token`
2. `marketplace`

`marketplace.deployArgs.tokenContractId` resolves from `${contracts.token.contractId}` after the token deploy writes `caatinga.artifacts.json`.
```

- [ ] **Step 6: Create minimal template placeholders**

Create:

```txt
packages/templates/marketplace-with-token/caatinga.artifacts.json
packages/templates/marketplace-with-token/contracts/token/.gitkeep
packages/templates/marketplace-with-token/contracts/marketplace/.gitkeep
packages/templates/marketplace-with-token/src/main.ts
packages/templates/marketplace-with-token/package.json
packages/templates/marketplace-with-token/tsconfig.json
```

Use `caatinga.artifacts.json`:

```json
{
  "project": "__PROJECT_NAME__",
  "version": 1,
  "networks": {
    "testnet": {
      "contracts": {},
      "dependencyGraph": {}
    }
  }
}
```

- [ ] **Step 7: Update ADR 0005**

Modify `docs/adr/0005-multi-contract-dependency-deploy.md`:

```md
## Status

Accepted

## Context

Multi-contract deployment is the first Caatinga workflow that is materially more useful than ad-hoc package scripts. Dependents need upstream `contractId`s without unsafe shell interpolation or environment mutation.

## Decision

Caatinga core owns `dependsOn`, topological deploy order, and `${contracts.<contractName>.contractId}` placeholder resolution. The placeholder language is intentionally narrow and reads only from `caatinga.artifacts.json`.

## Consequences

- Dependency deploy order is deterministic and testable.
- Artifact schema version remains `1` because new fields are optional and backward-compatible.
- Environment variables and shell interpolation are rejected.
- The feature is experimental until at least one real multi-contract template is validated.
```

- [ ] **Step 8: Run template tests**

Run:

```bash
pnpm --filter @caatinga/core test -- --run packages/core/src/templates/create-project-from-template.test.ts
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 9: Commit**

```bash
git add packages/templates/marketplace-with-token packages/core/src/templates/create-project-from-template.test.ts docs/templates.md docs/adr/0005-multi-contract-dependency-deploy.md
git commit -m "feat: add multi-contract marketplace template"
```

---

### Task 13: Final v1 Viability Verification

**Files:**
- Modify: `docs/release/v1-readiness.md`
- Modify: `README.md`

- [ ] **Step 1: Add final docs links**

Modify `README.md` documentation list to include:

```md
- **[Stellar CLI version contract](./docs/stellar-cli-version-contract.md)** — supported Stellar CLI range and override policy.
- **[v1 readiness](./docs/release/v1-readiness.md)** — release gates before `v1.0.0`.
```

Modify `docs/release/v1-readiness.md` to mark every implemented spec as complete only after the relevant task commits exist.

- [ ] **Step 2: Run full local verification**

Run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
pnpm test:consumer
git diff --check
```

Expected:

- install exits 0
- typecheck exits 0
- build exits 0
- test exits 0
- consumer isolation exits 0
- diff check exits 0

- [ ] **Step 3: Confirm v1 release rule remains enforced in docs**

Run:

```bash
grep -R "Do not tag.*v1.0.0" docs/superpowers/specs/00-v1-viability-index.md docs/release/v1-readiness.md
grep -R "alpha\\|beta\\|next" docs/superpowers/specs/00-v1-viability-index.md docs/release/v1-readiness.md
```

Expected: both commands print matching lines.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/release/v1-readiness.md
git commit -m "docs: document v1 readiness gates"
```

---

## Self-Review

Spec coverage:

- Spec 01 is covered by Tasks 1-3.
- Spec 02 is covered by Task 4.
- Spec 03 is covered by Tasks 5-7.
- Spec 04 is covered by Task 8.
- Spec 05 is covered by Tasks 9-12.
- The v1 release rule from `00-v1-viability-index.md` is covered by Task 13.

Placeholder scan:

- The plan has no deferred work markers or generic error-handling instructions.
- Each code task includes exact target files, test commands, expected results, and commit commands.

Type consistency:

- Stellar CLI override option is consistently named `allowUntestedStellarCli`.
- Dependency config fields are consistently named `dependsOn` and `deployArgs`.
- Artifact metadata fields are consistently named `dependencies`, `resolvedDeployArgs`, and `dependencyGraph`.
- New error code keys map to public `CAATINGA_*` values.
