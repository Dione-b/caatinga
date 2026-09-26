import type { NetworkConfig } from "../config/config.schema.js";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export function isMainnetNetwork(networkName: string, networkConfig: NetworkConfig): boolean {
  return networkName === "mainnet" || networkConfig.networkPassphrase === MAINNET_PASSPHRASE;
}

/**
 * Determines whether a mainnet operation requires confirmation.
 *
 * Fail-closed policy (B18 — mainnet-readiness audit):
 *
 * - On mainnet (by name or by canonical passphrase), confirmation is
 *   ALWAYS required. `networkConfig.requireConfirmation: false` is ignored
 *   on mainnet and cannot disable the guardrail.
 * - On non-mainnet networks, `requireConfirmation` is honoured: `true`
 *   requires confirmation, `false` (or unset) does not.
 *
 * The opt-out is deliberately NOT handled here. `CAATINGA_ASSUME_YES` and
 * `--yes` are CLI-layer concerns: `@caatinga/cli` decides how to satisfy
 * the requirement (interactive prompt, env-var override, or `--yes`) while
 * still emitting the `[MAINNET GUARDRAIL]` audit log. Reading the env var
 * in core would make the CLI's check unreachable dead code and would
 * suppress the audit log during CI runs.
 */
export function requiresMainnetConfirmation(
  networkName: string,
  networkConfig: NetworkConfig
): boolean {
  if (isMainnetNetwork(networkName, networkConfig)) {
    return true;
  }

  return networkConfig.requireConfirmation === true;
}
