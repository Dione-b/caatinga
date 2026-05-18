export { CaatingaError, CaatingaErrorCode, toCaatingaError } from "./errors/CaatingaError.js";
export { CAATINGA_CORE_VERSION } from "./version.js";

export {
  CaatingaConfigSchema,
  type CaatingaConfig,
  type ContractConfig,
  type NetworkConfig
} from "./config/config.schema.js";
export { defineConfig } from "./config/define-config.js";
export { loadConfig, type LoadConfigOptions } from "./config/load-config.js";

export {
  CaatingaArtifactsSchema,
  type CaatingaArtifacts,
  type ContractArtifact
} from "./artifacts/artifact.schema.js";
export { readArtifacts } from "./artifacts/read-artifacts.js";
export { writeArtifacts, createInitialArtifacts } from "./artifacts/write-artifacts.js";
export { updateArtifact } from "./artifacts/update-artifact.js";

export { WELL_KNOWN_NETWORKS } from "./networks/networks.js";
export { resolveNetwork, type ResolvedNetwork } from "./networks/resolve-network.js";

export { runCommand, type RunCommandResult } from "./shell/run-command.js";
export { checkBinary } from "./shell/check-binary.js";
export { parseContractId } from "./stellar-cli/parse-contract-id.js";
export * from "./stellar-cli/version.js";

export { validateSourceShape } from "./contracts/validate-source-shape.js";
export { resolveContract, type ResolvedContract } from "./contracts/resolve-contract.js";
export { buildContract, type BuildContractOptions } from "./contracts/build-contract.js";
export { deployContract, type DeployContractOptions } from "./contracts/deploy-contract.js";
export {
  deployContractGraph,
  type DeployContractGraphResult,
  type SkippedContract
} from "./contracts/deploy-contract-graph.js";
export { buildDependencyGraph } from "./contracts/dependency-graph.js";
export { resolveDeployOrder } from "./contracts/resolve-deploy-order.js";
export { resolveDeployArgs, type DeployArgValue } from "./contracts/resolve-deploy-args.js";
export { generateBindings, type GenerateBindingsOptions } from "./contracts/generate-bindings.js";
export {
  invokeContract,
  parseInvokeTarget,
  type InvokeContractOptions,
  type InvokeTarget
} from "./contracts/invoke-contract.js";
export {
  createProjectFromTemplate,
  type CreateProjectFromTemplateOptions
} from "./templates/create-project-from-template.js";
export {
  TemplateManifestSchema,
  type TemplateManifest
} from "./templates/template-manifest.schema.js";

export { isTransientTestnetSmokeFailure } from "./ci/is-transient-testnet-smoke-failure.js";
