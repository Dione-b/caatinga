# Caatinga — Visão Geral do Sistema

Resumo das funcionalidades do sistema: arquitetura, camadas de abstração, integração com a CLI Stellar e integração com wallets.

> Documento de referência interna. Complementa `docs/architecture.md` e `docs/cli.md`.

---

## 1. O que é Caatinga

Toolkit de desenvolvimento para dApps Stellar/Soroban. Padroniza o fluxo:

```
init → build → deploy → generate (bindings) → invoke → client (browser)
```

Princípio central: **orquestra o workflow, não esconde o mental model do Stellar.** Conceitos como `contractId`, RPC URL, network passphrase, identidade de assinatura, XDR, fees e simulação permanecem visíveis ao usuário. Caatinga compõe, valida e organiza — não reimplementa o SDK Stellar nem a CLI.

| Caatinga é                                                  | Caatinga não é                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| Convenção + orquestração + artifacts + integração de client | Um segundo SDK Soroban/Stellar                                |
| CLI fina sobre `@caatinga/core`                             | Lugar para guardar chaves privadas ou assinar silenciosamente |
| Scaffolding por templates                                   | Registry hospedado obrigatório para o fluxo core              |

---

## 2. Arquitetura

Monorepo pnpm gerenciado por Turbo. Quatro pacotes principais sob `packages/`.

```
@caatinga/cli ──────> @caatinga/core ──────> stellar CLI (subprocess externo)
                           │
                           ├── exports ──> @caatinga/core/runtime/requirements (constantes Node/Rust, sem deps)
                           └── exports ──> @caatinga/core/browser (só errors + tipos de artifact)
                                                  │
                       @caatinga/client ──────────┘────> wallet extension (Freighter / Stellar Wallets Kit)
                       @caatinga/client/react ────────── WalletProvider, useWallet (React)
                       @caatinga/client/vite ─────────── helpers de bundler para SWK
                       @caatinga/zk ──────────────────── serialização de provas ZK
packages/templates ────> consumido por `ctg init`
```

### Regras de fronteira

- **CLI depende de core. Nunca o inverso.**
- **Apenas `@caatinga/core` fala com o binário `stellar`.** A CLI só usa `execa` para ferramentas auxiliares (`npm`, `tar`, `pnpm`, re-invocação do próprio `ctg`).
- `@caatinga/client` consome o subpath browser-safe `@caatinga/core/browser` (sem `execa`, sem módulos Node) para manter bundles Vite/webpack enxutos.
- `@caatinga/client` não detém estado de wallet — compõe um adapter.

### Pacotes

