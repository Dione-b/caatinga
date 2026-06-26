import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "./CaatingaError.js";
import type { CaatingaErrorCodeValue } from "./CaatingaErrorCode.js";
import { listRepoSourceFiles } from "./list-repo-source-files.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const docsPath = path.join(repoRoot, "docs/errors.md");
const rawPublicErrorPattern = /new\s+CaatingaError\s*\([\s\S]*?,\s*["']CAATINGA_[A-Z0-9_]+["']/g;
const legacyUnprefixedStringCodePattern =
  /new\s+CaatingaError\s*\([\s\S]*?,\s*["']([A-Z][A-Z0-9_]+)["']/g;
const documentedPublicErrorPattern = /^\|\s*`(CAATINGA_[A-Z0-9_]+)`\s*\|/gm;
const requiredV1Codes = [
  "CAATINGA_DEPLOY_FAILED",
  "CAATINGA_BUILD_FAILED",
  "CAATINGA_BINDINGS_FAILED",
  "CAATINGA_INVOKE_FAILED",
  "CAATINGA_INVALID_TEMPLATE_MANIFEST",
  "CAATINGA_CONTRACT_DEPENDENCY_NOT_FOUND",
  "CAATINGA_CONTRACT_DEPENDENCY_CYCLE",
  "CAATINGA_CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND",
  "CAATINGA_DEPLOY_ARG_PLACEHOLDER_INVALID",
  "CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED",
];
const productionTriggerTests: Record<CaatingaErrorCodeValue, { file: string; trigger: string }> = {
  [CaatingaErrorCode.CONFIG_NOT_FOUND]: {
    file: "packages/core/src/config/load-config.test.ts",
    trigger: "loadConfig(",
  },
  [CaatingaErrorCode.INVALID_CONFIG]: {
    file: "packages/core/src/config/load-config.test.ts",
    trigger: "loadConfig(",
  },
  [CaatingaErrorCode.DEPENDENCIES_NOT_INSTALLED]: {
    file: "packages/core/src/config/load-config.test.ts",
    trigger: "loadConfig(",
  },
  [CaatingaErrorCode.COMMAND_FAILED]: {
    file: "packages/core/src/shell/run-command.test.ts",
    trigger: "runCommand(",
  },
  [CaatingaErrorCode.UNEXPECTED_ERROR]: {
    file: "packages/core/src/errors/to-caatinga-error.test.ts",
    trigger: "toCaatingaError(",
  },
  [CaatingaErrorCode.STELLAR_CLI_NOT_FOUND]: {
    file: "packages/core/src/stellar-cli/run-command-version.test.ts",
    trigger: "runCommand(",
  },
  [CaatingaErrorCode.STELLAR_CLI_VERSION_PARSE_FAILED]: {
    file: "packages/core/src/stellar-cli/check-stellar-cli-version.test.ts",
    trigger: "parseStellarCliVersion(",
  },
  [CaatingaErrorCode.UNSUPPORTED_CLI_VERSION]: {
    file: "packages/core/src/stellar-cli/check-stellar-cli-version.test.ts",
    trigger: "checkStellarCliVersion(",
  },
  [CaatingaErrorCode.STELLAR_SDK_VERSION_PARSE_FAILED]: {
    file: "packages/core/src/stellar-sdk/compat.test.ts",
    trigger: "evaluateStellarSdkCompatibility(",
  },
  [CaatingaErrorCode.UNSUPPORTED_SDK_VERSION]: {
    file: "packages/core/src/stellar-sdk/compat.test.ts",
    trigger: "evaluateStellarSdkCompatibility(",
  },
  [CaatingaErrorCode.ROLLBACK_TARGET_NOT_FOUND]: {
    file: "packages/core/src/artifacts/update-artifact.test.ts",
    trigger: "restoreArtifactFromHistory(",
  },
  [CaatingaErrorCode.ESTIMATE_FAILED]: {
    file: "packages/core/src/contracts/estimate-deploy-cost.test.ts",
    trigger: "estimateDeployCost(",
  },
  [CaatingaErrorCode.RUST_NOT_FOUND]: {
    file: "packages/core/src/shell/check-binary.test.ts",
    trigger: "checkBinary(",
  },
  [CaatingaErrorCode.RUST_TARGET_NOT_FOUND]: {
    file: "packages/core/src/contracts/build-contract.test.ts",
    trigger: "buildContract(",
  },
  [CaatingaErrorCode.DEPLOY_FAILED]: {
    file: "packages/core/src/contracts/deploy-contract.test.ts",
    trigger: "deployContract(",
  },
  [CaatingaErrorCode.BUILD_FAILED]: {
    file: "packages/core/src/contracts/build-contract.test.ts",
    trigger: "buildContract(",
  },
  [CaatingaErrorCode.BINDINGS_FAILED]: {
    file: "packages/core/src/contracts/generate-bindings.test.ts",
    trigger: "generateBindings(",
  },
  [CaatingaErrorCode.INVOKE_FAILED]: {
    file: "packages/core/src/contracts/invoke-contract.test.ts",
    trigger: "invokeContract(",
  },
  [CaatingaErrorCode.CONTRACT_NOT_FOUND]: {
    file: "packages/core/src/contracts/resolve-contract.test.ts",
    trigger: "resolveContract(",
  },
  [CaatingaErrorCode.NETWORK_NOT_FOUND]: {
    file: "packages/core/src/networks/resolve-network.test.ts",
    trigger: "resolveNetwork(",
  },
  [CaatingaErrorCode.ARTIFACT_NOT_FOUND]: {
    file: "packages/core/src/artifacts/read-write-artifacts.test.ts",
    trigger: "readArtifacts(",
  },
  [CaatingaErrorCode.ARTIFACT_INVALID]: {
    file: "packages/core/src/artifacts/read-write-artifacts.test.ts",
    trigger: "readArtifacts(",
  },
  [CaatingaErrorCode.CONTRACT_ID_NOT_FOUND]: {
    file: "packages/core/src/stellar-cli/parse-contract-id.test.ts",
    trigger: "parseContractId(",
  },
  [CaatingaErrorCode.CONTRACT_ARTIFACT_NOT_FOUND]: {
    file: "packages/client/src/artifacts/resolve-contract-id.test.ts",
    trigger: "resolveContractId(",
  },
  [CaatingaErrorCode.CONTRACT_DEPENDENCY_NOT_FOUND]: {
    file: "packages/core/src/contracts/resolve-deploy-order.test.ts",
    trigger: "resolveDeployOrder(",
  },
  [CaatingaErrorCode.CONTRACT_DEPENDENCY_CYCLE]: {
    file: "packages/core/src/contracts/resolve-deploy-order.test.ts",
    trigger: "resolveDeployOrder(",
  },
  [CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND]: {
    file: "packages/core/src/contracts/resolve-deploy-args.test.ts",
    trigger: "resolveDeployArgs(",
  },
  [CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND]: {
    file: "packages/core/src/contracts/verify-dependency-contract.test.ts",
    trigger: "verifyDependencyContract(",
  },
  [CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_INVALID]: {
    file: "packages/core/src/contracts/resolve-deploy-args.test.ts",
    trigger: "resolveDeployArgs(",
  },
  [CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_UNRESOLVED]: {
    file: "packages/core/src/contracts/deploy-contract.test.ts",
    trigger: "deployContract(",
  },
  [CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED]: {
    file: "packages/core/src/contracts/resolve-deploy-args.test.ts",
    trigger: "resolveDeployArgs(",
  },
  [CaatingaErrorCode.BINDING_CLIENT_NOT_FOUND]: {
    file: "packages/client/src/bindings/default-binding-adapter.test.ts",
    trigger: "createDefaultBindingAdapter(",
  },
  [CaatingaErrorCode.BINDING_METHOD_NOT_FOUND]: {
    file: "packages/client/src/bindings/default-binding-adapter.test.ts",
    trigger: "adapter.callMethod(",
  },
  [CaatingaErrorCode.PLACEHOLDER_BINDING]: {
    file: "packages/client/src/bindings/default-binding-adapter.test.ts",
    trigger: "createDefaultBindingAdapter(",
  },
  [CaatingaErrorCode.XDR_BUILD_FAILED]: {
    file: "packages/client/src/client/create-caatinga-client.test.ts",
    trigger: 'client.contract("counter").invoke(',
  },
  [CaatingaErrorCode.XDR_PREPARE_FAILED]: {
    file: "packages/client/src/xdr/build-xdr.test.ts",
    trigger: "buildXdr(",
  },
  [CaatingaErrorCode.XDR_SIGN_FAILED]: {
    file: "packages/client/src/client/create-caatinga-client.test.ts",
    trigger: 'client.contract("counter").invoke(',
  },
  [CaatingaErrorCode.XDR_SUBMIT_FAILED]: {
    file: "packages/client/src/client/create-caatinga-client.test.ts",
    trigger: 'client.contract("counter").invoke(',
  },
  [CaatingaErrorCode.XDR_RESULT_FAILED]: {
    file: "packages/client/src/client/caatinga-contract-client.test.ts",
    trigger: 'client.contract("counter").invoke(',
  },
  [CaatingaErrorCode.READ_RESULT_MISSING]: {
    file: "packages/client/src/client/caatinga-contract-client.test.ts",
    trigger: 'client.contract("counter").simulate(',
  },
  [CaatingaErrorCode.WALLET_NOT_CONNECTED]: {
    file: "packages/client/src/client/caatinga-contract-client.test.ts",
    trigger: 'client.contract("counter").buildXdr(',
  },
  [CaatingaErrorCode.WALLET_TIMEOUT]: {
    file: "packages/client/src/client/create-caatinga-client.test.ts",
    trigger: 'client.contract("counter").invoke(',
  },
  [CaatingaErrorCode.SOURCE_ACCOUNT_REQUIRED]: {
    file: "packages/core/src/contracts/source-account.test.ts",
    trigger: "assertSafeSourceAccount(",
  },
  [CaatingaErrorCode.SOURCE_IS_SECRET_KEY]: {
    file: "packages/core/src/contracts/source-account.test.ts",
    trigger: "assertSafeSourceAccount(",
  },
  [CaatingaErrorCode.SOURCE_IS_SEED_PHRASE]: {
    file: "packages/core/src/contracts/source-account.test.ts",
    trigger: "assertSafeSourceAccount(",
  },
  [CaatingaErrorCode.SOURCE_IS_PUBLIC_KEY]: {
    file: "packages/core/src/contracts/source-account.test.ts",
    trigger: "assertSafeSourceAccount(",
  },
  [CaatingaErrorCode.UNSAFE_SOURCE_ACCOUNT]: {
    file: "packages/core/src/contracts/source-account.test.ts",
    trigger: "assertSafeSourceAccount(",
  },
  [CaatingaErrorCode.INVOKE_TARGET_INVALID]: {
    file: "packages/core/src/contracts/invoke-contract.test.ts",
    trigger: "parseInvokeTarget(",
  },
  [CaatingaErrorCode.TEMPLATE_NOT_FOUND]: {
    file: "packages/cli/src/utils/template-path.test.ts",
    trigger: "resolveTemplateDir(",
  },
  [CaatingaErrorCode.INVALID_TEMPLATE_MANIFEST]: {
    file: "packages/core/src/templates/create-project-from-template.test.ts",
    trigger: "createProjectFromTemplate(",
  },
  [CaatingaErrorCode.TEMPLATE_MANIFEST_NOT_FOUND]: {
    file: "packages/core/src/templates/create-project-from-template.test.ts",
    trigger: "createProjectFromTemplate(",
  },
  [CaatingaErrorCode.TEMPLATE_INCOMPATIBLE]: {
    file: "packages/core/src/templates/create-project-from-template.test.ts",
    trigger: "createProjectFromTemplate(",
  },
  [CaatingaErrorCode.ZK_VERIFICATION_FAILED]: {
    file: "packages/core/src/errors/to-caatinga-error.test.ts",
    trigger: "toCaatingaError(",
  },
  [CaatingaErrorCode.ZK_DEV_CEREMONY_BLOCKED]: {
    file: "packages/core/src/errors/to-caatinga-error.test.ts",
    trigger: "toCaatingaError(",
  },
  [CaatingaErrorCode.DOCTOR_PARTIAL_DEPLOY]: {
    file: "packages/core/src/errors/error-codes.test.ts",
    trigger: "CaatingaErrorCode.DOCTOR_PARTIAL_DEPLOY",
  },
  [CaatingaErrorCode.MULTI_AUTH_REQUIRED]: {
    file: "packages/client/src/client/transaction-submit.test.ts",
    trigger: "submitTransaction(",
  },
};

function testBlocks(source: string): string[] {
  return source
    .split(/\n\s*it\(/)
    .slice(1)
    .map((block) => `it(${block}`);
}

describe("public error surface", () => {
  it("exports only CAATINGA_* codes", () => {
    expect(
      Object.values(CaatingaErrorCode).filter((code) => !code.startsWith("CAATINGA_"))
    ).toEqual([]);
  });

  it("exports every v1-required public error code", () => {
    const exportedCodes = new Set<string>(Object.values(CaatingaErrorCode));
    const missingCodes = requiredV1Codes.filter((code) => !exportedCodes.has(code));

    expect(missingCodes).toEqual([]);
  });

  it("documents every exported public error code", () => {
    const docs = readFileSync(docsPath, "utf8");
    const missingCodes = Object.values(CaatingaErrorCode).filter(
      (code) => !docs.includes(`\`${code}\``)
    );

    expect(missingCodes).toEqual([]);
  });

  it("exports every documented public error code", () => {
    const docs = readFileSync(docsPath, "utf8");
    const documentedCodes = [...docs.matchAll(documentedPublicErrorPattern)].map(
      (match) => match[1]
    );
    const exportedCodes = new Set<string>(Object.values(CaatingaErrorCode));
    const extraCodes = documentedCodes.filter((code) => !exportedCodes.has(code));

    expect(extraCodes).toEqual([]);
  });

  it("has a real production-path trigger test for every public error code", () => {
    const exportedCodes = Object.values(CaatingaErrorCode);

    expect(Object.keys(productionTriggerTests).sort()).toEqual([...exportedCodes].sort());

    for (const [code, coverage] of Object.entries(productionTriggerTests)) {
      const testPath = path.join(repoRoot, coverage.file);
      const source = readFileSync(testPath, "utf8");
      const enumMember = Object.entries(CaatingaErrorCode).find(([, value]) => value === code)?.[0];
      const matchingBlocks = testBlocks(source).filter((block) => {
        const assertsCode =
          block.includes(code) ||
          (enumMember ? block.includes(`CaatingaErrorCode.${enumMember}`) : false);
        return assertsCode && block.includes(coverage.trigger);
      });

      expect(
        matchingBlocks.length,
        `${code} should be asserted in the same test block that exercises ${coverage.trigger}`
      ).toBeGreaterThan(0);
      expect(coverage.file.endsWith(".test.ts"), `${coverage.file} must be a test file`).toBe(true);
    }
  });

  it("does not construct CaatingaError with raw CAATINGA_* string codes", () => {
    const violations = listRepoSourceFiles(repoRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const matches = source.match(rawPublicErrorPattern) ?? [];

      return matches.map((match) => `${path.relative(repoRoot, filePath)}: ${match}`);
    });

    expect(violations).toEqual([]);
  });

  it("does not construct CaatingaError with legacy unprefixed string codes", () => {
    const violations = listRepoSourceFiles(repoRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const matches = [...source.matchAll(legacyUnprefixedStringCodePattern)]
        .map((m) => m[1])
        .filter((code) => /^[A-Z][A-Z0-9_]+$/.test(code) && !code.startsWith("CAATINGA_"));

      return matches.map((code) => `${path.relative(repoRoot, filePath)}: ${code}`);
    });

    expect(violations).toEqual([]);
  });
});
