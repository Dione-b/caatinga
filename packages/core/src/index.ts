export { CaatingaError, CaatingaErrorCode, toCaatingaError } from "./errors/CaatingaError.js";
export { formatCaatingaError } from "./errors/format-caatinga-error.js";
export { CAATINGA_CORE_VERSION } from "./version.js";

export {
  CaatingaConfigSchema,
  type CaatingaConfig,
  type ContractConfig,
  type NetworkConfig,
} from "./config/config.schema.js";
export { defineConfig } from "./config/define-config.js";
export { loadConfig, type LoadConfigOptions } from "./config/load-config.js";

export {
  CaatingaArtifactsSchema,
  type CaatingaArtifacts,
  type ContractArtifact,
} from "./artifacts/artifact.schema.js";
export { readArtifacts } from "./artifacts/read-artifacts.js";
export {
  writeArtifacts,
  createInitialArtifacts,
  type CreateInitialArtifactsOptions,
} from "./artifacts/write-artifacts.js";
export { updateArtifact, restoreArtifactFromHistory } from "./artifacts/update-artifact.js";
export { migrateArtifactsToV2 } from "./artifacts/migrate-artifacts.js";
export { migrateArtifactsFile } from "./artifacts/migrate-artifacts-file.js";
export { rollbackContractArtifact } from "./artifacts/rollback-artifact.js";
export { CURRENT_ARTIFACTS_SCHEMA_VERSION } from "./artifacts/artifact.schema.js";
export {
  collectProjectStatus,
  type CollectProjectStatusOptions,
  type ContractStatusEntry,
  type NetworkStatus,
  type ProjectStatus,
} from "./artifacts/project-status.js";

export {
  BINDING_MARKER_FILENAME,
  BindingMarkerSchema,
  readBindingMarker,
  writeBindingMarker,
  type BindingMarker,
} from "./bindings/binding-marker.js";
export {
  evaluateBindingFreshness,
  evaluateBindingsFreshness,
  type BindingFreshness,
  type BindingFreshnessStatus,
  type EvaluateBindingFreshnessOptions,
} from "./bindings/binding-freshness.js";

export { WELL_KNOWN_NETWORKS } from "./networks/networks.js";
export { resolveNetwork, type ResolvedNetwork } from "./networks/resolve-network.js";

export { runCommand, type RunCommandResult } from "./shell/run-command.js";
export { resolveSubprocessEnv, isCargoBinMissingFromPath } from "./shell/resolve-subprocess-env.js";
export { checkBinary } from "./shell/check-binary.js";
export { parseContractId } from "./stellar-cli/parse-contract-id.js";
export { parseWasmHash } from "./stellar-cli/parse-wasm-hash.js";
export {
  checkStellarCliVersion,
  type CheckStellarCliVersionOptions,
} from "./stellar-cli/check-stellar-cli-version.js";
export {
  STELLAR_CLI_LAST_TESTED_VERSION,
  STELLAR_CLI_MIN_VERSION,
  evaluateStellarCliCompatibility,
  parseStellarCliVersion,
  type CompatibilityReport,
  type CompatibilityStatus,
  type CompatibilityWarning,
  type CompatibilityWarningCode,
  type EvaluateStellarCliCompatibilityInput,
} from "./stellar-cli/compat.js";

export {
  checkStellarSdkVersion,
  type CheckStellarSdkVersionOptions,
} from "./stellar-sdk/check-stellar-sdk-version.js";
export {
  STELLAR_SDK_LAST_TESTED_VERSION,
  STELLAR_SDK_MIN_VERSION,
  evaluateStellarSdkCompatibility,
  parseStellarSdkVersion,
  type EvaluateStellarSdkCompatibilityInput,
  type SdkCompatibilityReport,
  type SdkCompatibilityStatus,
  type SdkCompatibilityWarning,
  type SdkCompatibilityWarningCode,
} from "./stellar-sdk/compat.js";

