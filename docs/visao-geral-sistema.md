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
                           └── exports ──> @caatinga/core/browser (só errors + tipos de artifact)
                                                  │
                       @caatinga/client ──────────┘────> wallet extension (Freighter / Stellar Wallets Kit)
                       @caatinga/client/react ────────── WalletProvider, useWallet (React)
                       @caatinga/client/vite ─────────── helpers de bundler para SWK
                       @caatinga/zk ──────────────────── serialização de provas ZK
packages/templates ────> consumido por `caatinga init`
```

### Regras de fronteira

- **CLI depende de core. Nunca o inverso.**
- **Apenas `@caatinga/core` fala com o binário `stellar`.** Todo uso de `execa` fica em core.
- `@caatinga/client` consome o subpath browser-safe `@caatinga/core/browser` (sem `execa`, sem módulos Node) para manter bundles Vite/webpack enxutos.
- `@caatinga/client` não detém estado de wallet — compõe um adapter.

### Pacotes

| Pacote               | Responsabilidade                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@caatinga/cli`      | Parsing de argumentos, UX de terminal, diagnósticos `doctor`, delegação ao core. Sem orquestração de subprocess fora das APIs do core.                                                                                                            |
| `@caatinga/core`     | Carrega `caatinga.config.ts`, valida schemas, resolve redes/contratos, lê/escreve `caatinga.artifacts.json`, roda a CLI Stellar via camada única de shell.                                                                                        |
| `@caatinga/client`   | Client de browser/Node sobre bindings gerados, artifacts e wallet adapters. `invoke()`, `buildXdr()`, debug XDR explícito. Subpaths: `./react` (WalletProvider/useWallet), `./vite` (helpers de bundler), `./freighter`, `./stellar-wallets-kit`. |
| `@caatinga/zk`       | Serialização de provas ZK, workflow Circom Groth16, args de binding para verificação on-chain. Subpath `./browser` para helpers de binding no browser.                                                                                            |
| `packages/templates` | Templates oficiais consumidos por `caatinga init`, validados via `caatinga.template.json` antes de copiar.                                                                                                                                        |

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
| **runtime / release / ci** | —                                                                                                                                                                                                    | Utilidades de runtime, fluxo de release, checagens de CI.                                         |

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

Comportamento **feature-aware** (substituiu o lock rígido `23.0.0–25.2.0`):

- **Floor rígido `23.0.0`** — única falha fatal. Versões abaixo: `CAATINGA_UNSUPPORTED_CLI_VERSION`. `22.x` não é suportado.
- **Última versão testada** (`25.2.0`) — agora apenas advisory. Versões mais novas rodam com aviso não-fatal no stderr e warning no `caatinga doctor`. Sem flag de override.
- API exposta em `@caatinga/core`: `evaluateStellarCliCompatibility`, `checkStellarCliVersion`.
- Removidos: `STELLAR_CLI_TESTED_MAX_VERSION`, `assertSupportedStellarCliVersion`, `CAATINGA_UNTESTED_CLI_VERSION`, flag `--allow-untested-stellar-cli`, campo `allowUntestedStellarCli`.

Detalhe completo: `docs/stellar-cli-version-contract.md`.

### Requisitos de ambiente

- Node.js 22+
- Stellar CLI 23.0.0+ no PATH (25.2.0 recomendado)
- Rust 1.84.0+ com target `wasm32v1-none`
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
[Wallets](./wallets.md).

### Fluxo do client

```
createCaatingaClient(...)
   └─> caatinga-contract-client
          ├─ read<T>(method)      → leitura (sem assinatura)
          └─ invoke<T>(method)    → transaction-simulate
                                   → wallet.signTransaction()   (adapter)
                                   → transaction-submit
```

- `client/build-xdr.ts` + opções de debug expõem o XDR explicitamente para depuração.
- `bindings/default-binding-adapter.ts` casa os bindings TypeScript gerados com o client.
- `client/invoke-args.ts` resolve argumentos de invocação.

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

| Comando                                                           | Função                                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `caatinga init <dir>`                                             | Cria projeto a partir de template (valida manifest).                                                       |
| `caatinga doctor [--network] [--source]`                          | Checa Node, Stellar CLI, Rust, config, artifacts, rede e identidade de source. Exibe warnings.             |
| `caatinga build [contract]`                                       | Compila WASM do contrato (default: `counter`).                                                             |
| `caatinga deploy [contract] --source <id> --network <net>`        | Faz deploy, grava `contractId` nos artifacts e gera bindings automaticamente (`--no-generate` para pular). |
| `caatinga generate [contract] --network <net>`                    | (Re)gera bindings TypeScript; sem nome, regenera todos os contratos implantados.                           |
| `caatinga status [--network <net>] [--json]`                      | Tabela por rede: contratos implantados, hashes e frescor dos bindings.                                     |
| `caatinga invoke <contract.method> --source <id> --network <net>` | Invoca método do contrato que altera estado.                                                               |
| `caatinga read <contract.method> [--network <net>]`               | Simula método read-only (sem assinatura).                                                                  |
| `caatinga dev`                                                    | Proxy opinativo sobre Vite + validação (MVP).                                                              |

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

- **Status:** alpha. Release atual no npm **`latest`**: **`3.1.2`**. Destaques: Node 22+, `@stellar/stellar-sdk` v16, `init --minimal`, `caatinga read`, guias de scaffold, workflow ZK (`@caatinga/zk`, comandos `zk-*`, progresso de install no CLI), `caatinga status`, deploy com geração automática de bindings, `@caatinga/client/react`, multi-build (`caatinga build` sem argumento), overrides de dependências nos templates.
- **Distribuição:** dist-tag `latest` em todos os pacotes publicados; `next` segue candidatos pré-release.
- **Sem** registry on-chain e **sem** camada de macro Rust — diferencial vs Scaffold Stellar (toolkit npm-first em TypeScript).
- Templates oficiais vivem no repo, com CI e matriz de semver. Templates da comunidade são tratados como código não confiável.

> _Deploy multi-contrato com dependências está fora do escopo deste documento._
