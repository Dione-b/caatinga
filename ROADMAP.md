# Roadmap

Caatinga is undergoing a stabilization and consolidation phase. No sprint should add new major features. The focus is on reducing scope, consolidating concepts, and stabilizing the platform.

All sprints must strengthen one of the four core pillars:

1. **Identity** (what Caatinga is)
2. **Architecture** (how the project is organized)
3. **DX** (how the developer interacts)
4. **Reliability** (how stability is guaranteed)

---

## Fase 1 — Redefinir a identidade do projeto

_Objetivo: Fazer qualquer pessoa entender o Caatinga em menos de 30 segundos._

### Sprint 1 — Definir o Core [x]

- **Objetivo:** Encontrar uma definição única para o projeto.
- **Entregáveis:**
  - Definir a missão do projeto.
  - Definir o problema que resolve.
  - Definir o diferencial principal.
  - Remover descrições conflitantes.
- **Resultado esperado:** Toda documentação passa a girar em torno de: `Deployment Orchestration + Versioned Artifacts for Soroban`. Nada além disso.

### Sprint 2 — Definir os pilares [x]

- **Objetivo:** Organizar todas as funcionalidades existentes.
- **Entregáveis:**
  - Criar os pilares oficiais: Deployment, Artifacts, Runtime, Automation.
  - Todo recurso deverá pertencer a um desses pilares.
- **Resultado esperado:** Não existirão funcionalidades "soltas".

### Sprint 3 — Revisão do escopo [x]

- **Objetivo:** Eliminar responsabilidades que não pertencem ao core.
- **Entregáveis:**
  - Classificar cada feature como: Core, Nice to Have, Experimental, Fora do escopo.
- **Resultado esperado:** Backlog limpo.

---

## Fase 2 — Arquitetura do produto

### Sprint 4 — Revisão dos pacotes [x]

- **Objetivo:** Reorganizar o workspace.
- **Entregáveis:**
  - Revisar responsabilidades de: `cli`, `core`, `client`, `templates`, `zk`.
- **Resultado esperado:** Nenhum pacote possuir responsabilidades cruzadas.

### Sprint 5 — Renomeação conceitual [x]

- **Objetivo:** Eliminar nomes genéricos.
- **Entregáveis:**
  - Avaliar principalmente: `client`, `core`, `templates`, `runtime`.
- **Resultado esperado:** Os nomes passam a refletir responsabilidades.

### Sprint 6 — Dependency Map [x]

- **Objetivo:** Documentar quem depende de quem.
- **Entregáveis:**
  - Criar um diagrama simples de dependências.
  - Exemplo: CLI → Core → CLI Adapter → Stellar CLI → Artifacts → Runtime.
- **Resultado esperado:** Dependências bem definidas.

---

## Fase 3 — Artifacts First

_Prioridade máxima do projeto._

### Sprint 7 — Especificação dos Artifacts [x]

- **Objetivo:** Transformar os artifacts em API pública.
- **Entregáveis:**
  - Definir: `schema`, `version`, `metadata`, `contracts`, `history`.
- **Resultado esperado:** Formato congelado.

### Sprint 8 — Evolução do schema [x]

- **Objetivo:** Adicionar metadados importantes.
- **Entregáveis:**
  - Adicionar campos como: `git commit`, `compiler`, `rust version`, `cli version`, `network`, `timestamp`, `checksum`.
- **Resultado esperado:** Artifacts completos.

### Sprint 9 — Versionamento [x]

- **Objetivo:** Definir estratégia de evolução do formato.
- **Entregáveis:**
  - Versionamento do schema.
  - Migração entre versões.
  - Compatibilidade.
- **Resultado esperado:** Formato preparado para v1.

---

## Fase 4 — Deployment Engine

### Sprint 10 — Especificação de Deploys e Upgrades [x]

- **Objetivo:** Definir as regras e fluxos operacionais de deploy, upgrade e rollback.
- **Entregáveis:**
  - Modelar oficialmente: regras conceituais de `deploy`, `upgrade`, `redeploy`, `rollback` e `force`.
- **Resultado esperado:** Comportamento conceitual congelado.

### Sprint 11 — Architecture Freeze [x]

