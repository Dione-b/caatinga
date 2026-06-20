# Lint + Prettier no monorepo Caatinga

## Contexto

O repositório Caatinga é um monorepo pnpm + Turbo, ESM-first, TypeScript 5.7+, Node 22+. Não existia configuração de lint nem de formatter. Isso abria espaço para inconsistências de estilo e erros que poderiam ser pegos estaticamente.

## Objetivo

Adicionar ESLint e Prettier no nível raiz, cobrindo todo o monorepo com uma configuração única, simples de manter e integrada aos scripts existentes.

## Decisão de arquitetura

**Opção escolhida:** configuração única na raiz (Option A).

Razões:

- Fonte única de verdade para regras de estilo e qualidade.
- Menos arquivos de config para manter.
- Difícil de gerar drift entre pacotes.
- Facilmente integrável ao Turbo e à CI.

## Ferramentas

Adicionar como `devDependencies` na raiz (`package.json`):

- `eslint` ^9
- `@eslint/js`
- `typescript-eslint` ^8
- `eslint-config-prettier`
- `prettier` ^3

## Arquivos de configuração

### `eslint.config.js` (raiz)

Flat config que:

- aplica `@eslint/js/recommended`;
- aplica `typescript-eslint/recommended`;
- inclui `eslint-config-prettier` por último para evitar conflitos;
- define `ignores` globais para diretórios e arquivos que não devem ser analisados.

Ignores:

- `node_modules/`, `dist/`, `.turbo/`, `packed/`, `.pnpm-store/`
- arquivos gerados: `**/contracts/generated/**`, `**/bindings/**`
- lockfiles: `pnpm-lock.yaml`

### `.prettierrc` (raiz)

Configuração JSON baseada no estilo predominante do repo:

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

### `.prettierignore` (raiz)

Mesmos padrões de ignore do ESLint.

## Scripts no `package.json` da raiz

```json
{
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

## Integração com Turbo

Adicionar tarefas no `turbo.json`:

```json
{
  "lint": {},
  "format:check": {}
}
```

Isso permite `turbo lint` e `turbo format:check` e alinha com o pipeline existente.

## Scope

Cobertura inicial:

- `packages/**/*.ts`
- `packages/**/*.tsx`
- `examples/**/*.ts`
- `scripts/**/*.{js,mjs,ts}`
- `docs/**/*.md`
- arquivos JSON de configuração e `package.json`

Exclusões:

- diretórios de build e dependências;
- arquivos gerados por `caatinga generate`;
- `pnpm-lock.yaml`.

## Rollout

1. **Commit 1:** adicionar dependências, arquivos de config e scripts sem formatar o código existente.
2. **Commit 2:** rodar `pnpm format` para aplicar o Prettier em todo o repo.
3. **Commit 3 (opcional):** adicionar `pnpm lint` e `pnpm format:check` ao `ci:publish-matrix` para travar na CI.

## Critérios de sucesso

- `pnpm lint` roda sem erros após ajustes manuais ou auto-fix.
- `pnpm format:check` passa após o commit de formatação.
- A CI falha se houver violações de lint ou formatação (após inclusão no matrix).
- Nenhum arquivo gerado é modificado pelo formatter.

## Riscos e mitigações

| Risco                                       | Mitigação                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| Grande diff inicial no commit de formatação | Isolar em commit próprio, sem alterações funcionais.                    |
| Regras conflitantes com Prettier            | Usar `eslint-config-prettier` por último na flat config.                |
| Arquivos gerados sendo formatados           | Lista explícita de ignores cobrindo `contracts/generated` e `bindings`. |
| Quebra na CI por causa de regras novas      | Resolver violações antes de adicionar ao `ci:publish-matrix`.           |
