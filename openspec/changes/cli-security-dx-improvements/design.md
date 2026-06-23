## Context

O `@caatinga/cli` é uma camada fina sobre `@caatinga/core` usando Commander. Subprocessos são executados via `execa` e `runCommand`. A análise de segurança e DX revelou 17 achados. A maioria das correções é localizada em arquivos individuais, sem necessidade de mudanças arquiteturais profundas.

## Goals / Non-Goals

**Goals:**

- Eliminar `curl | sh` sem verificação no setup
- Adicionar timeouts/cancel em todos os subprocessos longos
- Validar inputs de usuário que fluem para comandos externos
- Substituir semver caseiro por `semver` library
- Remover `process.exit()` abrupto do preflight
- Adicionar progresso visual em build, deploy e setup
- Substituir regex de config merge por AST-safe
- Eliminar redundâncias (double loadConfig, hardcoded versions)
- Adicionar validação de formato em `contractId` no rollback

**Non-Goals:**

- Refatorar a arquitetura Commander
- Migrar para outro framework de CLI
- Adicionar testes (já existem 22 arquivos de teste)
- Mudar API pública do `@caatinga/core` — mudanças mínimas, preferir novas exports

## Decisions

### D1 — `curl | sh` → download com checksum verification

- **Alternativas**: Usar `https.get` + `crypto.createHash('sha256')` para verificar checksum antes de executar
- **Rationale**: O `curl | sh` é o método oficial do rustup, mas adicionar verificação de checksum mitiga risco de supply chain se CDN for comprometido
- **Implementação**: Criar `downloadAndVerify` em `@caatinga/core` ou manter no CLI com `node:https` + `node:crypto`

### D2 — Subprocess timeouts via `execa` + `AbortController`

- **Alternativas**: `execa` nativamente suporta `cancelSignal` e `timeout`
- **Rationale**: Mínima mudança de código, sem novas dependências
- **Implementação**: Envolver cada `execa()` com `AbortSignal.timeout(5 * 60 * 1000)` para operações longas (cargo install, rustup update)

### D3 — Semver library

- **Alternativas**: `semver` package (35M weekly downloads, 0 deps)
- **Rationale**: Substitui ~50 linhas de código frágil por lib testada
- **Implementação**: Adicionar `semver` em `dependencies` do CLI, substituir `parseSemver` e `semverAtLeast`

### D4 — Config merge via AST em vez de regex

- **Alternativas**: `ts-morph` (AST completo), regex fixa (atual)
- **Rationale**: `ts-morph` é complexo demais para esse caso. Alternativa: usar `typescript` compiler API para parse e pretty-print. Mas como o `caatinga.config.ts` segue template padronizado, podemos melhorar o regex ou usar `jsonc` se migrarmos para JSON config
- **Decidido**: Melhorar o regex para ser mais tolerante a espaços e formatação; documentar o padrão esperado. Se surgirem mais casos, migrar para `ts-morph`

### D5 — Progresso visual

- **Alternativas**: `ora` (spinner), `cli-progress` (barra), stdout manual
- **Rationale**: `createZkInstallProgress` já implementa pattern de progress callback. Seguir o mesmo pattern para build, deploy e setup
- **Implementação**: Adicionar callbacks de progresso nos métodos do core, consumir no CLI com logger

### D6 — `process.exit(1)` → `process.exitCode = 1`

- **Alternativas**: Manter `process.exit()` (atual), trocar para exitCode
- **Rationale**: Consistência com o resto do código. `process.exitCode` permite que pending work termine
- **Implementação**: Substituir `process.exit(1)` por `process.exitCode = 1` + `return`

### D7 — Validação de contractId

- **Alternativas**: Regex `C[A-Z2-7]{55}` (StrKey Soroban), hex 64-char, lib `stellar-sdk`
- **Rationale**: Validar formato de contract ID (C... ou hex) antes de passar para core
- **Implementação**: Regex `^(C[A-Z2-7]{55}|[0-9a-fA-F]{64})$` no comando rollback

### D8 — Double loadConfig no doctor

- **Alternativas**: Passar config como parâmetro, lazy load
- **Rationale**: Remover segunda chamada `loadConfig` e reusar config já carregada por `runAllDiagnostics`
- **Implementação**: Modificar `runAllDiagnostics` para retornar config também

## Risks / Trade-offs

- **Timeout em `cargo install`**: 5 minutos pode ser pouco em hardware lento. Usar timeout configurável via env var `CAATINGA_SUBPROCESS_TIMEOUT` com fallback 10 min
- **Checksum verification do rustup**: O SHA256 muda a cada release do rustup. Precisamos manter o checksum atualizado. Alternativa: verificar assinatura GPG em vez de checksum fixo
- **AST-safe config merge**: Se o usuário tiver um config muito customizado, mesmo o AST melhorado pode falhar. Manter `--force` como escape hatch
- **Progresso em build**: WASM compilation não emite callbacks de progresso. O máximo que podemos fazer é mostrar "Compilando..." com spinner até terminar
