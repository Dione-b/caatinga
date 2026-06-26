import type { CaatingaArtifacts } from "../artifacts/artifact.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveSourceAddress } from "./resolve-source-address.js";

const CONTRACT_ID_PLACEHOLDER = /^\$\{contracts\.([A-Za-z0-9_-]+)\.contractId\}$/;
const SOURCE_ADDRESS_PLACEHOLDER = /^\$\{source\.address\}$/;

export type DeployArgValue = string | number | boolean;

export type ResolveDeployArgsOptions = {
  deployArgs: Record<string, DeployArgValue>;
  artifacts: CaatingaArtifacts;
  network: string;
  source?: string;
  cwd?: string;
};

export async function resolveDeployArgs(
  input: ResolveDeployArgsOptions
): Promise<Record<string, DeployArgValue>> {
  const resolved: Record<string, DeployArgValue> = {};
  let sourceAddress: string | undefined;

  for (const [key, value] of Object.entries(input.deployArgs)) {
    if (typeof value !== "string" || !value.includes("${")) {
      resolved[key] = value;
      continue;
    }

    const contractMatch = value.match(CONTRACT_ID_PLACEHOLDER);
    if (contractMatch) {
      const contractName = contractMatch[1];
      const contractArtifact = input.artifacts.networks[input.network]?.contracts[contractName];

      if (!contractArtifact?.contractId) {
        throw new CaatingaError(
          `No dependency artifact found for "${contractName}" on "${input.network}".`,
          CaatingaErrorCode.CONTRACT_DEPENDENCY_ARTIFACT_NOT_FOUND,
          "Deploy the dependency first or run deploy without --no-deps."
        );
      }

      resolved[key] = contractArtifact.contractId;
      continue;
    }

    if (SOURCE_ADDRESS_PLACEHOLDER.test(value)) {
      if (!input.source) {
        throw new CaatingaError(
          `Deploy arg "${key}" requires a deploy source for \${source.address}.`,
          CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED,
          "Pass --source <identity> to deploy or wire."
        );
      }

      sourceAddress ??= await resolveSourceAddress({
        source: input.source,
        cwd: input.cwd,
      });
      resolved[key] = sourceAddress;
      continue;
    }

    throw new CaatingaError(
      `Deploy arg "${key}" contains an unsupported placeholder.`,
      CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_INVALID,
      "Use only ${contracts.<contractName>.contractId} or ${source.address}."
    );
  }

  return resolved;
}
