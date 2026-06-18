# Plano de Correção — Relatório de Testes Caatinga 2.4.1

> **Para agentes:** execute com `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans`. Passos usam sintaxe checkbox `- [ ]`.

**Objetivo:** Corrigir os 10 itens do `RELATORIO-TESTES-CAATINGA.md` (prioridades Alta/Média/Baixa), com 2 recalibrações verificadas diretamente no CLI instalado (#3 help `zk` é mais estreito; #6 "did you mean" já existe para typos → vira branding).

**Arquitetura:** Monorepo pnpm/turbo. CLI em `packages/cli` (Commander 12.1.0), lógica em `packages/core`, templates em `packages/templates`. Cada correção é uma task TDD independente (teste falha → implementa → passa → commit). Mudanças em código publicado ganham changeset (`.changeset/`).

**Stack:** TypeScript ESM, Vitest 2.1.8, Commander 12.1.0, tsup, turbo. Comandos: `pnpm --filter @caatinga/cli test`, `pnpm --filter @caatinga/core test`, `pnpm typecheck`, `pnpm build`.

**Repo-alvo:** `/home/dionebastos/Documentos/PROJETOS/caatinga` (o `tester/` só tem os projetos de teste).

---

## Estrutura de arquivos

| Task | Arquivo(s) | Responsabilidade |
|---|---|---|
| 1 | `packages/cli/src/commands/doctor.command.ts` | Distinguir env-doente (exit 1) de deploy-pendente (exit 0) |
| 2 | `packages/cli/src/diagnostics/project-diagnostic.ts` | configDiagnostic: pre-check estático + label distinto (não duplicar deps) |
| 3 | `packages/cli/src/program.ts` | Help raiz variadic que navega `help zk init` |
| 4 | `packages/cli/src/commands/*.command.ts` | `.addHelpText("Examples", ...)` em cada comando |
| 5 | `packages/core/src/contracts/deploy-contract.ts`, `deploy-contract-graph.ts` | Comparar `wasmHash` antes de pular redeploy |
| 6 | `packages/cli/src/program.ts` | Handler custom de unknown command com branding |
| 7 | `packages/templates/{react-vite-counter,zk-starter}/package.json` | Atualizar deps + expandir overrides |
| 8 | `packages/cli/src/program.ts` | `.addHelpText("after", docs link)` |
| 9 | `packages/core/src/contracts/{invoke-contract,deploy-contract}.ts` | Hint de retry em timeouts transientes |
| 10 | `packages/cli/src/commands/build.command.ts` | Guard `config.frontend` na msg pós-build |

**Convenção de testes:** co-located `*.test.ts`, mockam `@caatinga/core` via `vi.mock` + `vi.hoisted` (estilo em `doctor-deploy-coverage.test.ts`). Rodar: `pnpm --filter @caatinga/cli test -- <arquivo>` ou `pnpm --filter @caatinga/core test -- <arquivo>`.

---

## Task 1 — `doctor`: exit 0 quando ambiente está saudável e só deploy está pendente (Relatório #7.1 / Rec. Alta #3)

**Files:** Modify `packages/cli/src/commands/doctor.command.ts:89-112`; Test `packages/cli/src/commands/doctor.command.test.ts`

- [ ] **Step 1: Escrever teste falhando** (em `doctor.command.test.ts`, mocka `runAllDiagnostics` all-ok e `reportDeployCoverage` rejeitando `DOCTOR_PARTIAL_DEPLOY`; asserts `process.exitCode` NÃO é setado e status contém "deploy pending")

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core";

const runAllDiagnosticsMock = vi.hoisted(() => vi.fn());
const reportDeployCoverageMock = vi.hoisted(() => vi.fn());
const evaluateBindingCoverageMock = vi.hoisted(() => vi.fn());

vi.mock("../diagnostics/run-all.js", () => ({
  runAllDiagnostics: runAllDiagnosticsMock
}));
vi.mock("../diagnostics/types.js", () => ({
  printDiagnostic: vi.fn(),
  printFixes: vi.fn()
}));
vi.mock("./doctor-deploy-coverage.js", () => ({
  evaluateDeployCoverage: vi.fn()
}));
vi.mock("./doctor-bindings.js", () => ({
  evaluateBindingCoverage: evaluateBindingCoverageMock
}));

describe("doctor exit code — deploy pending", () => {
  beforeEach(() => {
    process.exitCode = undefined;
    runAllDiagnosticsMock.mockResolvedValue([
      { ok: true, label: "Node.js 22" },
      { ok: true, label: "Project dependencies installed" },
      { ok: true, label: "caatinga.config.ts found" },
      { ok: true, label: "caatinga.artifacts.json found" }
    ]);
    reportDeployCoverageMock.mockRejectedValue(new CaatingaError(
      "Not all configured contracts are deployed on testnet.",
      CaatingaErrorCode.DOCTOR_PARTIAL_DEPLOY,
      "Deploy missing contracts: app."
    ));
    evaluateBindingCoverageMock.mockResolvedValue({ lines: [] });
  });

  it("does_not_set_exit_code_when_only_deploy_is_pending", async () => {
    const { registerDoctorCommand } = await import("./doctor.command.js");
    const { Command } = await import("commander");
    const program = new Command();
    program.exitOverride();
    registerDoctorCommand(program);
    await program.parseAsync(["node", "caatinga", "doctor"], { from: "user" });
    expect(process.exitCode).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter @caatinga/cli test -- doctor.command.test.ts` → FAIL (exitCode=1 porque o `throw` em `reportDeployCoverage` é propagado via `runCliAction`).

- [ ] **Step 3: Implementar** — em `doctor.command.ts`, substituir o bloco 89-112 por distinguir `diagnosticsOk` de `deployReady` e NÃO re-lançar `DOCTOR_PARTIAL_DEPLOY`:

```ts
      const diagnosticsOk = diagnostics.every((diagnostic) => diagnostic.ok);

      let deployNetwork = options.network;
      if (!deployNetwork && diagnosticsOk) {
        const config = await loadConfig();
        deployNetwork = config.defaultNetwork;
      }

      let deployReady = true;
      if (deployNetwork && diagnosticsOk) {
        try {
          await reportDeployCoverage(deployNetwork);
        } catch (error) {
          if (error instanceof CaatingaError && error.code === CaatingaErrorCode.DOCTOR_PARTIAL_DEPLOY) {
            deployReady = false;
            if (error.hint) logger.warn(error.hint);
          } else {
            throw error;
          }
        }
        await reportBindingCoverage(deployNetwork);
      }

      logger.info("");
      const status = !diagnosticsOk
        ? "blocked"
        : deployReady
          ? "ready"
          : "ready (deploy pending)";
      logger.info(`Status: ${status}`);

      if (!diagnosticsOk) {
        process.exitCode = 1;
      }
```

- [ ] **Step 4: Rodar e ver passar** — `pnpm --filter @caatinga/cli test -- doctor.command.test.ts` → PASS. Rodar também `pnpm --filter @caatinga/cli test -- doctor-deploy-coverage.test.ts` (ainda passa: `reportDeployCoverage` continua lançando; só o doctor não re-lança).

- [ ] **Step 5: Changeset + commit**
```bash
pnpm changeset  # patch, @caatinga/cli, "doctor exits 0 when environment is healthy and only deploy is pending"
git add packages/cli/src/commands/doctor.command.ts packages/cli/src/commands/doctor.command.test.ts .changeset/
git commit -m "fix(cli): doctor exits 0 when only deploy is pending"
```

---

## Task 2 — `doctor`: detectar config inválida mesmo com deps faltando + não duplicar label (Relatório #7.2 / Rec. Alta #1)

**Files:** Modify `packages/cli/src/diagnostics/project-diagnostic.ts:5-48`; Test `packages/cli/src/diagnostics/project-diagnostic.test.ts` (criar se não existir)

- [ ] **Step 1: Teste falhando** — `configDiagnostic` com `loadConfig` rejeitando `DEPENDENCIES_NOT_INSTALLED` e config sem `contracts` deve retornar label `"caatinga.config.ts is invalid"` (não `"Project dependencies not installed"`).

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "@caatinga/core";

const loadConfigMock = vi.hoisted(() => vi.fn());
const readFileMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return { ...actual, loadConfig: loadConfigMock };
});
vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, readFile: readFileMock };
});

describe("configDiagnostic — invalid config without deps", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    readFileMock.mockReset();
    loadConfigMock.mockRejectedValue(new CaatingaError(
      "Project dependencies are not installed.",
      CaatingaErrorCode.DEPENDENCIES_NOT_INSTALLED,
      "Run npm install (or pnpm install) in the project root, then retry."
    ));
  });

  it("surfaces_invalid_config_when_contracts_missing_even_without_deps", async () => {
    readFileMock.mockResolvedValue("import { defineConfig } from '@caatinga/core';\nexport default defineConfig({ project: 'x', defaultNetwork: 'testnet', networks: { testnet: { rpcUrl: 'u', networkPassphrase: 'p' } } });\n");
    const { configDiagnostic } = await import("./project-diagnostic.js");
    const result = await configDiagnostic();
    expect(result.ok).toBe(false);
    expect(result.label).toBe("caatinga.config.ts is invalid");
    expect(result.fix).toContain("contracts");
  });

  it("does_not_duplicate_dependencies_label_when_config_keys_present", async () => {
    readFileMock.mockResolvedValue("export default defineConfig({ project: 'x', contracts: { a: {} }, networks: { t: {} } });\n");
    const { configDiagnostic } = await import("./project-diagnostic.js");
    const result = await configDiagnostic();
    expect(result.label).not.toBe("Project dependencies not installed");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter @caatinga/cli test -- project-diagnostic.test.ts` → FAIL (label atual é `"Project dependencies not installed"`).

- [ ] **Step 3: Implementar** — em `project-diagnostic.ts`, adicionar pre-check estático e label distinto no branch `DEPENDENCIES_NOT_INSTALLED`:

```ts
import { access, readFile } from "node:fs/promises";
import path from "node:path";
// ... imports existentes ...

const REQUIRED_CONFIG_KEYS = ["project", "contracts", "networks"] as const;

async function detectMissingConfigKeys(cwd = process.cwd()): Promise<string[]> {
  const configPath = path.resolve(cwd, "caatinga.config.ts");
  const source = await readFile(configPath, "utf8");
  const missing: string[] = [];
  for (const key of REQUIRED_CONFIG_KEYS) {
    if (!new RegExp(`^\\s*${key}\\s*:`, "m").test(source)) {
      missing.push(key);
    }
  }
  return missing;
}
```

E substituir o branch `DEPENDENCIES_NOT_INSTALLED` (linhas 11-17) por:

```ts
      if (error.code === CaatingaErrorCode.DEPENDENCIES_NOT_INSTALLED) {
        try {
          const missing = await detectMissingConfigKeys();
          if (missing.length > 0) {
            return {
              ok: false,
              label: "caatinga.config.ts is invalid",
              fix: `Missing required field(s): ${missing.join(", ")}. Fix caatinga.config.ts before installing dependencies.`
            };
          }
        } catch {
          // não conseguiu ler o arquivo; cai abaixo
        }
        return {
          ok: false,
          label: "caatinga.config.ts found (install dependencies to fully validate)",
          fix: "Run npm install (or pnpm install) in the project root, then retry."
        };
      }
```

- [ ] **Step 4: Rodar e ver passar** → PASS. Validar manualmente: recriar `/tmp/opencode/doctor-test` sem `node_modules` e com config sem `contracts`, rodar `caatinga doctor` (após `pnpm dev`) → deve mostrar `caatinga.config.ts is invalid` em vez de "Project dependencies not installed" duplicado.

- [ ] **Step 5: Changeset + commit** — `fix(cli): doctor detects invalid config when dependencies are missing`

---

## Task 3 — `help zk init`: navegar para o subcomando (Relatório #7.3 / Rec. Alta #2)

**Files:** Modify `packages/cli/src/program.ts:17-40`; Test `packages/cli/src/program.test.ts`

- [ ] **Step 1: Teste falhando** — `createProgram()`, chamar `program.parseAsync(["caatinga","help","zk","init"])` com `exitOverride`, capturar stdout e assertar contém `-t, --template` (opção específica do `zk init`).

```ts
import { describe, expect, it, vi } from "vitest";
import { Command } from "commander";

describe("help command navigation", () => {
  it("help_zk_init_shows_zk_init_specific_options", async () => {
    const { createProgram } = await import("./program.js");
    const program = createProgram();
    program.exitOverride();
    program.configureOutput({
      writeOut: (str) => process.stdout.write(str),
      writeErr: (str) => process.stderr.write(str)
    });
    let output = "";
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((str) => { output += str; return true; });
    try {
      await program.parseAsync(["caatinga", "help", "zk", "init"], { from: "user" });
    } catch { /* exitOverride lança ao mostrar help */ }
    spy.mockRestore();
    expect(output).toContain("--template");
    expect(output).toContain("--minimal");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL (output contém só a ajuda genérica do grupo `zk`).

- [ ] **Step 3: Implementar** — em `program.ts`, remover o help default e registrar um help variadic que caminha na árvore de comandos:

```ts
export function createProgram(): Command {
  const program = new Command();
  program
    .name("caatinga")
    .description("Developer toolkit for Stellar/Soroban dApps")
    .version(CAATINGA_CLI_VERSION);

  registerInitCommand(program);
  registerZkInitCommand(program);
  registerZkBuildCommand(program);
  registerZkProveCommand(program);
  registerZkInvokeCommand(program);
  registerDevCommand(program);
  registerDoctorCommand(program);
  registerBuildCommand(program);
  registerDeployCommand(program);
  registerGenerateCommand(program);
  registerInvokeCommand(program);
  registerReadCommand(program);
  registerStatusCommand(program);

  program.helpCommand(false);
  program
    .command("help [command...]", { hidden: true })
    .description("Display help for a command (supports nested: caatinga help zk init)")
    .action((args: string[], opts: unknown, cmd: Command) => {
      let target: Command = program;
      for (const name of args ?? []) {
        const next = target.commands.find((c) => c.name() === name);
        if (!next) break;
        target = next;
      }
      target.outputHelp();
    });

  return program;
}
```

- [ ] **Step 4: Rodar e ver passar** → PASS. Validar: `pnpm dev help zk init` mostra opções `-t/--minimal/--force`; `pnpm dev help build` continua funcionando; `pnpm dev help zk` mostra o grupo.

- [ ] **Step 5: Changeset + commit** — `fix(cli): help command navigates into nested subcommands`

---

## Task 4 — Exemplos no `--help` dos comandos principais (Relatório #7.6 / Rec. Alta #4)

**Files:** Modify cada `packages/cli/src/commands/*.command.ts` (init, build, deploy, invoke, read, generate, status, doctor, zk-init, zk-build, zk-prove, zk-invoke); Test espalhado ou um teste `help-examples.test.ts`

- [ ] **Step 1: Teste falhando** — um teste que percorre os comandos principais e asserta que a saída de `--help` contém "Examples:"

```ts
import { describe, expect, it } from "vitest";
import { Command } from "commander";
import { createProgram } from "./program.js";

const CASES = [
  ["init"], ["build"], ["deploy"], ["invoke"], ["read"],
  ["zk", "init"], ["zk", "build"], ["zk", "prove"], ["zk", "invoke"]
];

describe("command help examples", () => {
  for (const [cmd, ...rest] of CASES) {
    it(`${[cmd, ...rest].join(" ")} --help contains examples`, async () => {
      const program = createProgram();
      program.exitOverride();
      let output = "";
      program.configureOutput({ writeOut: (s) => { output += s; }, writeErr: () => {} });
      try {
        await program.parseAsync(["caatinga", cmd, ...rest, "--help"], { from: "user" });
      } catch {}
      expect(output).toContain("Examples:");
    });
  }
});
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL (nenhum tem "Examples:").

- [ ] **Step 3: Implementar** — adicionar `.addHelpText("Examples", ...)` em cada comando. Exemplos para os principais:

```ts
// init.command.ts (após .description)
.addHelpText("Examples", [
  "  caatinga init my-dapp",
  "  caatinga init my-dapp --minimal",
  "  caatinga init my-dapp -t marketplace-with-token"
].join("\n"))

// build.command.ts
.addHelpText("Examples", [
  "  caatinga build",
  "  caatinga build counter"
].join("\n"))

// deploy.command.ts
.addHelpText("Examples", [
  "  caatinga deploy --network testnet --source alice",
  "  caatinga deploy counter --network testnet --source alice",
  "  caatinga deploy counter --force --source alice"
].join("\n"))

// invoke.command.ts
.addHelpText("Examples", [
  "  caatinga invoke counter.increment --network testnet --source alice",
  "  caatinga invoke counter.increment 5 --source alice"
].join("\n"))

// read.command.ts
.addHelpText("Examples", [
  "  caatinga read counter.get --network testnet",
  "  caatinga read counter.balance alice"
].join("\n"))

// zk-init.command.ts
.addHelpText("Examples", [
  "  caatinga zk init my-zk-dapp",
  "  caatinga zk init my-zk-dapp --minimal"
].join("\n"))

// zk-build / zk-prove / zk-invoke análogos com exemplos do fluxo ZK
```

- [ ] **Step 4: Rodar e ver passar** → PASS.

- [ ] **Step 5: Changeset + commit** — `feat(cli): add usage examples to command help`

---

## Task 5 — Redeploy: detectar WASM atualizado antes de pular (Relatório #7.4 / Rec. Média #5)

**Files:** Modify `packages/core/src/contracts/deploy-contract.ts:82-94`, `deploy-contract-graph.ts:66-71`; Test `packages/core/src/contracts/deploy-contract.test.ts`

**Contexto:** `hashWasm` já é gravado em artifacts na linha 168, mas o skip (linha 84) só checa `existing.contractId`. O `existing.wasmHash` está disponível.

- [ ] **Step 1: Teste falhando** — `deployContract` com `existing.contractId` + `existing.wasmHash="antigo"` + WASM atual (hash diferente) + sem `force` → retorna `skipped: true` MAS com um warning de WASM divergente (ou novo campo `wasmChanged: true`). Define o contrato do comportamento: não re-deploy automaticamente, mas sinaliza.

```ts
it("warns_when_deployed_wasm_hash_differs_from_current_wasm", async () => {
  // mocks: readArtifacts retorna existing com contractId + wasmHash "AAA"
  // hashWasm do WASM atual retorna "BBB"
  const result = await deployContract({ config, contractName: "app", source: "alice", /* ... */ });
  expect(result.skipped).toBe(true);
  expect(result.wasmChanged).toBe(true); // novo campo
  expect(result.staleWasmWarning).toContain("has changed since last deploy");
});
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL (`wasmChanged` não existe).

- [ ] **Step 3: Implementar** — em `deploy-contract.ts`, antes do skip (linha 84), computar o hash atual e comparar:

```ts
  const currentWasmHash = await hashWasm(wasmPath);
  const existing = artifactsBefore.networks[network.name]?.contracts[contract.name];
  if (existing?.contractId && !options.force) {
    const wasmChanged = Boolean(existing.wasmHash) && existing.wasmHash !== currentWasmHash;
    let skippedWarning = staleWasmWarning;
    if (wasmChanged) {
      skippedWarning = `WASM for "${contract.name}" has changed since last deploy. Re-run with --force to update the on-chain contract.`;
    }
    return {
      contract: contractWithWasm,
      network,
      contractId: existing.contractId,
      artifactsPath: path.resolve(cwd, "caatinga.artifacts.json"),
      output: "",
      skipped: true as const,
      staleWasmWarning: skippedWarning,
      wasmChanged
    };
  }
```

Em `deploy-contract-graph.ts`, surfar o warning (linhas 85-90 já tratam `staleWasmWarning`; o `wasmChanged` flui pelo mesmo campo). Em `deploy.command.ts`, o `[skipped]` (linhas 61-64) já mostra o contrato; adicionar o warning quando presente:

```ts
      for (const skipped of result.skippedContracts) {
        logger.info(`[skipped] ${skipped.name} — already deployed on ${result.network.name}`);
        logger.info(`  Contract ID: ${skipped.contractId}`);
      }
      // após o loop de warnings staleWasmWarnings (já existe linhas 54-56)
```
(O `staleWasmWarnings` já é impresso nas linhas 54-56 — o novo warning flui por ali.)

- [ ] **Step 4: Rodar e ver passar** → `pnpm --filter @caatinga/core test -- deploy-contract.test.ts` PASS. Typecheck: `pnpm --filter @caatinga/core typecheck`.

- [ ] **Step 5: Changeset + commit** — `feat(core): warn when redeploying with changed WASM`

---

## Task 6 — Unknown command com branding Caatinga (Relatório #7.5 recalibrado / Rec. Média #6)

**Files:** Modify `packages/cli/src/program.ts`; Test `packages/cli/src/program.test.ts`

- [ ] **Step 1: Teste falhando** — `caatinga totallyunknown` → stderr contém "caatinga" branding e sugestão `caatinga --help` (além do "Did you mean" do Commander quando aplicável).

```ts
it("unknown_command_uses_caatinga_branding", async () => {
  const program = createProgram();
  program.exitOverride();
  let err = "";
  program.configureOutput({ writeErr: (s) => { err += s; } });
  try { await program.parseAsync(["caatinga", "totallyunknown"], { from: "user" }); } catch {}
  expect(err).toContain("caatinga");
  expect(err.toLowerCase()).toContain("caatinga --help");
});
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL (mensagem padrão Commander só).

- [ ] **Step 3: Implementar** — em `program.ts`, usar `.showHelpAfterError()` e `.exitOverride()` com handler custom, ou `.error()` override. Abordagem com `.exitOverride()` + captura do erro `commander`:

```ts
  program.exitOverride();
  program.showHelpAfterError("Run `caatinga --help` for available commands.");
  program.configureOutput({
    outputError: (str, write) => write(chalk.red(str.replace(/^error:/, "caatinga:")))
  });
```
(Isso preserva o "Did you mean" nativo do Commander para typos próximos e adiciona branding + sugestão `--help`. Importar `chalk` em `program.ts`.)

- [ ] **Step 4: Rodar e ver passar** → PASS. Validar: `pnpm dev totallyunknown` e `pnpm dev bulid` (este ainda mostra "Did you mean build?").

- [ ] **Step 5: Changeset + commit** — `feat(cli): brand unknown-command errors and suggest --help`

---

## Task 7 — Reduzir vulnerabilidades npm nos templates frontend (Relatório #7.5 / Rec. Média #7)

**Files:** Modify `packages/templates/react-vite-counter/package.json`, `packages/templates/zk-starter/package.json` (espelhar); Test `scripts/check-template-audit.sh` (novo) ou validação manual

- [ ] **Step 1: Capturar baseline** —
```bash
cd packages/templates/react-vite-counter && npm install --prefix /tmp/audit-rvc . 2>&1 | tee /tmp/audit-before-rvc.txt
# ou: npm install em cópia temporária e `npm audit --json > /tmp/audit-before.json`
```
Registrar o número de `high` antes.

- [ ] **Step 2: Teste falhando** — criar `scripts/check-template-audit.sh` que instala o template em temp e falha se `npm audit` reportar mais de N vulneridades `high` (N = meta, ex.: 0 ou valor reduzido documentado):

```bash
#!/usr/bin/env bash
set -euo pipefail
TMP=$(mktemp -d)
cp -r packages/templates/react-vite-counter/* "$TMP/"
cd "$TMP" && npm install --silent
HIGH=$(npm audit --json 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(String(j.metadata?.vulnerabilities?.high??0))}catch{process.stdout.write('0')}})")
test "$HIGH" -le 0
```
Rodar → FAIL (baseline > 0).

- [ ] **Step 3: Implementar** — atualizar deps e expandir overrides nos dois `package.json`:
  - `@stellar/stellar-sdk`: `^14.5.0` → `^14.7.0` (ou latest 14.x; verificar changelog)
  - `@creit.tech/stellar-wallets-kit`: `^2.3.0` → `^2.4.0` (ou latest)
  - Expandir `overrides` com transitives vulneráveis identificadas em `/tmp/audit-before.json` (ex.: adicionar `"@safe-global/safe-apps-sdk": "-"`, `"axios"`, `"rollup"` pinados, conforme o `npm audit` apontar)
  - Espelhar exatamente as mesmas alterações em `zk-starter/package.json`

- [ ] **Step 4: Rodar e ver passar** — re-rodar o `check-template-audit.sh` → PASS (high ≤ meta). Validar `npm install` limpo nos 2 templates. Rodar `pnpm docs:check` se houver referência a versões.

- [ ] **Step 5: Changeset + commit** — `fix(templates): reduce npm high-severity vulnerabilities in frontend templates`

---

## Task 8 — Link para `docs/cli.md` no `--help` geral (Relatório §4.7 / Rec. Média #8)

**Files:** Modify `packages/cli/src/program.ts` (no `createProgram`)

- [ ] **Step 1: Teste falhando** — `caatinga --help` output contém "docs/cli.md" (ou URL docs).

```ts
it("program_help_links_to_docs", async () => {
  const program = createProgram();
  program.exitOverride();
  let out = "";
  program.configureOutput({ writeOut: (s) => { out += s; } });
  try { await program.parseAsync(["caatinga", "--help"], { from: "user" }); } catch {}
  expect(out).toContain("docs/cli.md");
});
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL.

- [ ] **Step 3: Implementar** —
```ts
  program.addHelpText("after", "\nDocumentation: https://caatinga.dev/docs/cli.md  (local: docs/cli.md)");
```
(Confirmar URL/paths reais em `docs/` antes; se houver `docs/cli.md` no repo, referenciar ambos.)

- [ ] **Step 4: Rodar e ver passar** → PASS.

- [ ] **Step 5: Changeset + commit** — `docs(cli): link to documentation in --help`

---

## Task 9 — Hint de retry em timeouts transientes (Relatório §4.3/§4.5 / Rec. Baixa #9)

**Files:** Modify `packages/core/src/contracts/invoke-contract.ts:65-100`, `deploy-contract.ts:145-159`; Test `packages/core/src/contracts/invoke-contract.test.ts`, `deploy-contract.test.ts`

**Contexto:** Não há retry no CLI (só em CI via `is-transient-testnet-smoke-failure.ts`). Meta: detectar timeout/transiente e adicionar hint de retry na mensagem (não retry automático, para não mudar semântica).

- [ ] **Step 1: Teste falhando** — `invokeContract` com `runCommand` rejeitando `INVOKE_FAILED` cuja mensagem contém "timeout" → o `CaatingaError` resultante tem `hint` contendo "retry".

```ts
it("adds_retry_hint_on_transient_timeout", async () => {
  // mock runCommand to reject CaatingaError(INVOKE_FAILED, "transaction submission timeout")
  await expect(invokeContract({...})).rejects.toMatchObject({ code: "CAATINGA_INVOKE_FAILED" });
  // capturar erro e checar hint.includes("retry")
});
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL (hint atual não menciona retry).

- [ ] **Step 3: Implementar** — adicionar detector de transiente (reusar o padrão de `is-transient-testnet-smoke-failure.ts`) e enriquecer o hint:

```ts
// invoke-contract.ts — antes do "throw error" final (linha 99)
const TRANSIENT_PATTERN = /timeout|i\/o timeout|econnreset|connection reset|503|502|429|rate limit|temporar|fetch failed|network error|unavailable/i;
if (error instanceof CaatingaError && error.code === CaatingaErrorCode.INVOKE_FAILED
  && TRANSIENT_PATTERN.test(`${error.message}\n${error.hint ?? ""}`)) {
  throw new CaatingaError(
    error.message,
    error.code,
    "Transient testnet/network failure. Wait a few seconds and retry the same command.",
    error
  );
}
```
Aplicar padrão equivalente em `deploy-contract.ts` no catch do `DEPLOY_FAILED` (linhas 145-159): antes de re-lançar, se transiente, enriquecer hint com retry. (Extrair `TRANSIENT_PATTERN` para `packages/core/src/ci/transient-pattern.ts` e reusar.)

- [ ] **Step 4: Rodar e ver passar** → PASS. Typecheck core.

- [ ] **Step 5: Changeset + commit** — `feat(core): suggest retry on transient testnet timeouts`

---

## Task 10 — Guard `config.frontend` na mensagem pós-build (Relatório §4.2/§4.4 / Rec. Baixa #10)

**Files:** Modify `packages/cli/src/commands/build.command.ts:35-66`; Test `packages/cli/src/commands/build.command.test.ts`

- [ ] **Step 1: Teste falhando** — `build` com config sem `frontend` (minimal) e deploy pendente → a linha "The frontend needs contractId" NÃO aparece no output (mas "Next: caatinga deploy ..." pode aparecer).

```ts
it("does_not_mention_frontend_when_no_frontend_configured", async () => {
  // mock loadConfig → config sem `frontend`; mock buildContract; mock evaluateDeployCoverage → incomplete
  // capturar logger.warn; assert que NÃO contém "frontend needs contractId"
});
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL (linha 66 imprime sempre).

- [ ] **Step 3: Implementar** — em `build.command.ts`, guardar a linha 66 com `config.frontend`:

```ts
  logger.warn("");
  for (const command of missingDeployCommands) {
    logger.warn(`Next: ${command}`);
  }
  if (config.frontend) {
    logger.warn("The frontend needs contractId in caatinga.artifacts.json; build alone is not enough.");
  } else {
    logger.warn("Deploy is required before invoke/read: build alone does not deploy contracts.");
  }
```

- [ ] **Step 4: Rodar e ver passar** → PASS.

- [ ] **Step 5: Changeset + commit** — `fix(cli): do not mention frontend in post-build message for minimal projects`

---

## Verificação final (após todas as tasks)

- [ ] `pnpm build` (turbo, todos os pacotes)
- [ ] `pnpm test` (todas as suítes Vitest)
- [ ] `pnpm typecheck`
- [ ] `pnpm knip` (sem exports mortos)
- [ ] Reinstalar global e re-rodar os 7 cenários do relatório em `tester/`:
  - `caatinga doctor` → exit 0 quando saudável + deploy pendente; detecta config inválida sem deps
  - `caatinga help zk init` → mostra opções `-t/--minimal/--force`
  - `caatinga build` (minimal) → sem menção a "frontend"
  - `caatinga deploy` (WASM alterado) → warning de WASM divergente
  - `caatinga --help` → link docs + exemplos; `caatinga totallyunknown` → branding
- [ ] `pnpm ci:publish-matrix` se for release-impactante (AGENTS.md)

## Auto-revisão (checklist da skill)

- **Cobertura do relatório:** #7.1→T1, #7.2→T2, #7.3→T3, #7.6→T4, #7.4→T5, #7.5(unknown)→T6, #7.5(npm)→T7, §4.7(docs)→T8, §4.3/§4.5(timeout)→T9, §4.2/§4.4(frontend msg)→T10. Todos os 10 cobertos.
- **Recalibrações aplicadas:** #3 reduzido a `help` aninhado (confirmado `--help` já funciona); #6 virou branding (confirmado "Did you mean" já existe para typos).
- **Consistência de tipos:** `wasmChanged` (T5) aparece no return de `deploy-contract.ts` e flui via `staleWasmWarning` no grafo; `CaatingaErrorCode.DOCTOR_PARTIAL_DEPLOY` mantido (compat); `reportDeployCoverage` continua lançando (testes existentes preservados).

## Pontos de atenção / trade-offs

1. **T1 + T2** tocam `doctor` — executar juntas evita conflito de merge no `doctor.command.ts`.
2. **T3 + T6 + T8** todas editam `program.ts` — combinar em uma sessão para evitar conflito.
3. **T7** (npm vulns) é a task mais iterativa: o número real de vulnerabilidades e quais overrides expandir só se confirma rodando `npm audit` no template. A meta `HIGH <= 0` pode ser irrealista para transitivas de wallet SDK; se for, **documentar como não-bloqueante** no README do template (alternativa que o relatório também aceita) e ajustar o limiar do `check-template-audit.sh`.
4. **T5** escolhe alertar (não re-deploy automático) — alinha com "o padrão deveria alertar/confirmar" do relatório e não quebra fluxos existentes. Um futuro `--auto-redeploy` pode ser adicionado.
5. **Changesets:** todas as tasks de comportamento publicável geram `.changeset/`; consolidar em um bump `patch` (`2.4.2`) no final, alinhando `packages/*/package.json` + `pnpm-lock.yaml` (per AGENTS.md).
