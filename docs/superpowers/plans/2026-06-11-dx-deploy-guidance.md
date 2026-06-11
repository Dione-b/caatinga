# DX Deploy Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tell developers to deploy/generate the contract before using the frontend — via the CLI `init` next-steps output and a not-deployed panel in the `react-vite-counter` template.

**Architecture:** Two independent changes. (1) Expand the `caatinga init` "Next steps" log block to print the full build→deploy→generate→dev lifecycle plus a deploy-before-frontend note. (2) Add a proactive `ContractNotDeployed` panel to the template that renders when `caatinga.artifacts.json` has no `counter` contract ID, taking priority over the connect/counter flow.

**Tech Stack:** TypeScript, Commander (CLI), Vitest (CLI tests), React 18 + Vite (template).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/cli/src/commands/init.command.ts` | Print the expanded next-steps lifecycle + deploy note |
| `packages/cli/src/commands/init.command.test.ts` (new) | Assert the next-steps output |
| `packages/templates/react-vite-counter/src/components/ContractNotDeployed.tsx` (new) | Panel listing deploy commands when contract ID absent |
| `packages/templates/react-vite-counter/src/App.tsx` | Gate: render `ContractNotDeployed` when not deployed |

---

## Task 1: CLI init next-steps output

**Files:**
- Create: `packages/cli/src/commands/init.command.test.ts`
- Modify: `packages/cli/src/commands/init.command.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/cli/src/commands/init.command.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { createProjectFromTemplate } from "@caatinga/core";
import { registerInitCommand } from "./init.command.js";

const createProjectMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    createProjectFromTemplate: createProjectMock
  };
});

vi.mock("../utils/template-path.js", () => ({
  resolveTemplateDir: vi.fn().mockResolvedValue("/fake/templates/react-vite-counter")
}));

function createInitProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerInitCommand(program);
  return program;
}

