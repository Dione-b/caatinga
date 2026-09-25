import type { NetworkConfig } from "../config/config.schema.js";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export function isMainnetNetwork(networkName: string, networkConfig: NetworkConfig): boolean {
  return networkName === "mainnet" || networkConfig.networkPassphrase === MAINNET_PASSPHRASE;
}

/**
 * Returns true when `CAATINGA_ASSUME_YES` is set to a value that means
 * "yes, I explicitly acknowledge the mainnet risk" (case-insensitive).
 *
 * Accepted truthy values: `true`, `1`, `yes`, `y`.
 *
 * This is the ONLY way to silence the mainnet guardrail without an
 * interactive prompt. Anything else (missing, `false`, `0`, `no`, arbitrary)
 * fails closed.
 */
function isAssumeYesSet(): boolean {
  const envVal = process.env.CAATINGA_ASSUME_YES?.toLowerCase().trim();
  return envVal === "true" || envVal === "1" || envVal === "yes" || envVal === "y";
}

/**
 * Determines whether a mainnet operation requires interactive confirmation.
 *
 * Fail-closed rules (B18 — mainnet-readiness audit):
 *
 * - On mainnet (by name or by canonical passphrase), confirmation is
 *   REQUIRED by default, regardless of `networkConfig.requireConfirmation`.
 * - `requireConfirmation: false` on mainnet is IGNORED unless
 *   `CAATINGA_ASSUME_YES` is explicitly set. A config copied from testnet
 *   with `requireConfirmation: false` therefore cannot silently disable the
 *   mainnet prompt or the `[MAINNET GUARDRAIL]` warning.
 * - On non-mainnet networks, `requireConfirmation` is honoured as-is.
 */
export function requiresMainnetConfirmation(
  networkName: string,
  networkConfig: NetworkConfig
): boolean {
  const isMainnet = isMainnetNetwork(networkName, networkConfig);

  if (isMainnet && isAssumeYesSet()) {
    // Explicit, deliberate opt-out for CI / non-interactive environments.
    return false;
  }

  if (isMainnet) {
    // On mainnet: always require confirmation, regardless of config.
    return true;
  }

  // Non-mainnet: honour the explicit config knob if set, else false.
  if (networkConfig.requireConfirmation !== undefined) {
    return networkConfig.requireConfirmation;
  }

  return false;
}
