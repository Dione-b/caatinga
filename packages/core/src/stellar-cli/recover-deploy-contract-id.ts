import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { NetworkConfig } from "../config/config.schema.js";
import { NETWORK_METADATA_BY_PASSPHRASE } from "../networks/network-metadata.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgsFromConfig } from "./build-stellar-network-args.js";
import { parseContractId } from "./parse-contract-id.js";

const TX_HASH_REGEX = /Transaction hash is ([a-f0-9]{64})/i;

/** Horizon is only consulted on the deploy-recovery path; fail fast rather than stall a failed deploy. */
export const HORIZON_RECOVERY_TIMEOUT_MS = 10_000;
const DEPLOY_SIGNING_FAILURE_REGEX = /xdr processing error: xdr value invalid/i;

type HorizonOperation = {
  transaction_successful?: boolean;
  type?: string;
  function?: string;
  salt?: string;
};

type HorizonOperationsResponse = {
  _embedded?: {
    records?: HorizonOperation[];
  };
};

// Re-exported from the shared strkey module (#148); kept here for back-compat
// with existing importers of this path.
export { isLikelyPublicKeySource } from "./strkey.js";

export function decimalSaltToHex(salt: string): string {
  return BigInt(salt).toString(16).padStart(64, "0");
}

export function resolveHorizonUrl(network: NetworkConfig): string {
  const horizonUrl = NETWORK_METADATA_BY_PASSPHRASE[network.networkPassphrase]?.horizonUrl;
  if (!horizonUrl) {
    throw new CaatingaError(
      `No Horizon URL mapping for network passphrase "${network.networkPassphrase}".`,
      CaatingaErrorCode.NETWORK_NOT_FOUND,
      "Use testnet or mainnet, or extend Caatinga network metadata."
    );
  }

  return horizonUrl;
}

export async function fetchCreateContractSalt(
  horizonUrl: string,
  transactionHash: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = HORIZON_RECOVERY_TIMEOUT_MS
): Promise<string | null> {
  let body: HorizonOperationsResponse;

  try {
    const response = await fetchImpl(`${horizonUrl}/transactions/${transactionHash}/operations`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return null;
    }

    body = (await response.json()) as HorizonOperationsResponse;
  } catch {
    // Recovery runs after a deploy has already failed: a timed-out, refused or
    // unparseable Horizon response means recovery is unavailable, never a hang
    // and never a second error stacked on top of the deploy failure.
    return null;
  }

  const operation = body._embedded?.records?.find(
    (record) =>
      record.transaction_successful === true &&
      record.type === "invoke_host_function" &&
      record.function === "HostFunctionTypeHostFunctionTypeCreateContract" &&
      typeof record.salt === "string"
  );

  return operation?.salt ?? null;
}

export async function resolveContractIdFromDeploySalt(options: {
  salt: string;
  source: string;
  network: NetworkConfig;
  cwd?: string;
}): Promise<string> {
  const saltHex = decimalSaltToHex(options.salt);
  const result = await runCommand(
    "stellar",
    [
      "contract",
      "id",
      "wasm",
      "--salt",
      saltHex,
      "--source-account",
      options.source,
      ...buildStellarNetworkArgsFromConfig(options.network),
    ],
    {
      cwd: options.cwd,
      skipStellarVersionCheck: true,
    }
  );

  return parseContractId(result.all || `${result.stdout}\n${result.stderr}`);
}

export async function tryRecoverContractIdFromDeployFailure(options: {
  output: string;
  source: string;
  network: NetworkConfig;
  cwd?: string;
  fetchImpl?: typeof fetch;
  /** Abort the Horizon lookup after this many ms (default {@link HORIZON_RECOVERY_TIMEOUT_MS}). */
  horizonTimeoutMs?: number;
}): Promise<string | null> {
  if (!DEPLOY_SIGNING_FAILURE_REGEX.test(options.output)) {
    return null;
  }

  const hashMatch = options.output.match(TX_HASH_REGEX);
  if (!hashMatch) {
    return null;
  }

  const horizonUrl = resolveHorizonUrl(options.network);
  const salt = await fetchCreateContractSalt(
    horizonUrl,
    hashMatch[1],
    options.fetchImpl,
    options.horizonTimeoutMs
  );
  if (!salt) {
    return null;
  }

  return resolveContractIdFromDeploySalt({
    salt,
    source: options.source,
    network: options.network,
    cwd: options.cwd,
  });
}
