import { describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode, type CaatingaArtifacts } from "@caatinga/core/browser";
import { createCaatingaClient } from "./create-caatinga-client.js";

const artifacts: CaatingaArtifacts = {
  project: "counter-app",
  version: 1,
  networks: {
    testnet: {
      contracts: {
        counter: {
          contractId: "CCOUNTER000000000000000000000000000000000000000000000000",
          wasmHash: "hash",
          deployedAt: "2026-05-12T00:00:00.000Z",
          sourcePath: "contracts/counter",
          wasmPath: "target/wasm32v1-none/release/counter.wasm",
          dependencies: [],
          resolvedDeployArgs: {}
        }
      },
      dependencyGraph: {}
    }
  }
};

function createClientConfig(overrides: Record<string, unknown> = {}) {
  const wallet = {
    getPublicKey: vi.fn(async () => "GPUBLIC"),
    signTransaction: vi.fn(async () => "AAAA_SIGNED")
  };

  class Client {
    increment() {
      return {
        toXDR() {
          return "AAAA_UNSIGNED";
        },
        async signAndSend(input: { signedXdr: string }) {
          return { txHash: `hash:${input.signedXdr}`, result: 1 };
        }
      };
    }

    badSubmit() {
      return {
        toXDR() {
          return "AAAA_UNSIGNED";
        },
        async signAndSend() {
          return {};
        }
      };
    }

    failingPrepare() {
      return {
        toXDR() {
          return "AAAA_UNSIGNED";
        },
        prepare() {
          return Promise.reject(new Error("simulation failed"));
        }
      };
    }

    failingSubmit() {
      return {
        toXDR() {
          return "AAAA_UNSIGNED";
        },
        async signAndSend() {
          throw new Error("rpc rejected");
        }
      };
    }
  }

  return {
    network: {
      name: "testnet",
      rpcUrl: "https://rpc.example",
      networkPassphrase: "Test SDF Network ; September 2015"
    },
    artifacts,
    wallet,
    contracts: {
      counter: {
        binding: { Client },
        ...(overrides.contractRegistration as object | undefined)
      }
    },
    ...overrides
  };
}

describe("CaatingaContractClient (via createCaatingaClient)", () => {
  it("should_map_wallet_getPublicKey_rejection_to_WALLET_NOT_CONNECTED_on_buildXdr", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => {
          throw new Error("no wallet");
        }),
        signTransaction: vi.fn(async () => "AAAA_SIGNED")
      }
    });
    const client = createCaatingaClient(config);

    await expect(client.contract("counter").buildXdr("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.WALLET_NOT_CONNECTED
    });
  });

  it("should_map_wallet_getPublicKey_rejection_to_WALLET_NOT_CONNECTED_on_invoke", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => {
          throw new Error("no wallet");
        }),
        signTransaction: vi.fn(async () => "AAAA_SIGNED")
      }
    });
    const client = createCaatingaClient(config);

    await expect(client.contract("counter").invoke("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.WALLET_NOT_CONNECTED
    });
  });

  it("should_map_empty_submit_payload_to_XDR_RESULT_FAILED", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").invoke("badSubmit")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_RESULT_FAILED
    });
  });

  it("should_include_rpcUrl_in_hint_when_prepare_fails_on_buildXdr", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").buildXdr("failingPrepare")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_PREPARE_FAILED,
      hint: expect.stringContaining("https://rpc.example")
    });
  });

  it("should_include_rpcUrl_in_hint_when_submit_fails_on_invoke", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").invoke("failingSubmit")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_SUBMIT_FAILED,
      hint: expect.stringContaining("https://rpc.example")
    });
  });

  it("should_throw_XDR_SIGN_FAILED_when_signTransaction_returns_empty_string", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => "GPUBLIC"),
        signTransaction: vi.fn(async () => "")
      }
    });

    await expect(createCaatingaClient(config).contract("counter").invoke("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_SIGN_FAILED,
      hint: expect.stringContaining("empty")
    });
  });

  it("should_throw_XDR_SIGN_FAILED_when_signTransaction_returns_undefined", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => "GPUBLIC"),
        signTransaction: vi.fn(async () => undefined as unknown as string)
      }
    });

    await expect(createCaatingaClient(config).contract("counter").invoke("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_SIGN_FAILED,
      hint: expect.stringContaining("empty")
    });
  });
});
