import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { NetworkConfig } from "../config/config.schema.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgsFromConfig } from "./build-stellar-network-args.js";
import { parseContractId } from "./parse-contract-id.js";

const TX_HASH_REGEX = /Transaction hash is ([a-f0-9]{64})/i;
const DEPLOY_SIGNING_FAILURE_REGEX = /xdr processing error: xdr value invalid/i;

const HORIZON_URL_BY_PASSPHRASE: Record<string, string> = {
  "Test SDF Network ; September 2015": "https://horizon-testnet.stellar.org",
  "Public Global Stellar Network ; September 2015": "https://horizon.stellar.org"
};

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

export function isLikelyPublicKeySource(source: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(source);
}

export function decimalSaltToHex(salt: string): string {
  return BigInt(salt).toString(16).padStart(64, "0");
}

export function resolveHorizonUrl(network: NetworkConfig): string {
  const horizonUrl = HORIZON_URL_BY_PASSPHRASE[network.networkPassphrase];
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
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const response = await fetchImpl(`${horizonUrl}/transactions/${transactionHash}/operations`);
  if (!response.ok) {
    return null;
  }

  const body = await response.json() as HorizonOperationsResponse;
  const operation = body._embedded?.records?.find((record) =>
    record.transaction_successful === true
    && record.type === "invoke_host_function"
    && record.function === "HostFunctionTypeHostFunctionTypeCreateContract"
    && typeof record.salt === "string"
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
  const result = await runCommand("stellar", [
    "contract",
    "id",
    "wasm",
    "--salt",
    saltHex,
    "--source-account",
    options.source,
    ...buildStellarNetworkArgsFromConfig(options.network)
  ], {
    cwd: options.cwd,
    skipStellarVersionCheck: true
  });

  return parseContractId(result.all || `${result.stdout}\n${result.stderr}`);
}

export async function tryRecoverContractIdFromDeployFailure(options: {
  output: string;
  source: string;
  network: NetworkConfig;
  cwd?: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  if (!DEPLOY_SIGNING_FAILURE_REGEX.test(options.output)) {
    return null;
  }

  const hashMatch = options.output.match(TX_HASH_REGEX);
  if (!hashMatch) {
    return null;
  }

  const horizonUrl = resolveHorizonUrl(options.network);
  const salt = await fetchCreateContractSalt(horizonUrl, hashMatch[1], options.fetchImpl);
  if (!salt) {
    return null;
  }

  return resolveContractIdFromDeploySalt({
    salt,
    source: options.source,
    network: options.network,
    cwd: options.cwd
  });
}
