# Script pré-publish para o monorepo Caatinga

## Contexto

O repositório Caatinga publica quatro pacotes (`@caatinga/core`, `@caatinga/client`,
`@caatinga/cli`, `@caatinga/zk`) com `pnpm publish -r --access public --no-git-checks --tag <tag>`,
executado manualmente a partir da raiz. Hoje já existem várias checagens isoladas
(`scripts/check-version-alignment.sh`, `check-ci-stellar-pin.sh`, `check-fixture-references.sh`,
`check-wasm-target-paths.sh`) e um encadeamento completo voltado para CI
(`pnpm ci:publish-matrix`), mas nada que rode localmente, de forma leve, como um pré-flight
antes do publish manual. O `ci:publish-matrix` é pesado (faz snapshot-pack que muta
`package.json` e restaura via trap, roda consumer-isolation com instalação em tmp e rede),
e o `release-gate.yml` não cobre version-alignment, ci-stellar-pin, fixtures nem wasm-targets.

## Objetivo

Criar um orquestrador local que valide o monorepo de ponta a ponta antes do publish, sem
rede e sem mutar arquivos, falhando rápido e apontando o stage culpado. O usuário roda o
script manualmente; só depois executa o `pnpm publish -r` real.

## Decisão de arquitetura

**Opção escolhida:** orquestrador Bash `scripts/pre-publish.sh` (Approach A).

Razões:

- Segue a convenção do repo: todos os `check-*.sh` e `ci-snapshot-pack.sh` são bash com
  `set -euo pipefail`.
- Reutiliza 100% dos scripts de validação existentes — não duplica lógica de checagem.
- Saída legível por stage (`▶/✔/✖`) e sumário final, melhor que uma one-liner longa.
- Suporta flags (`--tag`, `--keep-going`, `--skip`, `--help`) sem acrobacia de shell.

Alternativas descartadas:

- **Orquestrador Node (.mjs):** quebra a convenção (só `docs-check.mjs` é `.mjs`, por motivo
  específico) e adiciona complexidade desnecessária para um encadeamento linear.
- **One-liner no `package.json`:** espelha `ci:publish-matrix`, mas perde sumário por stage,
  flags e fica frágil/difícil de ler.

## Arquitetura

Um arquivo `scripts/pre-publish.sh` (bash, `set -euo pipefail`) executa uma sequência
ordenada de **stages**. Cada stage é invocado por um helper `run_stage "<nome>" <cmd...>`
que:

1. imprime `▶ <nome>`;
2. executa o comando capturando o exit code;
3. imprime `✔ <nome>` em caso de sucesso, ou `✖ <nome>` e acumula a falha
   (modo `--keep-going`) ou aborta imediatamente (modo fail-fast, padrão).

Ao final, imprime uma tabela de stages com status e sai com código não-zero se qualquer
stage falhou. Reutiliza os scripts existentes — não reimplementa nenhuma validação.

### Pré-requisitos verificados no início

- Estar na raiz do repo (existe `package.json` e `scripts/` no cwd).
- `pnpm` no `PATH`.
- Node ≥ 22.

Falha cedo com mensagem clara se faltar qualquer pré-requisito.

## Stages (ordem: barato/local → caro → dry-run)

| #   | Stage              | Comando                                                                 |
| --- | ------------------ | ----------------------------------------------------------------------- |
| 1   | version-alignment  | `bash scripts/check-version-alignment.sh`                               |
| 2   | ci-stellar-pin     | `bash scripts/check-ci-stellar-pin.sh`                                  |
| 3   | fixture-references | `bash scripts/check-fixture-references.sh`                              |
| 4   | wasm-target-paths  | `pnpm check:wasm-targets`                                               |
| 5   | typecheck          | `pnpm typecheck`                                                        |
| 6   | lint               | `pnpm lint`                                                             |
| 7   | format             | `pnpm format:check`                                                     |
| 8   | docs               | `pnpm docs:check`                                                       |
| 9   | build              | `pnpm build`                                                            |
| 10  | test               | `pnpm test`                                                             |
| 11  | publish-dry-run    | `pnpm publish -r --access public --dry-run --no-git-checks --tag <tag>` |