| Pacote               | Responsabilidade                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@caatinga/cli`      | Parsing de argumentos, UX de terminal, diagnósticos `doctor`, delegação ao core. Orquestração da CLI Stellar sempre via APIs do core.                                                                                                             |
| `@caatinga/core`     | Carrega `caatinga.config.ts`, valida schemas, resolve redes/contratos, lê/escreve `caatinga.artifacts.json`, roda a CLI Stellar via camada única de shell.                                                                                        |
| `@caatinga/client`   | Client de browser/Node sobre bindings gerados, artifacts e wallet adapters. `invoke()`, `buildXdr()`, debug XDR explícito. Subpaths: `./react` (WalletProvider/useWallet), `./vite` (helpers de bundler), `./freighter`, `./stellar-wallets-kit`. |
| `@caatinga/zk`       | Serialização de provas ZK, workflow Circom Groth16, args de binding para verificação on-chain. Subpath `./browser` para helpers de binding no browser.                                                                                            |
| `packages/templates` | Templates oficiais consumidos por `ctg init`, validados via `caatinga.template.json` antes de copiar.                                                                                                                                             |

### Fonte de verdade (MVP)

Estado local do projeto é autoritativo. Sem cache central nem registry remoto como dependência rígida:

- `contracts/` — fontes Rust Soroban
- bindings gerados (caminho de `caatinga.config.ts`)
- `caatinga.config.ts`
- `caatinga.artifacts.json`

---

## 3. Camadas de abstração (`@caatinga/core`)

Cada subdiretório de `packages/core/src/` é uma camada com responsabilidade isolada.

| Camada                     | Arquivos-chave                                                                                                                                                                                       | Função                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **shell**                  | `run-command.ts`, `check-binary.ts`                                                                                                                                                                  | Camada única de subprocess. Todo `execa` concentrado aqui. Verifica presença de binários no PATH. |
| **stellar-cli**            | `compat.ts`, `check-stellar-cli-version.ts`, `version.ts`, `parse-contract-id.ts`, `recover-deploy-contract-id.ts`, `build-stellar-network-args.ts`                                                  | Adaptador sobre a CLI Stellar. Absorve mudanças em flags, stdout, caminhos e workflow de XDR.     |
| **contracts**              | `build-contract.ts`, `deploy-contract.ts`, `generate-bindings.ts`, `invoke-contract.ts`, `resolve-contract.ts`, `resolve-deploy-args.ts`, `source-account.ts`, `validate-source-shape.ts`, `wasm.ts` | Orquestração das operações de contrato (build, deploy, bindings, invoke).                         |
| **networks**               | `resolve-network.ts`, `networks.ts`                                                                                                                                                                  | Resolve a rede declarada em `caatinga.config.ts`.                                                 |
| **artifacts**              | `read-artifacts.ts`, `write-artifacts.ts`, `update-artifact.ts`, `artifact.schema.ts`                                                                                                                | Lê/escreve/atualiza `caatinga.artifacts.json`. Persiste `contractId` por rede.                    |
| **config**                 | —                                                                                                                                                                                                    | Carrega e valida `caatinga.config.ts`.                                                            |
| **templates**              | —                                                                                                                                                                                                    | Valida manifest `caatinga.template.json` (semver core ↔ template).                                |
| **errors**                 | —                                                                                                                                                                                                    | Códigos `CAATINGA_*` centralizados (`CaatingaErrorCode`).                                         |
| **bindings**               | `binding-freshness.ts`, `binding-marker.ts`, `patch-generated-binding-package.ts`                                                                                                                    | Marcador e frescor dos bindings gerados; ajustes no pacote gerado.                                |
| **stellar-sdk**            | `version.ts`, `compat.ts`, `check-stellar-sdk-version.ts`                                                                                                                                            | Contrato de versão do `@stellar/stellar-sdk` usado na geração de bindings.                        |
| **frontend**               | `sync-frontend-env.ts`, `evaluate-env-drift.ts`, `bindings-config-hint.ts`, `ensure-buffer-dependency.ts`                                                                                            | Sync de env do frontend (`ctg sync-env`) e detecção de drift.                                     |
| **scaffold**               | `create-minimal-project.ts`, `create-zk-project.ts`                                                                                                                                                  | Scaffolds `init --minimal` e ZK.                                                                  |
| **soroban**                | `assert-soroban-symbol.ts`                                                                                                                                                                           | Validação de símbolos Soroban.                                                                    |
| **public-api**             | `tier1-client-exports.ts`                                                                                                                                                                            | Manifesto dos exports Tier 1 (ver `docs/public-api.md`).                                          |
| **compat / recovery**      | — (só testes)                                                                                                                                                                                        | Snapshots de exports e cenários de recuperação de deploy.                                         |
| **runtime / release / ci** | `runtime/requirements.ts`                                                                                                                                                                            | Requisitos de toolchain (subpath `./runtime/requirements`), testes de release, checagens de CI.   |

### O que pode e o que não pode abstrair

- **Pode abstrair:** fluxo build/deploy/bindings, lookup de artifact, config de rede do projeto, layout de template, composição de comandos, handoff de wallet adapter, workflow de transação dos bindings gerados.
- **Não deve esconder:** `contractId`, network passphrase, escolha de RPC, contas, assinatura de wallet, XDR, fees, simulação, data model Soroban.
- **Red flags (evitar):** modelos de contrato próprios da Caatinga, serialização Soroban manual, substituir bindings gerados como API primária, runtime de assinatura paralelo ao ecossistema Stellar.

---

## 4. Integração com a CLI Stellar

`@caatinga/core` é o único ponto que invoca o binário `stellar`, sempre via `shell/run-command.ts`.

### Operações delegadas à CLI

| Operação Caatinga | Comando Stellar subjacente          |
| ----------------- | ----------------------------------- |
| `build`           | `stellar contract build`            |
| `deploy`          | `stellar contract deploy`           |
| `generate`        | `npx @stellar/stellar-sdk generate` |
| `invoke`          | `stellar contract invoke`           |

### Resiliência a drift de output

- `parse-contract-id.ts` + `recover-deploy-contract-id.ts` extraem o `contractId` do stdout do deploy, tolerando variações de formato entre versões da CLI.
- `build-stellar-network-args.ts` monta os argumentos de rede de forma consistente.

### Contrato de versão da CLI (v2.0.0)

Comportamento **feature-aware** (substituiu o lock rígido `23.0.0–28.0.0`):

- **Floor rígido `23.0.0`** — única falha fatal. Versões abaixo: `CAATINGA_UNSUPPORTED_CLI_VERSION`. `22.x` não é suportado.
- **Última versão testada** (`28.0.0`) — agora apenas advisory. Versões mais novas rodam com aviso não-fatal no stderr e warning no `ctg doctor`. Sem flag de override.
- API exposta em `@caatinga/core`: `evaluateStellarCliCompatibility`, `checkStellarCliVersion`.
- Removidos: `STELLAR_CLI_TESTED_MAX_VERSION`, `assertSupportedStellarCliVersion`, `CAATINGA_UNTESTED_CLI_VERSION`, flag `--allow-untested-stellar-cli`, campo `allowUntestedStellarCli`.

Detalhe completo: `docs/stellar-cli-version-contract.md`.

### Requisitos de ambiente

- Node.js 22+
- Stellar CLI 23.0.0+ no PATH (28.0.0 recomendado)
- Rust 1.91.1+ com target `wasm32v1-none`
- Identidade local financiada na CLI Stellar (ex.: `alice`)

---

## 5. Integração com Wallets

Acontece em `@caatinga/client`. O client **não detém chaves privadas nem serializa SCVal manualmente** — compõe um adapter de wallet.

### Contrato de adapter

`CaatingaWalletAdapter` — qualquer wallet que implemente a interface funciona. Caatinga não está limitada ao Freighter.

### Adapters embarcados

| Adapter                   | Arquivo                           | Uso                                                                        |
| ------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| Freighter                 | `adapters/freighter.ts`           | Wallet única.                                                              |
| Stellar Wallets Kit (SWK) | `adapters/stellar-wallets-kit.ts` | Múltiplos provedores de wallet a partir de uma única camada de integração. |

`wallet/with-wallet-timeout.ts` aplica timeout às operações de assinatura.

### Sessão de wallet e hooks React

`createWalletSession(adapter, { persist: true })` (em `wallet/wallet-session.ts`) adiciona estado
de conexão (`disconnected`/`connecting`/`connected`), persistência em `localStorage` e reconexão
silenciosa (`restore()`) sobre qualquer adapter. O subpath `@caatinga/client/react` expõe
`WalletProvider` + `useWallet` para apps React (peer opcional `react >= 18`) — o template
`react-vite-counter` usa esse provider em vez de um contexto manual. Guia completo:
[Wallets](../wallets.md).

### Fluxo do client

```
createCaatingaClient(...)
   └─> caatinga-contract-client
          ├─ read<T>(method)      → leitura (sem assinatura)
          └─ invoke<T>(method)    → transaction-simulate
                                   → wallet.signTransaction()   (adapter)
                                   → transaction-submit
