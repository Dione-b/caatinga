import type { NetworkConfig } from "../config/config.schema.js";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export function isMainnetNetwork(networkName: string, networkConfig: NetworkConfig): boolean {
  return networkName === "mainnet" || networkConfig.networkPassphrase === MAINNET_PASSPHRASE;
}

export function requiresMainnetConfirmation(
  networkName: string,
  networkConfig: NetworkConfig
): boolean {
  if (networkConfig.requireConfirmation !== undefined) {
    return networkConfig.requireConfirmation;
  }
  return isMainnetNetwork(networkName, networkConfig);
}
