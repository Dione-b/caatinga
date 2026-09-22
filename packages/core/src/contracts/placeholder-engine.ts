import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { CaatingaArtifacts } from "../artifacts/artifact.schema.js";

export type PlaceholderContext = {
  artifacts: CaatingaArtifacts;
  network: string;
  sourceAddress?: string;
};

/**
 * Grammar for `${contracts.<name>.contractId}` placeholders. Exported so that
 * config-time validation and resolve-time substitution cannot drift apart.
 * Callers compile their own RegExp because the two uses need different flags:
 * a global replace here, an anchored whole-value match in validation.
 */
export const CONTRACT_ID_PLACEHOLDER_SOURCE = String.raw`\$\{contracts\.([A-Za-z0-9_-]+)\.contractId\}`;

const CONTRACT_ID_REGEX = new RegExp(CONTRACT_ID_PLACEHOLDER_SOURCE, "g");
const SOURCE_ADDRESS_REGEX = /\$\{source\.address\}/g;

export function resolvePlaceholders(text: string, context: PlaceholderContext): string {
  let resolved = text.replace(CONTRACT_ID_REGEX, (_match, contractName) => {
    const contractArtifact = context.artifacts.networks[context.network]?.contracts[contractName];
    if (!contractArtifact?.contractId) {
      throw new CaatingaError(
        `No dependency artifact found for "${contractName}" on "${context.network}".`,
        CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND,
        "Deploy the dependency first or run deploy without --no-deps."
      );
    }
    return contractArtifact.contractId;
  });

  resolved = resolved.replace(SOURCE_ADDRESS_REGEX, () => {
    if (!context.sourceAddress) {
      throw new CaatingaError(
        `Required deploy source address \${source.address} was not resolved.`,
        CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED,
        "Pass --source <identity> to deploy or wire."
      );
    }
    return context.sourceAddress;
  });

  if (resolved.includes("${")) {
    throw new CaatingaError(
      `String "${text}" contains an unsupported or malformed placeholder.`,
      CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_INVALID,
      "Use only ${contracts.<contractName>.contractId} or ${source.address}."
    );
  }

  return resolved;
}