- **Objetivo:** Revisar e declarar congelamento dos contratos públicos antes de avançar para a implementação das fases centrais.
- **Entregáveis:**
  - Congelar o formato de `caatinga.artifacts.json`.
  - Congelar `caatinga.config.ts`.
  - Congelar a API do Runtime.
  - Congelar o `WalletAdapter`.
  - Congelar o formato dos templates.
  - Congelar a superfície da CLI (comandos, flags e códigos `CAATINGA_*`).
- **Resultado esperado:** Contratos públicos estabilizados. Mudanças futuras serão tratadas como decisões arquiteturais conscientes.

### Sprint 12 — Resolução de placeholders [x]

- **Objetivo:** Formalizar resolução de referências.
- **Entregáveis:**
  - Resolução de `${contracts.token.contractId}`.
- **Resultado esperado:** Motor independente.

### Sprint 13 — Hooks [x]

- **Objetivo:** Revisar wire.
- **Entregáveis:**
  - Padronizar hooks.
  - Definir lifecycle.
- **Resultado esperado:** Pipeline previsível.

---

## Fase 5 — CLI

### Sprint 14 — Revisão da UX [x]

- **Objetivo:** Organizar comandos.
- **Entregáveis:**
  - Agrupar comandos em domínios.
- **Resultado esperado:** CLI intuitiva.

### Sprint 15 — Mensagens [x]

- **Objetivo:** Padronizar saída.
- **Entregáveis:**
  - Padronizar mensagens de: Erros, Warnings, Success, Logs.
- **Resultado esperado:** Experiência consistente.

### Sprint 16 — CAATINGA Codes [x]

- **Objetivo:** Padronizar todos os códigos de erro.
- **Resultado esperado:** Todos erros documentados.

---

## Fase 6 — Stellar CLI Adapter

### Sprint 17 — Adapter [x]

- **Objetivo:** Criar camada única de integração.
- **Resultado esperado:** Core nunca conhece stdout.

### Sprint 18 — Parser [x]

- **Objetivo:** Normalizar toda saída.
- **Resultado esperado:** API interna consistente.

### Sprint 19 — Testes do Adapter [x]

- **Objetivo:** Criar testes usando outputs reais.
- **Resultado esperado:** Mudanças futuras na Stellar CLI são detectadas rapidamente.

---

## Fase 7 — Runtime

### Sprint 20 — Runtime API [x]

- **Objetivo:** Definir responsabilidades.
- **Resultado esperado:** API mínima.

### Sprint 21 — Wallet Layer [x]

- **Objetivo:** Padronizar `WalletAdapter`.
- **Resultado esperado:** Abstração simples.

### Sprint 22 — Invoke Pipeline [x]

- **Objetivo:** Documentar o pipeline de invocação.
- **Entregáveis:**
  - Mapear e documentar: `simulate`, `sign`, `submit`, `watch`.
- **Resultado esperado:** Fluxo explícito.

---

## Fase 8 — Templates

### Sprint 23 — Engine [x]

- **Objetivo:** Separar templates da CLI.
- **Resultado esperado:** Templates independentes.

### Sprint 24 — Manifest [x]

- **Objetivo:** Formalizar manifesto.
- **Resultado esperado:** Templates versionáveis.

### Sprint 25 — Templates Oficiais [x]

- **Objetivo:** Revisar templates e manter apenas os essenciais.
- **Resultado esperado:** Poucos templates de alta qualidade.

---

## Fase 9 — Automation

### Sprint 26 — Doctor [x]

- **Objetivo:** Revisar verificações.
- **Resultado esperado:** Diagnóstico confiável.

### Sprint 27 — Smoke [x]

- **Objetivo:** Padronizar validações.
- **Resultado esperado:** Fluxo reproduzível.

### Sprint 28 — CI [x]

- **Objetivo:** Consolidar pipeline.
- **Resultado esperado:** Execução previsível.

---

## Fase 10 — Documentação

### Sprint 29 — README [x]

- **Objetivo:** Reposicionar o projeto focado no problema.
- **Resultado esperado:** README focado.

### Sprint 30 — Quick Start [x]

- **Objetivo:** Novo usuário em menos de cinco minutos.
- **Resultado esperado:** Menor tempo até o primeiro deploy.

### Sprint 31 — Conceitos [x]

- **Objetivo:** Criar documentação conceitual.
- **Entregáveis:**
  - Documentar: Deployment Graph, Artifacts, Runtime, Automation.
