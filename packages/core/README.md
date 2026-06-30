# @caatinga/core

Config, artifacts, command orchestration, and error primitives for the Caatinga Soroban toolkit.

Most applications should use `@caatinga/cli` or `@caatinga/client` instead of depending on core directly.

## Primary exports

- **Config:** `defineConfig`, `loadConfig`, `CaatingaConfigSchema`, `resolveNetwork`
- **Artifacts:** `readArtifacts`, `writeArtifacts`, `CaatingaArtifactsSchema` (`caatinga.artifacts.json`)
- **Orchestration:** `buildContract`, `deployContract`, `deployContractGraph`, `generateBindings`, Stellar CLI compatibility helpers
- **Errors:** `CaatingaError`, `CaatingaErrorCode`, `toCaatingaError`

Generated projects import `defineConfig` from `@caatinga/core` in `caatinga.config.ts`.

## Documentation

Full export map and package layout: [Packages](https://github.com/Dione-b/caatinga/blob/main/docs/packages.md) · [Config schema](https://github.com/Dione-b/caatinga/blob/main/docs/config.md) · [Architecture](https://github.com/Dione-b/caatinga/blob/main/docs/architecture.md)

Direct `@caatinga/core` usage is advanced integration with a narrower stability posture than the CLI package.