describe("init command", () => {
  beforeEach(() => {
    createProjectMock.mockReset();
    createProjectMock.mockResolvedValue({
      targetDir: "/abs/my-dapp",
      template: {
        name: "react-vite-counter",
        version: "0.1.0",
        contracts: { default: "counter" }
      }
    });
  });

  it("prints the full deploy lifecycle and a deploy-before-frontend note", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createInitProgram().parseAsync(["node", "caatinga", "init", "my-dapp"]);

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("npm install");
      expect(output).toContain("npx caatinga build    counter");
      expect(output).toContain("npx caatinga deploy   counter --network testnet --source <identity>");
      expect(output).toContain("npx caatinga generate counter --network testnet");
      expect(output).toContain("npm run dev");
      expect(output).toContain(
        "Note: deploy and generate the contract before interacting in the frontend"
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("falls back to bare commands and still prints the note when no default contract", async () => {
    createProjectMock.mockResolvedValue({
      targetDir: "/abs/my-dapp",
      template: { name: "blank", version: "0.1.0", contracts: {} }
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createInitProgram().parseAsync(["node", "caatinga", "init", "my-dapp"]);

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("npx caatinga build");
      expect(output).toContain("npx caatinga deploy");
      expect(output).toContain(
        "Note: deploy and generate the contract before interacting in the frontend"
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @caatinga/cli test -- init.command`
Expected: FAIL — output is missing the deploy/generate/dev lines and the note (current `init.command.ts` stops at `build`).

- [ ] **Step 3: Implement the expanded output**

In `packages/cli/src/commands/init.command.ts`, replace the existing `Next steps` block (everything from `logger.info("Next steps:");` through the end of the `.action` body) with:

```ts
      const defaultContract = result.template.contracts.default;
      logger.info("Next steps:");
      logger.info(`  cd ${projectDirectory}`);
      logger.info("  npm install");
      if (defaultContract) {
        logger.info(`  npx caatinga build    ${defaultContract}`);
        logger.info(
          `  npx caatinga deploy   ${defaultContract} --network testnet --source <identity>`
        );
        logger.info(`  npx caatinga generate ${defaultContract} --network testnet`);
      } else {
        logger.info("  npx caatinga build");
        logger.info("  npx caatinga deploy   --network testnet --source <identity>");
        logger.info("  npx caatinga generate --network testnet");
      }
      logger.info("  npm run dev");
      logger.info("");
      logger.info(
        "Note: deploy and generate the contract before interacting in the frontend —"
      );
      logger.info("the dApp reads the contract ID from caatinga.artifacts.json.");
```

Leave the lines above it (`logger.success("Project created")` … `logger.info("Path: ...")`) unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @caatinga/cli test -- init.command`
Expected: PASS (both tests).

- [ ] **Step 5: Typecheck + rebuild CLI dist**

Run: `pnpm --filter @caatinga/cli typecheck && pnpm --filter @caatinga/cli build`
Expected: no type errors; `dist/index.js` rebuilt.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/init.command.ts packages/cli/src/commands/init.command.test.ts
git commit -m "feat(cli): expand init next-steps with deploy lifecycle and frontend note"
```

---

## Task 2: Frontend not-deployed gate

**Files:**
- Create: `packages/templates/react-vite-counter/src/components/ContractNotDeployed.tsx`
- Modify: `packages/templates/react-vite-counter/src/App.tsx`

The template has no unit-test harness; verification is a real scaffold + `npm run build`.

- [ ] **Step 1: Create the ContractNotDeployed panel**

Create `packages/templates/react-vite-counter/src/components/ContractNotDeployed.tsx`:

```tsx
export function ContractNotDeployed() {
  return (
    <section className="counter-panel" aria-labelledby="not-deployed-title">
      <div className="counter-panel__header">
        <div>
          <p className="eyebrow">Get started</p>
          <h2 id="not-deployed-title">Contract not deployed</h2>
        </div>
        <span className="network-pill">testnet</span>
      </div>
      <p>
        The counter contract has no on-chain ID yet, so the frontend can&apos;t
        read or update it. Deploy and generate bindings first — the dApp reads the
        contract ID from <code>caatinga.artifacts.json</code>.
      </p>
      <pre className="counter-error" role="note">
{`npx caatinga build    counter
npx caatinga deploy   counter --network testnet --source <identity>
npx caatinga generate counter --network testnet`}
      </pre>
    </section>
  );
}
```

- [ ] **Step 2: Wire the gate into App.tsx**

Replace the entire contents of `packages/templates/react-vite-counter/src/App.tsx` with:

```tsx
import { CounterCard } from "./components/CounterCard";
import { ContractNotDeployed } from "./components/ContractNotDeployed";
import { WalletButton } from "./components/WalletButton";
import { WalletProvider, useWallet } from "./context/WalletContext";
import type { CaatingaArtifacts } from "@caatinga/core/browser";
import artifactsJson from "../caatinga.artifacts.json";

const artifacts = artifactsJson as CaatingaArtifacts;
const counterContractId =
  artifacts.networks?.testnet?.contracts?.counter?.contractId;
const isDeployed = Boolean(counterContractId);

function AppBody() {
  const { publicKey } = useWallet();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Caatinga</p>
          <h1>__PROJECT_NAME__</h1>
        </div>
        <WalletButton />
      </header>

      {!isDeployed ? (
        <ContractNotDeployed />
      ) : publicKey ? (
        <CounterCard />
      ) : (
        <section className="counter-panel" aria-labelledby="connect-title">
          <div className="counter-panel__header">
            <div>
              <p className="eyebrow">Get started</p>
              <h2 id="connect-title">Connect your wallet</h2>
            </div>
            <span className="network-pill">testnet</span>
          </div>
          <p>Connect a Stellar wallet to read and update the counter contract.</p>
        </section>
      )}
    </main>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <AppBody />
    </WalletProvider>
  );
}
```

Note: the empty `caatinga.artifacts.json` has `networks.testnet.contracts = {}`, so `?.counter?.contractId` is `undefined` and the gate shows. After `caatinga deploy` writes the ID, the gate clears. The `as CaatingaArtifacts` cast mirrors `src/caatinga.ts`; without it TS infers the literal `{}` shape and `.counter` fails to type-check.

- [ ] **Step 3: Scaffold a throwaway project from the edited template**

Run:
```bash
rm -rf /tmp/dx-verify
node /home/dionebastos/Documentos/PROJETOS/caatinga/packages/cli/dist/index.js init /tmp/dx-verify
```
Expected: "Project created" with the new expanded next-steps output (also smoke-confirms Task 1). `resolveTemplateDir` reads `packages/templates/react-vite-counter` directly, so the temp project contains the edited `App.tsx` + new component.

- [ ] **Step 4: Point the temp project at local tarballs and build**

Run:
```bash
cd /tmp/dx-verify
node -e "const fs=require('fs');const p='./package.json';const j=JSON.parse(fs.readFileSync(p));const base='file:/home/dionebastos/Documentos/PROJETOS/caatinga/packed';j.dependencies['@caatinga/core']=base+'/caatinga-core-2.1.0.tgz';j.dependencies['@caatinga/client']=base+'/caatinga-client-2.1.0.tgz';j.devDependencies['@caatinga/cli']=base+'/caatinga-cli-2.1.0.tgz';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n')"
npm install --no-audit --fund=false
npm run build
```
Expected: `tsc` + `vite build` succeed. `caatinga.artifacts.json` has empty `contracts`, so the build includes the `ContractNotDeployed` path with no type errors.

- [ ] **Step 5: Confirm the not-deployed copy is in the bundle**

Run: `grep -r "Contract not deployed" /tmp/dx-verify/dist >/dev/null && echo FOUND`
Expected: `FOUND` — the gate's heading rendered into the built bundle.

- [ ] **Step 6: Commit**

```bash
git add packages/templates/react-vite-counter/src/App.tsx packages/templates/react-vite-counter/src/components/ContractNotDeployed.tsx
git commit -m "feat(template): show deploy guidance when counter contract is not deployed"
```

- [ ] **Step 7: Cleanup**

Run: `rm -rf /tmp/dx-verify`

---

## Notes for the implementer

- Keep `init.command.ts`'s `logger.success`/`Project`/`Template`/`Path` lines intact; only the `Next steps` block changes.
- The CLI test runs against `src` via Vitest; the `dist` rebuild (Task 1 Step 5) is what `caatinga init` actually executes in Task 2's scaffold step.
- Don't touch `CounterCard.tsx`, `caatinga.ts`, the wallet flow, the styles, or the template `README.md` — out of scope.
- `<identity>` is a literal placeholder; the CLI cannot know the dev's Stellar key alias.
