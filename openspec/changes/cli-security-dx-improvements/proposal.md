## Why

A atualização do `@caatinga/cli` introduziu novos comandos e funcionalidades, mas a análise de segurança e DX revelou 17 pontos críticos: desde `curl | sh` sem verificação até config manipulado com regex frágil. Esses problemas afetam confiabilidade em produção e experiência do desenvolvedor. Precisamos corrigi-los antes da próxima release.

## What Changes

- Substituir `curl | sh` por download com verificação no setup
- Adicionar timeouts em subprocessos longos
- Validar formato de `contractId` no rollback
- Substituir semver caseiro por `semver` library
- Remover `allowUnknownOption` e validar args explicitamente no invoke/read
- Adicionar progresso visual em build, deploy e setup
- Trocar `process.exit()` por `process.exitCode` no preflight
- Substituir regex frágil por AST-safe config merge no zk init
- Consertar double loadConfig no doctor
- Remover hardcoded version strings
- Adicionar validação de formato em `--to` no rollback
- Adicionar `cancelSignal` e timeout em todos os `execa` subprocessos

## Capabilities

### New Capabilities

- `secure-subprocess`: Safe subprocess execution with timeouts, cancel signals, and verified downloads
- `cli-input-validation`: Input validation for forwarded args (invoke/read) and contract IDs (rollback)
- `setup-user-experience`: Progress bars/indicators for long operations and better error feedback
- `config-merge-safety`: Safe, AST-based config manipulation replacing fragile regex in zk-init
- `doctor-reliability`: Single loadConfig, skip transparency, and version freshness
- `template-resolution`: Safer and more predictable template resolution strategy

### Modified Capabilities

- `cli-zk-scaffold`: zk init config merge logic changes from regex to AST-safe approach

## Impact

- **packages/cli/src/commands/**: setup, deploy, invoke, read, rollback, zk-init, doctor, estimate, build
- **packages/cli/src/utils/**: errors, preflight, template-path, zk-guardrails
- **packages/cli/src/diagnostics/**: project, stellar, dependencies
- **packages/cli/package.json**: new dependency on `semver`
- **packages/cli/src/**: version.ts
- **@caatinga/core**: may need new exports for subprocess with timeout/cancel