- **Resultado esperado:** Usuário entende os conceitos antes dos comandos.

---

## Fase 11 — Estabilização

### Sprint 32 — Revisão de APIs [x]

- **Objetivo:** Congelar interfaces públicas.

### Sprint 33 — Breaking Changes [x]

- **Objetivo:** Eliminar inconsistências.

### Sprint 34 — Polimento [x]

- **Objetivo:** Melhorar nomenclaturas, mensagens, ajuda da CLI e documentação.

---

## Fase 12 — Beta

### Sprint 35 — Produção [x]

- **Entregáveis:**
  - Adicionar `inspect`. ✓
  - Adicionar `rollback`. ✓
  - Adicionar `estimate`. ✓

### Sprint 36 — Qualidade [x]

- **Entregáveis:**
  - Cobertura de testes. ✓
  - Exemplos. ✓
  - Benchmarks.

### Sprint 37 — Release Candidate [x]

- **Entregáveis:**
  - Checklist para v1. ✓ (ver `docs/release-candidate-checklist.md`)
  - Congelamento do schema dos artifacts. ✓
  - Congelamento da API. ✓
  - Congelamento dos comandos. ✓

---

## Fase 13 — Hardening da Plataforma

### Sprint 38 — Auditoria Final da API Pública [x]

- **Objetivo:** Revisar tudo que ficará público na v1.0.
- **Entregáveis:**
  - Manifesto [`docs/public-api.md`](docs/public-api.md) com tiers Supported/Advanced/Internal. ✓
  - Teste de regressão de exports (`export-manifest.test.ts`). ✓
  - ROADMAP Fases 13–16. ✓

### Sprint 39 — Testes de Compatibilidade [x]

- **Objetivo:** Garantir que atualizações futuras não quebrem projetos antigos.
- **Entregáveis:**
  - Fixtures artifacts v1/v2 + `pnpm test:compat`. ✓
  - Snapshot de package exports. ✓

### Sprint 40 — Recovery e Casos de Erro [x]

- **Objetivo:** Tornar falhas previsíveis.
- **Entregáveis:**
  - [`docs/recovery-scenarios.md`](docs/recovery-scenarios.md). ✓
  - `writeArtifacts` atômico. ✓
  - Testes de cenários de recovery. ✓

---

## Fase 14 — Dogfooding

### Sprint 41 — Construção de um dApp Real [x]

- **Objetivo:** Projeto completo usando apenas APIs públicas.
- **Entregáveis:**
  - [`examples/dogfood-simple`](examples/dogfood-simple). ✓
  - [`docs/dogfood-backlog.md`](docs/dogfood-backlog.md). ✓

### Sprint 42 — Segundo Projeto (multi-contrato) [x]

- **Objetivo:** Validar graph, placeholders, upgrades.
- **Entregáveis:**
  - [`examples/dogfood-multi`](examples/dogfood-multi). ✓
  - [`docs/case-studies/multi-contract-dapp.md`](docs/case-studies/multi-contract-dapp.md). ✓

---

## Fase 15 — DX

### Sprint 43 — README + Quick Start [x]

- **Objetivo:** Primeiro deploy em menos de 10 minutos (toolchain instalada).
- **Entregáveis:** README com caminhos "toolchain pronta" e "máquina limpa". ✓

### Sprint 44 — Troubleshooting [x]

- **Entregáveis:** [`docs/troubleshooting.md`](docs/troubleshooting.md). ✓

---

## Fase 16 — Release Candidate

### Sprint 45 — UX Review da CLI [x]

- **Entregáveis:** [`docs/cli-ux-audit-v1.md`](docs/cli-ux-audit-v1.md). ✓

### Sprint 46 — Zero Knowledge Test [x]

- **Entregáveis:** [`docs/zk-test-protocol.md`](docs/zk-test-protocol.md), [`docs/zk-test-results.md`](docs/zk-test-results.md). ✓

### Sprint 47 — Release Candidate [x]

- **Entregáveis:** Checklist RC atualizado; pacotes `3.8.0`; CHANGELOG. ✓

### Sprint 48 — Release v1.0 [x]

- **Objetivo:** Lançamento oficial (contrato v1.0, npm major `3.x`, dist-tag `latest`).
- **Entregáveis:** Tag git `v1.0.0`; README v1.0 stable contract. ✓