export { validateSourceShape } from "./contracts/validate-source-shape.js";
export {
  describeCliSource,
  DEFAULT_CLI_SOURCE,
  type CliSourceOrigin,
  type ResolvedCliSource,
} from "./contracts/source-account.js";
export { resolveContract, type ResolvedContract } from "./contracts/resolve-contract.js";
export { resolveDefaultContractName } from "./contracts/resolve-default-contract.js";
export { buildContract, type BuildContractOptions } from "./contracts/build-contract.js";
export { buildWorkspace, type BuildWorkspaceOptions } from "./contracts/build-workspace.js";
export { deployContract, type DeployContractOptions } from "./contracts/deploy-contract.js";
export { uploadWasm, type UploadWasmOptions, type UploadWasmResult } from "./contracts/upload-wasm.js";
export {
  upgradeContractInPlace,
  type UpgradeContractOptions,
  type UpgradeContractResult,
} from "./contracts/upgrade-contract.js";
export {
  deployContractGraph,
  type DeployContractGraphResult,
  type SkippedContract,
} from "./contracts/deploy-contract-graph.js";
export { buildDependencyGraph } from "./contracts/dependency-graph.js";
export { resolveDeployOrder } from "./contracts/resolve-deploy-order.js";
export {
  resolveDeployArgs,
  type DeployArgValue,
  type ResolveDeployArgsOptions,
} from "./contracts/resolve-deploy-args.js";
export {
  resolveMethodArgs,
  resolveCliMethodArgs,
  parseNamedCliArgs,
  looksLikeStellarAlias,
  STELLAR_ADDRESS_REGEX,
  type ResolveMethodArgsOptions,
} from "./contracts/resolve-method-args.js";
export { resolveSourceAddress } from "./contracts/resolve-source-address.js";
export {
  formatConstructorCliArgs,
  formatNamedCliArgs,
  toSnakeCaseFlag,
} from "./contracts/format-cli-args.js";
export {
  runPostDeployHooks,
  type RunPostDeployHooksOptions,
  type PostDeployHookResult,
} from "./contracts/run-post-deploy.js";
export {
  syncFrontendEnv,
  computeFrontendEnvEntries,
  type SyncFrontendEnvOptions,
  type SyncFrontendEnvResult,
} from "./frontend/sync-frontend-env.js";
export {
  evaluateEnvDrift,
  evaluateWasmDrift,
  type EnvDriftEntry,
  type EnvDriftReport,
} from "./frontend/evaluate-env-drift.js";
export {
  verifyExpect,
  assertExpect,
  parseExpectSpec,
  formatExpectDescription,
  type VerifyExpectOutcome,
} from "./contracts/verify-expect.js";
export {
  runSmokeReads,
  summarizeReadOutput,
  type RunSmokeReadsOptions,
  type SmokeReadResult,
} from "./contracts/run-smoke.js";
export {
  createFreshSmokeSymbol,
  withFreshSmokeArgs,
  DEFAULT_FRESH_SYMBOL_KEY,
  type FreshSmokeArgsOptions,
} from "./contracts/smoke-args.js";
export {
  readContractSorobanSdkVersions,
  type ContractSdkVersion,
} from "./contracts/read-contract-sdk-version.js";
export type {
  PostDeployHook,
  ExpectMatcher,
  ExpectSpec,
  SmokeRead,
} from "./config/config.schema.js";
export { generateBindings, type GenerateBindingsOptions } from "./contracts/generate-bindings.js";
export {
  generateBindingsGraph,
  type GenerateBindingsGraphResult,
} from "./contracts/generate-bindings-graph.js";
export {
  invokeContract,
  parseInvokeTarget,
  type InvokeContractOptions,
  type InvokeTarget,
} from "./contracts/invoke-contract.js";
export {
  readContract,
  buildReadCallHint,
  isReadCallFailure,
  READ_CALL_FAILURE_REGEX,
  type ReadContractOptions,
} from "./contracts/read-contract.js";
export {
  estimateDeployCost,
  type DeployCostEstimate,
  type EstimateDeployCostOptions,
} from "./contracts/estimate-deploy-cost.js";
export {
  inspectContract,
  type ContractInspectResult,
  type InspectContractOptions,
} from "./contracts/inspect-contract.js";
export {
  createProjectFromTemplate,
  type CreateProjectFromTemplateOptions,
} from "./templates/create-project-from-template.js";
export { createZkProject, type CreateZkProjectOptions } from "./scaffold/create-zk-project.js";
export {
  createMinimalProject,
  type CreateMinimalProjectOptions,
} from "./scaffold/create-minimal-project.js";
export {
  TemplateManifestSchema,
  type TemplateManifest,
} from "./templates/template-manifest.schema.js";

export { isTransientTestnetSmokeFailure } from "./ci/is-transient-testnet-smoke-failure.js";
