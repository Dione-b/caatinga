import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { CaatingaConfig, NetworkConfig } from "../config/config.schema.js";
import { NETWORK_METADATA_BY_PASSPHRASE } from "./network-metadata.js";

export type ResolvedNetwork = {
  name: string;
  config: NetworkConfig;
};

const BOILERPLATE_NETWORKS: Record<string, NetworkConfig> = Object.fromEntries(
  Object.entries(NETWORK_METADATA_BY_PASSPHRASE).map(([networkPassphrase, metadata]) => [
    metadata.sdkName,
    { rpcUrl: metadata.rpcUrl, networkPassphrase },
  ])
);

const BOILERPLATE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(NETWORK_METADATA_BY_PASSPHRASE).map(([, metadata]) => [
    metadata.sdkName,
    metadata.label,
  ])
);

/**
 * Renders the snippet from a typed NetworkConfig so the copied keys always match
 * NetworkConfigSchema — a hand-written snippet drifted from the schema and shipped
 * `passphrase:` plus wrong mainnet values.
 */
function renderNetworkBoilerplate(name: string, config: NetworkConfig): string {
  const fields = Object.entries(config)
    .map(([key, value]) => `      ${key}: ${JSON.stringify(value)}`)
    .join(",\n");

  return `${BOILERPLATE_LABELS[name] ?? name} Boilerplate:\n  networks: {\n    ${name}: {\n${fields}\n    }\n  }`;
}

export function resolveNetwork(config: CaatingaConfig, networkName?: string): ResolvedNetwork {
  const name = networkName ?? config.defaultNetwork;
  const network = config.networks[name];

  if (!network) {
    let hint = `Add "${name}" to caatinga.config.ts networks, or pass a configured --network value.`;

    const boilerplate = BOILERPLATE_NETWORKS[name];
    if (boilerplate) {
      hint += `\n\n${renderNetworkBoilerplate(name, boilerplate)}`;
    }

    throw new CaatingaError(
      `Network "${name}" is not configured.`,
      CaatingaErrorCode.NETWORK_NOT_FOUND,
      hint
    );
  }

  return { name, config: network };
}
