# @caatinga/core

Core config, artifacts, command orchestration, and error primitives for the Caatinga / Stellar Soroban toolkit.

## Supported use

`@caatinga/core` is primarily an internal package for `@caatinga/cli` and official templates. Direct use beyond the documented config and template surface is advanced and less stable than the CLI contract.

Most applications should install `@caatinga/cli` or `@caatinga/client` instead of depending on core directly.

## What is in this package

### Config and networks

- `defineConfig` for `caatinga.config.ts` in generated projects
- `loadConfig`, `CaatingaConfigSchema`, and related types
- `WELL_KNOWN_NETWORKS`, `resolveNetwork`

### Artifacts

- `readArtifacts`, `writeArtifacts`, `createInitialArtifacts`, `updateArtifact`
- `CaatingaArtifactsSchema` and artifact types (`caatinga.artifacts.json`, schema version `1`)

### Contracts and Stellar CLI orchestration

- `buildContract`, `deployContract`, `deployContractGraph`
- `buildDependencyGraph`, `resolveDeployOrder`, `resolveDeployArgs`
- `generateBindings`, `invokeContract`, `parseInvokeTarget`
- `resolveContract`, `parseContractId`
- Stellar CLI compatibility — `parseStellarCliVersion`, `checkStellarCliVersion`, `evaluateStellarCliCompatibility`, and the `STELLAR_CLI_MIN_VERSION` / `STELLAR_CLI_LAST_TESTED_VERSION` constants. The compatibility model is feature-aware: the hard floor (`23.0.0`) is the only hard failure, the last-tested version is advisory, and the optional `features` argument is a forward-compatible hook for capability checks. See the [Stellar CLI version contract](https://github.com/Dione-b/caatinga/blob/main/docs/stellar-cli-version-contract.md) for the full contract.

### Templates

- `createProjectFromTemplate` and `TemplateManifestSchema`
- compatibility checks against `CAATINGA_CORE_VERSION` and template manifests

### Shell and errors

- `runCommand`, `checkBinary`
- `CaatingaError`, `CaatingaErrorCode`, `toCaatingaError`
- `CAATINGA_CORE_VERSION`

## Intended config surface

Generated projects import `defineConfig` from `@caatinga/core`:

```ts
import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "my-dapp",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm"
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./contracts/generated"
  }
});
```

Multi-contract projects may declare `dependsOn` and `${contracts.<name>.contractId}` placeholders in `deployArgs`; `deployContractGraph` resolves and deploys dependencies before dependents.

## Consumer guidance

| Goal | Package |
| --- | --- |
| End-user CLI workflow | `@caatinga/cli` |
| Browser / Node client over generated bindings | `@caatinga/client` |
| `caatinga.config.ts` in a Caatinga project | `defineConfig` from `@caatinga/core` |
| Custom tooling on deploy graphs, artifacts, or Stellar CLI orchestration | `@caatinga/core` (advanced; track releases closely) |

## Error codes

Core owns the canonical `CAATINGA_*` enum used by CLI, client, and templates. Automation should match on codes, not message text.

Common codes surfaced through core-backed commands:

- config and artifacts: `CAATINGA_CONFIG_NOT_FOUND`, `CAATINGA_INVALID_CONFIG`, `CAATINGA_ARTIFACT_NOT_FOUND`, `CAATINGA_ARTIFACT_INVALID`
- Stellar CLI: `CAATINGA_STELLAR_CLI_NOT_FOUND`, `CAATINGA_UNSUPPORTED_CLI_VERSION`
- contracts: `CAATINGA_BUILD_FAILED`, `CAATINGA_DEPLOY_FAILED`, `CAATINGA_BINDINGS_FAILED`, `CAATINGA_INVOKE_FAILED`
- dependencies: `CAATINGA_CONTRACT_DEPENDENCY_NOT_FOUND`, `CAATINGA_CONTRACT_DEPENDENCY_CYCLE`, `CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED`
- templates: `CAATINGA_TEMPLATE_MANIFEST_NOT_FOUND`, `CAATINGA_TEMPLATE_INCOMPATIBLE`

Full table: [docs/errors.md](https://github.com/Dione-b/caatinga/blob/main/docs/errors.md)

## Stability posture

Being published does not make every export a first-class end-user contract. Stable consumer surfaces are:

- the documented CLI workflow in `@caatinga/cli`
- the documented `@caatinga/client` APIs
- the narrow `@caatinga/core` config/template surface used by generated projects, including `defineConfig`

Direct `@caatinga/core` usage should be treated as advanced integration with a narrower support posture than the CLI package.

Further reference: [architecture](https://github.com/Dione-b/caatinga/blob/main/docs/architecture.md), [config](https://github.com/Dione-b/caatinga/blob/main/docs/config.md), [templates](https://github.com/Dione-b/caatinga/blob/main/docs/templates.md).