```

- `xdr/build-xdr.ts` (em `packages/client/src/`) + opções de debug expõem o XDR explicitamente para depuração.
- `bindings/default-binding-adapter.ts` casa os bindings TypeScript gerados com o client.
- `client/invoke-args.ts` resolve argumentos de invocação.

**Escopo wallet (até v1.0):** `invoke()` é **single-invoker only** — sem orquestração `signAuthEntry` (`CAATINGA_MULTI_AUTH_REQUIRED` para credenciais delegadas).

### Exemplo de uso

```ts
import { createCaatingaClient } from "@caatinga/client";
import { createStellarWalletsKitAdapter } from "@caatinga/client/stellar-wallets-kit";
import * as Counter from "./contracts/generated/counter";
import artifacts from "../caatinga.artifacts.json";

const client = createCaatingaClient({
  network: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  artifacts,
  wallet: createStellarWalletsKitAdapter(),
  contracts: { counter: { binding: Counter } },
});

const before = await client.contract("counter").read<number>("get");
const next = await client.contract("counter").invoke<number>("increment");
```

---

## 6. Interface CLI

| Comando                                                      | Função                                                                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `ctg init <dir>`                                             | Cria projeto a partir de template (valida manifest).                                                       |
| `ctg doctor [--network] [--source]`                          | Checa Node, Stellar CLI, Rust, config, artifacts, rede e identidade de source. Exibe warnings.             |
| `ctg build [contract]`                                       | Compila WASM do contrato; sem nome, compila todos os contratos configurados.                               |
| `ctg deploy [contract] --source <id> --network <net>`        | Faz deploy, grava `contractId` nos artifacts e gera bindings automaticamente (`--no-generate` para pular). |
| `ctg generate [contract] --network <net>`                    | (Re)gera bindings TypeScript; sem nome, regenera todos os contratos implantados.                           |
| `ctg status [--network <net>] [--json]`                      | Tabela por rede: contratos implantados, hashes e frescor dos bindings.                                     |
| `ctg invoke <contract.method> --source <id> --network <net>` | Invoca método do contrato que altera estado.                                                               |
| `ctg read <contract.method> [--network <net>]`               | Simula método read-only (sem assinatura).                                                                  |
| `ctg dev`                                                    | Oculto/reservado; não faz parte da superfície suportada.                                                   |

Outros comandos (`upgrade`, `rollback`, `estimate`, `inspect`, `migrate`, `wire`, `sync-env`, `smoke`, `regression`, `ci`, `identity`, `version`, `zk`): ver [`docs/cli.md`](../cli.md).

**Flags comuns:**

- `--source` — identidade local da CLI Stellar que assina (ex.: `alice`). Endereços públicos `G...` são rejeitados em operações de assinatura.
- `--network` — rede de `caatinga.config.ts`.
- `--force` — redeploy mesmo com `contractId` já presente nos artifacts.

---

## 7. Contratos públicos (compatibilidade)

Alterações nestes itens exigem nota de compatibilidade e plano de rollback:

| Contrato                    | Descrição                                                                       |
| --------------------------- | ------------------------------------------------------------------------------- |
| `caatinga.config.ts`        | Contratos, caminhos WASM, redes.                                                |
| `caatinga.artifacts.json`   | `contractId` por rede: `networks[net].contracts[name].contractId`.              |
| Códigos `CAATINGA_*`        | API estável para automação parsear (a prosa não é contrato).                    |
| `caatinga.template.json`    | Manifest (name, version, `compatibleCore`, paths) validado no `init`.           |
| Paths de export dos pacotes | Subpaths como `@caatinga/core/browser`, `@caatinga/client/stellar-wallets-kit`. |

---

## 8. Estado e roadmap

- **Status:** contrato estável v1.0 na linha npm `3.x` (ver `README.md` e [`public-api.md`](../public-api.md)). Versões atuais: `npm view @caatinga/cli dist-tags`. Destaques: Node 22+, `@stellar/stellar-sdk` v16, `init --minimal`, `ctg read`, post-deploy hooks (`ctg wire`), frontend env sync (`ctg sync-env`), `${source.address}` placeholder, `buildRoot` para workspaces Cargo, retry de falhas transientes (TxBadSeq), guias de scaffold, workflow ZK (`@caatinga/zk`, comandos `ctg zk init|build|prove|invoke` (experimentais), cerimônia dev com guardrails em mainnet), `ctg status`, deploy com geração automática de bindings, `@caatinga/client/react`, multi-build (`ctg build` sem argumento), overrides de dependências nos templates.
- **Client:** single-invoker wallet signing até v1.0; multisig / `signAuthEntry` fora do escopo atual.
- **Distribuição:** dist-tag `latest` em todos os pacotes publicados; `next` segue candidatos pré-release.
- **Sem** registry on-chain e **sem** camada de macro Rust — diferencial vs Scaffold Stellar (toolkit npm-first em TypeScript).
- Templates oficiais vivem no repo, com CI e matriz de semver. Templates da comunidade são tratados como código não confiável.

> _Deploy multi-contrato com dependências está fora do escopo deste documento._
