# CLI Prepack Template Include Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `caatinga init` succeed from a `file:`-tarball install of `@caatinga/cli` in a fresh project without `CAATINGA_TEMPLATES_DIR`, by guaranteeing every packed CLI tarball includes bundled templates and by giving developers a clear next step when resolution still fails.

**Architecture:** Add a 1-line `prepack` script to `packages/cli/package.json` so `pnpm pack` / `pnpm publish` always run through the existing `build` step that copies templates. CI gates in `scripts/ci-snapshot-pack.sh` and `scripts/consumer-isolation-test.sh` are extended to require **all** `packages/templates/*` directories to appear in the tarball, not only `react-vite-counter`. The resolution error hint in `packages/cli/src/utils/template-path.ts` is updated to mention the new prerequisite, and a debug env var prints the candidates tried when set.

**Tech Stack:** Bash, pnpm, Changesets, npm tarballs, Vitest, TypeScript, tsup

---

### Task 1: Add `CAATINGA_DEBUG_TEMPLATE_RESOLUTION` diagnostic print

**Files:**
- Modify: `packages/cli/src/utils/template-path.ts`
- Modify: `packages/cli/src/utils/template-path.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the contents of `packages/cli/src/utils/template-path.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "@caatinga/core";

const accessMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    access: accessMock
  };
});

import { resolveTemplateDir } from "./template-path.js";

