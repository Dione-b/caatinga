# Relatório: feat/cargo-test-script-readme

**Data:** 2026-06-20
**Branch:** `feat/cargo-test-script-readme`
**PR:** [#54](https://github.com/Dione-b/caatinga/pull/54) → `developer`
**Commit:** `18e2841`

---

## Objetivo

Adicionar scripts de teste Rust (`cargo test`) aos templates oficiais do Caatinga e alinhar
as versões de dependências dos templates com a versão atual do monorepo (`^3.0.1`).

---

## Alterações por área

### 1. Templates oficiais (3 templates)

| Template | Arquivos alterados |
|---|---|
| `react-vite-counter` | `package.json`, `caatinga.template.json`, `README.md` |
| `marketplace-with-token` | `package.json`, `caatinga.template.json`, `README.md` |
| `zk-starter` | `package.json`, `caatinga.template.json`, `README.md` |

**Em todos os templates:**

- **Novo script `test`** no `package.json`:
  - `react-vite-counter`: `cargo test --manifest-path contracts/counter/Cargo.toml`
  - `marketplace-with-token`: `cargo test --manifest-path contracts/token/Cargo.toml && cargo test --manifest-path contracts/marketplace/Cargo.toml`
  - `zk-starter`: `cargo test --manifest-path contracts/verifier/Cargo.toml`

- **Versões bumpadas:**
  - `@caatinga/client`: `^3.0.0` → `^3.0.1`
  - `@caatinga/core`: `^3.0.0` → `^3.0.1`
  - `@caatinga/cli`: `^3.0.0` → `^3.0.1`
  - `@caatinga/zk` (zk-starter apenas): `^3.0.0` → `^3.0.1`
  - `compatibleCore` no `caatinga.template.json`: `^3.0.0` → `^3.0.1`

- **READMEs atualizados** com instruções de teste (`npm test` / `cargo test`)

### 2. Scaffolds (geração de projetos)

| Arquivo | Alteração |
|---|---|
| `packages/core/src/scaffold/create-minimal-project.ts` | Adicionado script `test` no `packageJsonSource()` e seção "Tests" no `readmeSource()` |
| `packages/core/src/scaffold/create-zk-project.ts` | Adicionado script `test` no `packageJsonSource()` e seção "Tests" no `readmeSource()` |

Projetos gerados via `caatinga init` ou `caatinga zk init` agora incluem automaticamente
o script `test` e documentação de teste no README.

### 3. Testes

| Arquivo | Tipo | Descrição |
|---|---|---|
| `packages/cli/src/templates/template-scripts.test.ts` | **Novo** | Valida que todos os templates oficiais possuem script `test` com `cargo test` correto para cada contract |
| `packages/core/src/scaffold/create-minimal-project.test.ts` | Atualizado | Atualizado fixture para incluir script `test` |
| `packages/core/src/scaffold/create-zk-project.test.ts` | Atualizado | Atualizado fixture para incluir script `test` |

---

## Bugs corrigidos durante a implementação

1. **Backticks não escapados em `create-zk-project.ts`**: O edit original trocou
   `` \`\`\` `` (escaped) por `` ``` `` (raw) dentro de um template literal TypeScript,
   quebrando o esbuild. Corrigido restaurando o escape.

2. **Caracteres `\n` literais em `create-minimal-project.ts`**: `\n` foi adicionado
   literalmente após fences de código (em vez de quebras de linha reais). Removido.

3. **Versões desalinhadas**: Os templates ainda usavam `^3.0.0` mas o repo está em
   `v3.0.1`, causando falha nos testes `should_pin_internal_dependency_ranges` e
   `should_keep_each_official_template_manifest_compatible_with_core`. Corrigido com bump.

4. **Erro de typecheck em `template-scripts.test.ts`**: A union type `{ contract: string } | { contracts: string[] }` não refinava corretamente no ternário. Simplificado usando
   `{ contracts: string[] }[]` uniforme.

---

## Verificação

| Check | Status |
|---|---|
| `pnpm test` | 420 testes passando (core: 253, cli: 61, client: 91, zk: 15) |
| `pnpm typecheck` | Limpo |
| `pnpm lint` | Limpo |
| `pnpm format:check` | Limpo |

---

## Arquivos alterados (14)

```
packages/cli/src/templates/template-scripts.test.ts          (novo)
packages/core/src/scaffold/create-minimal-project.test.ts    (+1)
packages/core/src/scaffold/create-minimal-project.ts         (+12)
packages/core/src/scaffold/create-zk-project.test.ts         (+3)
packages/core/src/scaffold/create-zk-project.ts              (+12)
packages/templates/marketplace-with-token/README.md          (+3)
packages/templates/marketplace-with-token/caatinga.template.json (+1)
packages/templates/marketplace-with-token/package.json       (+4/-3)
packages/templates/react-vite-counter/README.md              (+2)
packages/templates/react-vite-counter/caatinga.template.json (+1)
packages/templates/react-vite-counter/package.json           (+4/-3)
packages/templates/zk-starter/README.md                      (+2)
packages/templates/zk-starter/caatinga.template.json         (+1)
packages/templates/zk-starter/package.json                   (+5/-4)
```

**Total:** 88 inserções, 13 remoções
