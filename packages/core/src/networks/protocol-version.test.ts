import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { NetworkConfig } from "../config/config.schema.js";
import {
  assertProtocolForZk,
  fetchNetworkProtocolVersion,
  PROTOCOL_VERSION_MAX_ATTEMPTS,
  PROTOCOL_VERSION_TIMEOUT_MS,
  ZK_MIN_PROTOCOL_VERSION,
} from "./protocol-version.js";

const rpcUrl = "https://soroban-testnet.stellar.org";
const packagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const testnet: NetworkConfig = {
  rpcUrl,
  networkPassphrase: "Test SDF Network ; September 2015",
};

function jsonRpc(protocolVersion: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ result: { protocolVersion } }),
  } as Response;
}

function timeoutError(): Error {
  return new DOMException("The operation was aborted due to timeout", "TimeoutError");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchNetworkProtocolVersion", () => {
  it("should_send_getNetwork_without_positional_params", async () => {
    // Stellar RPC rejects `params: []` with "invalid parameters" (it expects an
    // object or nothing), which silently turned every pre-flight into "unknown".
    const fetchMock = vi.fn(async () => jsonRpc(29));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchNetworkProtocolVersion(rpcUrl)).resolves.toEqual({ protocolVersion: 29 });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ jsonrpc: "2.0", id: 1, method: "getNetwork" });
  });

  it("should_return_the_numeric_protocol_version_from_getNetwork", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRpc(25))
    );

    await expect(fetchNetworkProtocolVersion(rpcUrl)).resolves.toEqual({ protocolVersion: 25 });
  });

  it("should_accept_a_string_protocol_version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRpc("26"))
    );

    await expect(fetchNetworkProtocolVersion(rpcUrl)).resolves.toEqual({ protocolVersion: 26 });
  });

  it("should_report_an_rpc_error_payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ error: { message: "method not found" } }),
      }))
    );

    const result = await fetchNetworkProtocolVersion(rpcUrl);

    expect(result.protocolVersion).toBeUndefined();
    expect(result.reason).toContain("method not found");
  });

  it("should_report_a_non_2xx_status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, statusText: "Service Unavailable" }))
    );

    const result = await fetchNetworkProtocolVersion(rpcUrl);

    expect(result.protocolVersion).toBeUndefined();
    expect(result.reason).toContain("503");
  });

  it("should_report_a_missing_protocol_version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRpc(undefined))
    );

    const result = await fetchNetworkProtocolVersion(rpcUrl);

    expect(result.protocolVersion).toBeUndefined();
    expect(result.reason).toBe("RPC response did not include a numeric protocolVersion");
  });

  it("should_report_a_throwing_fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const result = await fetchNetworkProtocolVersion(rpcUrl);

    expect(result.protocolVersion).toBeUndefined();
    expect(result.reason).toBe("ECONNREFUSED");
  });

  it("should_allow_a_slow_public_rpc_at_least_twenty_seconds", () => {
    // The public testnet RPC has taken ~12s to answer getNetwork; a 10s budget
    // reported "protocol unknown" with nothing actually wrong.
    expect(PROTOCOL_VERSION_TIMEOUT_MS).toBeGreaterThanOrEqual(20_000);
  });

  it("should_retry_once_when_the_first_attempt_times_out", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(jsonRpc(27));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchNetworkProtocolVersion(rpcUrl)).resolves.toEqual({ protocolVersion: 27 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    for (const [, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(JSON.parse(String(init.body))).toEqual({
        jsonrpc: "2.0",
        id: 1,
        method: "getNetwork",
      });
    }
  });

  it("should_give_up_with_the_timeout_reason_after_the_last_attempt", async () => {
    const fetchMock = vi.fn(async () => {
      throw timeoutError();
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchNetworkProtocolVersion(rpcUrl);

    expect(fetchMock).toHaveBeenCalledTimes(PROTOCOL_VERSION_MAX_ATTEMPTS);
    expect(result).toEqual({ reason: "The operation was aborted due to timeout" });
  });

  it("should_not_retry_an_rpc_error_payload", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ error: { message: "method not found" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchNetworkProtocolVersion(rpcUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should_not_retry_a_refused_connection", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchNetworkProtocolVersion(rpcUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("assertProtocolForZk", () => {
  it("should_allow_a_network_at_the_minimum_protocol_version", async () => {
    await expect(
      assertProtocolForZk({
        networkName: "testnet",
        networkConfig: testnet,
        operation: "ctg deploy verifier",
        protocolVersion: ZK_MIN_PROTOCOL_VERSION,
      })
    ).resolves.toBeUndefined();
  });

  it("should_allow_a_network_above_the_minimum_protocol_version", async () => {
    await expect(
      assertProtocolForZk({
        networkName: "testnet",
        networkConfig: testnet,
        operation: "ctg deploy verifier",
        protocolVersion: ZK_MIN_PROTOCOL_VERSION + 3,
      })
    ).resolves.toBeUndefined();
  });

  it("should_block_a_network_below_the_minimum_protocol_version", async () => {
    await expect(
      assertProtocolForZk({
        networkName: "testnet",
        networkConfig: testnet,
        operation: "ctg deploy verifier",
        protocolVersion: ZK_MIN_PROTOCOL_VERSION - 1,
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.ZK_PROTOCOL_VERSION_UNSUPPORTED,
    });
  });

  it("should_fall_back_to_the_rpc_when_no_version_is_injected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRpc(ZK_MIN_PROTOCOL_VERSION))
    );

    await expect(
      assertProtocolForZk({
        networkName: "testnet",
        networkConfig: testnet,
        operation: "ctg zk invoke",
      })
    ).resolves.toBeUndefined();
  });

  it("should_return_an_advisory_when_the_rpc_is_unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const advisory = await assertProtocolForZk({
      networkName: "testnet",
      networkConfig: testnet,
      operation: "ctg deploy verifier",
    });

    expect(advisory).toContain("Could not determine the protocol version");
  });

  it("should_return_an_advisory_when_every_attempt_times_out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw timeoutError();
      })
    );

    const advisory = await assertProtocolForZk({
      networkName: "testnet",
      networkConfig: testnet,
      operation: "ctg doctor",
    });

    expect(advisory).toContain("Could not determine the protocol version");
  });
});

describe("ZK_MIN_PROTOCOL_VERSION", () => {
  // A contract built with soroban-sdk vN declares protocol N in its env meta, so a
  // network below the pinned SDK major rejects the verifier upload. If the pin moves
  // without this constant, the pre-flight would wave through a network that cannot
  // run the verifier (or block one that can).
  it.each([
    "core/scaffolds/zk-verifier/Cargo.toml",
    "templates/zk-starter/contracts/verifier/Cargo.toml",
  ])("should_match_the_soroban_sdk_major_pinned_in_%s", async (cargoToml) => {
    const raw = await readFile(path.join(packagesDir, cargoToml), "utf8");
    const match = raw.match(/^soroban-sdk = "(\d+)\./m);

    expect(match, `no soroban-sdk pin found in ${cargoToml}`).not.toBeNull();
    expect(Number.parseInt(match![1]!, 10)).toBe(ZK_MIN_PROTOCOL_VERSION);
  });
});
