import { afterEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { NetworkConfig } from "../config/config.schema.js";
import {
  assertProtocolForZk,
  fetchNetworkProtocolVersion,
  ZK_MIN_PROTOCOL_VERSION,
} from "./protocol-version.js";

const rpcUrl = "https://soroban-testnet.stellar.org";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchNetworkProtocolVersion", () => {
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
});
