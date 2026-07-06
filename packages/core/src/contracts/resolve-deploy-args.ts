import type { CaatingaArtifacts } from "../artifacts/artifact.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveSourceAddress } from "./resolve-source-address.js";
import { resolvePlaceholders } from "./placeholder-engine.js";

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

  const usesSourceAddress = Object.values(input.deployArgs).some(
    (value) => typeof value === "string" && value.includes("${source.address}")
  );

  if (usesSourceAddress) {
    if (!input.source) {
      throw new CaatingaError(
        `Deploy args require a deploy source for \${source.address}.`,
        CaatingaErrorCode.SOURCE_ADDRESS_UNRESOLVED,
        "Pass --source <identity> to deploy or wire."
      );
    }
    sourceAddress = await resolveSourceAddress({
      source: input.source,
      cwd: input.cwd,
    });
  }

  const context = {
    artifacts: input.artifacts,
    network: input.network,
    sourceAddress,
  };

  for (const [key, value] of Object.entries(input.deployArgs)) {
    if (typeof value !== "string" || !value.includes("${")) {
      resolved[key] = value;
      continue;
    }

    resolved[key] = resolvePlaceholders(value, context);
  }

  return resolved;
}