A ordem coloca checagens estáticas/baratas primeiro, depois build, depois test, e por
último o `publish --dry-run` que valida o tarball que seria efetivamente publicado.

## Interface / flags

- `--tag <tag>` (default `next`): repassado ao `publish:dry-run` para validar com a tag real
  do publish.
- `--keep-going`: não parar no primeiro erro; acumula e mostra todos os stages falhos no
  sumário.
- `--skip <stage>`: pular um stage específico (ex: `--skip lint --skip format`) para iteração
  rápida. Pode ser passado múltiplas vezes.
- `--help`: exibe usage e sai com 0.

## Integração

Novos scripts no `package.json` da raiz:

```json
{
  "pre:publish": "bash scripts/pre-publish.sh",
  "pre:publish:keep-going": "bash scripts/pre-publish.sh --keep-going"
}
```

Uso típico:

```sh
pnpm pre:publish -- --tag latest
pnpm pre:publish:keep-going -- --tag next
```

## Tratamento de erros

- `set -euo pipefail` no script.
- Cada stage captura o exit code do comando; em modo fail-fast (padrão), interrompe no
  primeiro erro com mensagem indicando o stage culpado.
- Em `--keep-going`, acumula códigos de erro e imprime ao final:
  `N stage(s) failed: <lista>`.
- Pré-requisitos (raiz, pnpm, Node) são verificados antes de qualquer stage e falham cedo
  com mensagem acionável.

## Scope — o que NÃO faz (YAGNI)

- **Sem rede:** não roda `npm whoami`, não checa versões já publicadas no registry.
- **Sem mutar arquivos:** não roda `ci:snapshot-pack` (que muta `package.json` via changeset
  snapshot e restaura via trap) nem consumer-isolation/consumer-bundlers (instala em tmp com
  rede). Esses continuam no `pnpm ci:publish-matrix` para o full CI equivalent.
- **Sem hook `prepublishOnly`:** execução é manual, por escolha do usuário.
- **Sem bump de versão / changeset:** publica com a versão já presente nos `package.json`.

## Arquivos criados / alterados

- **Novo:** `scripts/pre-publish.sh` (executável, `chmod +x`).
- **Editado:** `package.json` da raiz — adicionar `pre:publish` e `pre:publish:keep-going`.
- **Novo (opcional):** `scripts/pre-publish.test.ts` — teste leve em Vitest que valida
  `--help` (exit 0, saída esperada) e parsing de flags; confiar nos testes já existentes de
  cada `check-*.sh` para a lógica de validação.

## Critérios de sucesso

- `pnpm pre:publish` roda todos os 11 stages e sai 0 em uma árvore limpa e alinhada.
- `pnpm pre:publish -- --tag latest` repassa a tag ao `publish --dry-run`.
- Uma versão desalinhada em qualquer `package.json` faz o stage `version-alignment` falhar e
  o script sai não-zero com mensagem do stage culpado.
- `--keep-going` roda todos os stages mesmo com falhas e apresenta sumário completo.
- `--skip <stage>` omite o stage da execução.
- `--help` imprime usage e sai 0.
- Sem rede e sem mutação de arquivos do working tree ao final da execução.

## Riscos e mitigações

| Risco                                                      | Mitigação                                                                                                                                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orquestração em bash ficar complexa                        | Helper único `run_stage` + lista de stages; manter o script linear e pequeno.                                                                                                           |
| Drift entre os stages deste script e o `ci:publish-matrix` | Reutilizar os mesmos scripts `check-*.sh` e tarefas `pnpm`; doc aponta o full matrix para CI.                                                                                           |
| `--skip` mascarar um problema real antes do publish        | `--skip` é opt-in e explícito; padrão roda tudo; documentar que é para iteração.                                                                                                        |
| `publish --dry-run` exigir auth do registry                | `pnpm publish --dry-run` apenas empacota o tarball localmente (sem upload, sem rede). A publicação real feita depois pelo usuário exigirá `npm login`/token — isso fica fora do script. |
| Duplicar testes de cada `check-*.sh`                       | Teste do orquestrador cobre só flags/help/exit; lógica de checagem fica nos scripts e seus próprios testes.                                                                             |