describe("resolveTemplateDir", () => {
  const previousTemplatesDir = process.env.CAATINGA_TEMPLATES_DIR;
  const previousDebug = process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION;

  beforeEach(() => {
    delete process.env.CAATINGA_TEMPLATES_DIR;
    delete process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION;
    accessMock.mockRejectedValue(new Error("ENOENT"));
  });

  afterEach(() => {
    accessMock.mockReset();
    if (previousTemplatesDir === undefined) {
      delete process.env.CAATINGA_TEMPLATES_DIR;
    } else {
      process.env.CAATINGA_TEMPLATES_DIR = previousTemplatesDir;
    }
    if (previousDebug === undefined) {
      delete process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION;
    } else {
      process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION = previousDebug;
    }
  });

  it("throws TEMPLATE_NOT_FOUND when no template candidate is accessible", async () => {
    await expect(resolveTemplateDir("__caatinga_nonexistent_template__")).rejects.toMatchObject({
      code: CaatingaErrorCode.TEMPLATE_NOT_FOUND
    });
  });

  it("prints the candidates it tried when CAATINGA_DEBUG_TEMPLATE_RESOLUTION=1", async () => {
    process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION = "1";
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      await expect(resolveTemplateDir("__caatinga_nonexistent_template__")).rejects.toMatchObject({
        code: CaatingaErrorCode.TEMPLATE_NOT_FOUND
      });

      const output = stderrSpy.mock.calls.map((call) => call[0]).join("");
      expect(output).toContain("caatinga: template resolution candidates for \"__caatinga_nonexistent_template__\"");
      expect(output).toContain("env=");
      expect(output).toContain("cwd=");
    } finally {
      stderrSpy.mockRestore();
    }
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
pnpm --filter @caatinga/cli test -- template-path.test.ts
```

Expected: the second `it` block fails with output mentioning `stderrSpy` was not called or the debug line was not printed.

- [ ] **Step 3: Implement the debug print in `resolveTemplateDir`**

Replace the entire contents of `packages/cli/src/utils/template-path.ts` with:

```ts
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core";

export async function resolveTemplateDir(templateName: string): Promise<string> {
  const candidates = buildTemplateCandidates(templateName);

  if (process.env.CAATINGA_DEBUG_TEMPLATE_RESOLUTION === "1") {
    const envValue = process.env.CAATINGA_TEMPLATES_DIR ?? "<unset>";
    const cwd = process.cwd();
    process.stderr.write(
      `caatinga: template resolution candidates for "${templateName}": env=${envValue} cwd=${cwd}\n`
    );
    for (const candidate of candidates) {
      process.stderr.write(`caatinga: candidate ${candidate}\n`);
    }
  }

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next local development or package layout candidate.
    }
  }

  throw new CaatingaError(
    `Template "${templateName}" was not found.`,
    CaatingaErrorCode.TEMPLATE_NOT_FOUND,
    "Set CAATINGA_TEMPLATES_DIR, run `pnpm build` before `pnpm pack`, or run from a Caatinga checkout that includes packages/templates."
  );
}

function buildTemplateCandidates(templateName: string): string[] {
  const envTemplatesDir = process.env.CAATINGA_TEMPLATES_DIR;
  return [
    envTemplatesDir ? path.join(envTemplatesDir, templateName) : undefined,
    path.resolve(process.cwd(), "packages", "templates", templateName),
    ...candidatePathsFromModule(templateName)
  ].filter((candidate): candidate is string => Boolean(candidate));
}

function candidatePathsFromModule(templateName: string): string[] {
  const currentFile = fileURLToPath(import.meta.url);
  const start = path.dirname(currentFile);
  const candidates: string[] = [];
  let dir = start;

  for (let depth = 0; depth < 8; depth += 1) {
    candidates.push(path.join(dir, "packages", "templates", templateName));
    candidates.push(path.join(dir, "templates", templateName));
    candidates.push(path.join(dir, "node_modules", "@caatinga", "templates", templateName));
    dir = path.dirname(dir);
  }

  return candidates;
}
```

- [ ] **Step 4: Re-run the test to verify it passes**

Run:

```bash
pnpm --filter @caatinga/cli test -- template-path.test.ts
```

Expected: exit code `0`, both `it` blocks pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/utils/template-path.ts packages/cli/src/utils/template-path.test.ts
git commit -m "test(cli): add CAATINGA_DEBUG_TEMPLATE_RESOLUTION diagnostic print"
```

---

### Task 2: Add `prepack` script so `pnpm pack` always bundles templates

**Files:**
- Modify: `packages/cli/package.json`

- [ ] **Step 1: Write the failing verification target**

Run:

```bash
ls packages/cli/templates 2>/dev/null && echo "templates dir present" || echo "templates dir missing"
pnpm --filter @caatinga/cli pack --pack-destination /tmp/caatinga-prepack-check
tar -tzf /tmp/caatinga-prepack-check/caatinga-cli-*.tgz | grep -E '^package/templates/' | head -5 || echo "no templates in tarball"
rm -rf /tmp/caatinga-prepack-check
```

Expected before the fix: `templates dir missing` is printed **or** the `grep` returns nothing (tarball has no `package/templates/...` entries). The user's scenario reproduces.

- [ ] **Step 2: Add the `prepack` script**

Edit `packages/cli/package.json:45-50` so the `scripts` block reads:

```json
  "scripts": {
    "prepack": "pnpm build",
    "build": "tsup src/index.ts --format esm --dts --clean && rm -rf ./templates && cp -r ../templates ./templates",
    "dev": "tsx src/index.ts",
    "test": "vitest run --pool=threads",
    "typecheck": "tsc --noEmit"
  },
```

The only change vs. the original is the new `"prepack": "pnpm build"` line inserted before `"build"`. All other entries are unchanged.

- [ ] **Step 3: Re-run the verification to confirm templates are now bundled**

Run:

```bash
ls packages/cli/templates 2>/dev/null | head -3 || echo "templates dir missing after build"
pnpm --filter @caatinga/cli pack --pack-destination /tmp/caatinga-prepack-check
tar -tzf /tmp/caatinga-prepack-check/caatinga-cli-*.tgz | grep -E '^package/templates/' | head -5
rm -rf /tmp/caatinga-prepack-check
```

Expected:
- `packages/cli/templates` exists and contains at least `react-vite-counter` and `marketplace-with-token`.
- The `grep` line prints at least:
  ```
  package/templates/react-vite-counter/caatinga.template.json
  package/templates/marketplace-with-token/caatinga.template.json
  ```

- [ ] **Step 4: Verify `pnpm build` itself still works in isolation**

Run:

```bash
pnpm --filter @caatinga/cli build
ls packages/cli/templates/react-vite-counter/caatinga.template.json
```

Expected: exit code `0`, the file path prints.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/package.json
git commit -m "fix(cli): add prepack script so tarballs always include templates"
```

---

### Task 3: Harden CI gates to require every template in the packed tarball

**Files:**
- Modify: `scripts/ci-snapshot-pack.sh`
- Modify: `scripts/consumer-isolation-test.sh`

- [ ] **Step 1: Write the failing target**

Run:

```bash
bash -n scripts/ci-snapshot-pack.sh
bash -n scripts/consumer-isolation-test.sh
rm -rf packages/cli/templates
bash scripts/ci-snapshot-pack.sh
```

Expected before the fix: `ci-snapshot-pack.sh` exits non-zero with a message about the CLI tarball missing `package/templates/react-vite-counter/caatinga.template.json` — but only because `react-vite-counter` is hard-coded. If a future template (e.g. `foo-bar`) is added but the gate still only checks `react-vite-counter`, the gate passes by accident. The next steps fix that by iterating over every template.

The current gate that needs replacing is the block at `scripts/ci-snapshot-pack.sh:171-183`:

```bash
if ! archive_contains_path "${cli_tarball[0]}" "package/templates/react-vite-counter/caatinga.template.json"; then
  echo "CLI tarball is missing bundled templates: ${cli_tarball[0]}" >&2
  exit 1
fi

echo "CLI template evidence: package/templates/react-vite-counter/caatinga.template.json"

if ! archive_contains_path "${cli_tarball[0]}" "package/templates/react-vite-counter/package.json"; then
  echo "CLI tarball is missing bundled template package.json: ${cli_tarball[0]}" >&2
  exit 1
fi

echo "CLI template package evidence: package/templates/react-vite-counter/package.json"
```

And the parallel block at `scripts/consumer-isolation-test.sh:97-100`:

```bash
if ! archive_contains_path "${_kcli[0]}" "package/templates/react-vite-counter/caatinga.template.json"; then
  echo "CLI tarball is missing bundled templates: ${_kcli[0]}" >&2
  exit 1
fi
```

- [ ] **Step 2: Replace the hard-coded `react-vite-counter` gate in `ci-snapshot-pack.sh`**

In `scripts/ci-snapshot-pack.sh`, replace lines 171-183 (the block quoted in Step 1) with:

```bash
for template_name in "$TEMPLATES_DIR"/*; do
  if [[ ! -d "$template_name" ]]; then
    continue
  fi
  template_name="$(basename "$template_name")"

  if ! archive_contains_path "${cli_tarball[0]}" "package/templates/${template_name}/caatinga.template.json"; then
    echo "CLI tarball is missing bundled template manifest: package/templates/${template_name}/caatinga.template.json in ${cli_tarball[0]}" >&2
    exit 1
  fi

  echo "CLI template evidence: package/templates/${template_name}/caatinga.template.json"

  if ! archive_contains_path "${cli_tarball[0]}" "package/templates/${template_name}/package.json"; then
    echo "CLI tarball is missing bundled template package.json: package/templates/${template_name}/package.json in ${cli_tarball[0]}" >&2
    exit 1
  fi

  echo "CLI template package evidence: package/templates/${template_name}/package.json"
done
```

`$TEMPLATES_DIR` is already defined at `scripts/ci-snapshot-pack.sh:13`, so no new variable is required.

- [ ] **Step 3: Replace the hard-coded `react-vite-counter` gate in `consumer-isolation-test.sh`**

In `scripts/consumer-isolation-test.sh`, replace lines 97-100 with:

```bash
ROOT_TEMPLATES_DIR="$ROOT_DIR/packages/templates"
if [[ ! -d "$ROOT_TEMPLATES_DIR" ]]; then
  echo "Expected templates directory at $ROOT_TEMPLATES_DIR" >&2
  exit 1
fi

for template_name in "$ROOT_TEMPLATES_DIR"/*; do
  if [[ ! -d "$template_name" ]]; then
    continue
  fi
  template_name="$(basename "$template_name")"

  if ! archive_contains_path "${_kcli[0]}" "package/templates/${template_name}/caatinga.template.json"; then
    echo "CLI tarball is missing bundled template manifest: package/templates/${template_name}/caatinga.template.json in ${_kcli[0]}" >&2
    exit 1
  fi
done
```

- [ ] **Step 4: Re-run the gates to confirm the new iteration passes**

Run:

```bash
bash -n scripts/ci-snapshot-pack.sh
bash -n scripts/consumer-isolation-test.sh
rm -rf packages/cli/templates
bash scripts/ci-snapshot-pack.sh
```

Expected:
- `bash -n` exits 0 for both scripts.
- `ci-snapshot-pack.sh` exits 0 and prints the new `CLI template evidence:` line for **every** template directory under `packages/templates/` (currently `react-vite-counter` and `marketplace-with-token`).

- [ ] **Step 5: Commit**

```bash
git add scripts/ci-snapshot-pack.sh scripts/consumer-isolation-test.sh
git commit -m "chore: harden template bundling gates in ci-snapshot-pack and consumer-isolation"
```

---

### Task 4: Improve the developer-facing error hint

**Files:**
- Modify: `packages/cli/src/utils/template-path.ts`
- Modify: `packages/cli/src/utils/template-path.test.ts`

- [ ] **Step 1: Update the hint string**

In `packages/cli/src/utils/template-path.ts`, change the hint passed to `CaatingaError` (already edited in Task 1, currently at the `throw new CaatingaError(...)` call) to:

```ts
    "Set CAATINGA_TEMPLATES_DIR, run `pnpm build` before `pnpm pack`, or run from a Caatinga checkout that includes packages/templates."
```

This is the same string already produced by Task 1's edit. No source change is needed beyond what Task 1 already wrote. The new test in Task 5 will assert it.

- [ ] **Step 2: Add a test that asserts the updated hint text**

Open `packages/cli/src/utils/template-path.test.ts` and add a new `it` block inside the `describe("resolveTemplateDir", ...)`:

```ts
  it("mentions the pnpm build prerequisite in the error hint", async () => {
    await expect(resolveTemplateDir("__caatinga_nonexistent_template__")).rejects.toMatchObject({
      code: CaatingaErrorCode.TEMPLATE_NOT_FOUND,
      message: expect.stringContaining('Template "__caatinga_nonexistent_template__" was not found.')
    });

    await expect(resolveTemplateDir("__caatinga_nonexistent_template__")).rejects.toMatchObject({
      code: CaatingaErrorCode.TEMPLATE_NOT_FOUND,
      hint: expect.stringContaining("pnpm build")
    });
  });
```

If `CaatingaError` does not expose `hint` as a property, replace the second `rejects.toMatchObject` block with:

```ts
    try {
      await resolveTemplateDir("__caatinga_nonexistent_template__");
      throw new Error("Expected resolveTemplateDir to reject");
    } catch (error) {
      const hint = (error as { hint?: string }).hint ?? "";
      expect(hint).toContain("pnpm build");
    }
```

Use whichever variant matches the real `CaatingaError` shape. Verify with:

```bash
grep -n 'hint' packages/core/src/errors/CaatingaError.ts
```

If the file shows a `hint` constructor parameter, the first variant is correct; otherwise use the second.

- [ ] **Step 3: Run the test to confirm it passes**

Run:

```bash
pnpm --filter @caatinga/cli test -- template-path.test.ts
```

Expected: exit code `0`, all `it` blocks pass.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/utils/template-path.test.ts
git commit -m "test(cli): assert the new pnpm build hint in template resolution"
```

---

### Task 5: End-to-end re-test of the user scenario

**Files:** Verification only (no source changes).

- [ ] **Step 1: Build a fresh tarball with the new `prepack` script**

Run:

```bash
pnpm install --frozen-lockfile
pnpm --filter @caatinga/cli build
pnpm --filter @caatinga/cli pack --pack-destination /tmp/caatinga-e2e
TARBALL=$(ls /tmp/caatinga-e2e/caatinga-cli-*.tgz | head -1)
echo "Using $TARBALL"
tar -tzf "$TARBALL" | grep -E '^package/templates/' | sort
```

Expected: prints the full template tree from the tarball, including both `react-vite-counter/caatinga.template.json` and `marketplace-with-token/caatinga.template.json`.

- [ ] **Step 2: Install in a fresh project and run `caatinga init` with no env var**

Run:

```bash
TMP_DIR=$(mktemp -d /tmp/caatinga-e2e-app.XXXXXX)
cd "$TMP_DIR"
unset CAATINGA_TEMPLATES_DIR
npm init -y >/dev/null
npm install --no-audit --fund=false "$TARBALL"
npx caatinga init my-app
test -f my-app/caatinga.config.ts
test -f my-app/caatinga.artifacts.json
echo "E2E init OK"
```

Expected:
- `npm install` succeeds.
- `npx caatinga init my-app` prints `Project created` and the `Next steps:` block.
- Both file checks pass.
- Final line is `E2E init OK`.

- [ ] **Step 3: Build the generated app to confirm wiring**

Run:

```bash
cd "$TMP_DIR/my-app"
npm install --no-audit --fund=false
npm run build
echo "E2E build OK"
```

Expected: `npm run build` exits 0, `E2E build OK` prints.

- [ ] **Step 4: Confirm `CAATINGA_DEBUG_TEMPLATE_RESOLUTION=1` produces the new diagnostic**

Run:

```bash
cd "$TMP_DIR"
rm -rf my-app
CAATINGA_DEBUG_TEMPLATE_RESOLUTION=1 npx caatinga init my-app 2>debug.log
grep "caatinga: template resolution candidates" debug.log
grep "caatinga: candidate" debug.log | head -5
grep -F "my-app/caatinga.config.ts" -c <(true) >/dev/null
test -f my-app/caatinga.config.ts
rm -f debug.log
echo "E2E debug OK"
```

Expected:
- `grep "caatinga: template resolution candidates"` prints a line containing the env value and cwd.
- `grep "caatinga: candidate"` prints at least the first 5 candidate paths.
- `E2E debug OK` prints.

- [ ] **Step 5: Tear down the test directory**

Run:

```bash
cd /home/dionebastos/Documentos/PROJETOS/caatinga
rm -rf "$TMP_DIR" /tmp/caatinga-e2e
```

Expected: clean working tree outside `packed/`, `packed-unpacked-package-jsons/`, and `packages/cli/templates/` (these are script-managed).

---

### Task 6: Full verification gates

**Files:** Verification only.

- [ ] **Step 1: Typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exit code `0`.

- [ ] **Step 2: Test suite**

Run:

```bash
pnpm test
```

Expected: exit code `0` across all packages.

- [ ] **Step 3: Knip unused-export check**

Run:

```bash
pnpm knip
```

Expected: exit code `0`, no new unused files/exports introduced by the diagnostic print or hint change.

- [ ] **Step 4: ci-snapshot-pack full gate**

Run:

```bash
rm -rf packages/cli/templates
bash scripts/ci-snapshot-pack.sh
```

Expected: exit code `0`. Output includes a `CLI template evidence: package/templates/...` line for every directory under `packages/templates/`.

- [ ] **Step 5: consumer-isolation full flow (mirrors the user scenario)**

Run:

```bash
NPM_CONFIG_CACHE=/tmp/caatinga-npm-cache bash scripts/consumer-isolation-test.sh
```

Expected: exit code `0`. The script runs both `test-app` (from `react-vite-counter`) and `market-app` (from `marketplace-with-token`) without `CAATINGA_TEMPLATES_DIR` set.

- [ ] **Step 6: Final commit (if anything uncommitted from the verification work)**

Run:

```bash
git status
```

Expected: either `nothing to commit, working tree clean` or only `packed/` and `packed-unpacked-package-jsons/` debris from the snapshot scripts. If anything else shows up, `git add` the relevant files and commit with a `chore:` prefix.

- [ ] **Step 7: Document the handoff**

Prepare the non-executed publish command for the release owner (do not run it):

```bash
pnpm publish -r --access public --no-git-checks --tag next
```

Expected: command is documented for handoff only.

---
