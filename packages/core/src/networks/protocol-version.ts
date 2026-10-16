import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { NetworkConfig } from "../config/config.schema.js";

/**
 * Minimum network protocol for the shipped ZK verifier.
 *
 * The BLS12-381 host functions themselves exist since protocol 22 (CAP-0059),
 * but the verifier scaffold and `zk-starter` pin `soroban-sdk` 27, and a
 * contract built with SDK vN declares protocol N in its env meta: a network
 * below that rejects the wasm upload. Keep this equal to the pinned SDK major
 * (enforced by a test against the scaffold's Cargo.toml).
 */
export const ZK_MIN_PROTOCOL_VERSION = 27;

/**
 * Per-attempt timeout for the RPC `getNetwork` call. Bounded so a pre-flight
 * that never returns cannot wall CI behind a hung socket, but generous enough
 * for the public testnet RPC, which has been seen taking ~12s to answer.
 */
export const PROTOCOL_VERSION_TIMEOUT_MS = 20_000;

/**
 * Attempts made when the `getNetwork` call times out. Only a timeout is
 * retried: an RPC error payload, a non-2xx status or a refused connection is
 * a real answer and retrying it would only delay the same result.
 */
export const PROTOCOL_VERSION_MAX_ATTEMPTS = 2;

export type FetchProtocolVersionResult = {
  protocolVersion?: number;
  /**
   * Set when the RPC could not be reached or returned an unusable payload.
   * Callers treat this as advisory — an unreachable RPC must not block a
   * deploy that the rest of the toolchain would otherwise allow.
   */
  reason?: string;
};

type AttemptResult = FetchProtocolVersionResult & { timedOut?: boolean };

type JsonRpcResponse = {
  result?: { protocolVersion?: unknown };
  error?: { message?: unknown };
};

/**
 * Fetches the protocol version of a Soroban RPC endpoint.
 *
 * Uses a raw JSON-RPC `getNetwork` request rather than `@stellar/stellar-sdk`
 * so that `@caatinga/core` keeps its minimal dependency footprint — core shells
 * out to the Stellar CLI for everything else and pulls no Stellar SDK.
 *
 * `https` and `http` are both honoured because `getNetwork` is a plain RPC
 * method; the same permissiveness the CLI already shows for `--rpc-url` applies
 * here.
 */
export async function fetchNetworkProtocolVersion(
  rpcUrl: string,
  timeoutMs: number = PROTOCOL_VERSION_TIMEOUT_MS
): Promise<FetchProtocolVersionResult> {
  let result: AttemptResult = {};
  for (let attempt = 1; attempt <= PROTOCOL_VERSION_MAX_ATTEMPTS; attempt += 1) {
    result = await requestProtocolVersion(rpcUrl, timeoutMs);
    if (!result.timedOut) {
      break;
    }
  }
  return result.reason === undefined
    ? { protocolVersion: result.protocolVersion }
    : { reason: result.reason };
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function requestProtocolVersion(rpcUrl: string, timeoutMs: number): Promise<AttemptResult> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // No `params`: Stellar RPC decodes them into a request object, and an
      // array (`params: []`) is rejected with "invalid parameters".
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getNetwork" }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return { reason: `RPC responded ${response.status} ${response.statusText}` };
    }

    const payload = (await response.json()) as JsonRpcResponse;

    if (payload.error) {
      return {
        reason:
          typeof payload.error.message === "string"
            ? `RPC error: ${payload.error.message}`
            : "RPC returned an error payload",
      };
    }

    const raw = payload.result?.protocolVersion;
    if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
      return { protocolVersion: raw };
    }

    if (typeof raw === "string" && /^\d+$/.test(raw)) {
      const parsed = Number.parseInt(raw, 10);
      if (parsed > 0) {
        return { protocolVersion: parsed };
      }
    }

    return { reason: "RPC response did not include a numeric protocolVersion" };
  } catch (error) {
    return {
      reason: error instanceof Error ? error.message : "unknown RPC failure",
      timedOut: isTimeoutError(error),
    };
  }
}

export type AssertProtocolForZkOptions = {
  networkName: string;
  networkConfig: NetworkConfig;
  /** Label for the operation being guarded, e.g. `ctg deploy verifier`. */
  operation: string;
  /** Overrides the protocol version, bypassing the RPC call (used by tests). */
  protocolVersion?: number;
};

/**
 * Verifies the target network can verify BLS12-381 Groth16 proofs before a
 * ZK deploy or invoke is attempted.
 *
 * Fails loud when the network answers and is below the minimum protocol, and
 * returns an advisory note when the protocol could not be determined. A ZK
 * deploy against an unreachable RPC will fail downstream with a clearer
 * message than "protocol unknown", so blocking on it here would only trade one
 * error for a worse one.
 */
export async function assertProtocolForZk(
  options: AssertProtocolForZkOptions
): Promise<string | undefined> {
  const resolved =
    options.protocolVersion ??
    (await fetchNetworkProtocolVersion(options.networkConfig.rpcUrl)).protocolVersion;

  if (resolved === undefined) {
    return `Could not determine the protocol version of network "${options.networkName}"; the Caatinga ZK verifier requires protocol ${ZK_MIN_PROTOCOL_VERSION} or newer.`;
  }

  if (resolved < ZK_MIN_PROTOCOL_VERSION) {
    throw new CaatingaError(
      `${options.operation} requires protocol ${ZK_MIN_PROTOCOL_VERSION} or newer on network "${options.networkName}", but it is at protocol ${resolved}.`,
      CaatingaErrorCode.ZK_PROTOCOL_VERSION_UNSUPPORTED,
      `The verifier is built with soroban-sdk ${ZK_MIN_PROTOCOL_VERSION}, which targets protocol ${ZK_MIN_PROTOCOL_VERSION}. Target a network that has upgraded, or a different network.`
    );
  }

  return undefined;
}
