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
          resolvedDeployArgs: {},
        },
      },
      dependencyGraph: {},
    },
  },
};

function createClientConfig(overrides: Record<string, unknown> = {}) {
  const wallet = {
    getPublicKey: vi.fn(async () => "GPUBLIC"),
    signTransaction: vi.fn(async () => "AAAA_SIGNED"),
  };

  class Client {
    increment() {
      return {
        toXDR() {
          return "AAAA_UNSIGNED";
        },
        async signAndSend(input: {
          signTransaction: (
            xdr: string,
            opts?: { networkPassphrase?: string; address?: string }
          ) => Promise<{ signedTxXdr: string }>;
        }) {
          const signed = await input.signTransaction("AAAA_UNSIGNED", {
            networkPassphrase: "Test SDF Network ; September 2015",
            address: "GPUBLIC",
          });
          return { txHash: `hash:${signed.signedTxXdr}`, result: 1 };
        },
      };
    }

    get(args?: { fallback?: number }) {
      return {
        toXDR() {
          return "AAAA_GET_UNSIGNED";
        },
        async prepare() {
          return {
            result: args?.fallback ?? 42,
            toXDR() {
              return "AAAA_GET_PREPARED";
            },
          };
        },
      };
    }

    noResult() {
      return {
        toXDR() {
          return "AAAA_NO_RESULT_UNSIGNED";
        },
        async prepare() {
          return {
            toXDR() {
              return "AAAA_NO_RESULT_PREPARED";
            },
          };
        },
      };
    }

    badSubmit() {
      return {
        toXDR() {
          return "AAAA_UNSIGNED";
        },
        async signAndSend() {
          return {};
        },
      };
    }

    failingPrepare() {
      return {
        toXDR() {
          return "AAAA_UNSIGNED";
        },
        prepare() {
          return Promise.reject(new Error("simulation failed"));
        },
      };
    }

    failingSubmit() {
      return {
        toXDR() {
          return "AAAA_UNSIGNED";
        },
        async signAndSend() {
          throw new Error("rpc rejected");
        },
      };
    }
  }

  return {
    network: {
      name: "testnet",
      rpcUrl: "https://rpc.example",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
    artifacts,
    wallet,
    contracts: {
      counter: {
        binding: { Client },
        ...(overrides.contractRegistration as object | undefined),
      },
    },
    ...overrides,
  };
}

describe("CaatingaContractClient (via createCaatingaClient)", () => {
  it("should_map_wallet_getPublicKey_rejection_to_WALLET_NOT_CONNECTED_on_buildXdr", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => {
          throw new Error("no wallet");
        }),
        signTransaction: vi.fn(async () => "AAAA_SIGNED"),
      },
    });
    const client = createCaatingaClient(config);

    await expect(client.contract("counter").buildXdr("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.WALLET_NOT_CONNECTED,
    });
  });

  it("should_map_wallet_getPublicKey_rejection_to_WALLET_NOT_CONNECTED_on_invoke", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => {
          throw new Error("no wallet");
        }),
        signTransaction: vi.fn(async () => "AAAA_SIGNED"),
      },
    });
    const client = createCaatingaClient(config);

    await expect(client.contract("counter").invoke("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.WALLET_NOT_CONNECTED,
    });
  });

  it("should_simulate_read_only_contract_method_and_return_metadata", async () => {
    const client = createCaatingaClient(createClientConfig());

    const result = await client.contract("counter").simulate<number>("get");

    expect(result).toEqual({
      status: "simulated",
      contract: "counter",
      method: "get",
      contractId: "CCOUNTER000000000000000000000000000000000000000000000000",
      result: 42,
    });
  });

  it("should_return_only_result_from_read_convenience_api", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").read<number>("get")).resolves.toBe(42);
  });

  it("should_forward_read_args_and_include_raw_when_debugRaw_is_enabled", async () => {
    const client = createCaatingaClient(createClientConfig());

    const result = await client
      .contract("counter")
      .simulate<number>("get", { fallback: 7 }, { debugRaw: true });

    expect(result).toMatchObject({
      status: "simulated",
      result: 7,
      raw: {
        result: 7,
      },
    });
  });

  it("should_map_wallet_getPublicKey_rejection_to_WALLET_NOT_CONNECTED_on_simulate", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => {
          throw new Error("no wallet");
        }),
        signTransaction: vi.fn(async () => "AAAA_SIGNED"),
      },
    });
    const client = createCaatingaClient(config);

    await expect(client.contract("counter").simulate("get")).rejects.toMatchObject({
      code: CaatingaErrorCode.WALLET_NOT_CONNECTED,
    });
  });

  it("should_map_missing_contract_artifact_to_CONTRACT_ARTIFACT_NOT_FOUND_on_simulate", async () => {
    const config = createClientConfig({
      artifacts: {
        project: "counter-app",
        version: 1,
        networks: {},
      },
    });
    const client = createCaatingaClient(config);

    await expect(client.contract("counter").simulate("get")).rejects.toMatchObject({
      code: CaatingaErrorCode.CONTRACT_ARTIFACT_NOT_FOUND,
    });
  });

  it("should_map_missing_binding_method_to_BINDING_METHOD_NOT_FOUND_on_simulate", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").simulate("missing")).rejects.toMatchObject({
      code: CaatingaErrorCode.BINDING_METHOD_NOT_FOUND,
    });
  });

  it("should_map_prepare_failure_to_XDR_PREPARE_FAILED_on_simulate", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").simulate("failingPrepare")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_PREPARE_FAILED,
      hint: expect.stringContaining("https://rpc.example"),
    });
  });

  it("should_throw_READ_RESULT_MISSING_when_simulation_has_no_result", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").simulate("noResult")).rejects.toMatchObject({
      code: CaatingaErrorCode.READ_RESULT_MISSING,
      hint: expect.stringContaining("counter.noResult"),
    });
  });

  it("should_map_empty_submit_payload_to_XDR_RESULT_FAILED", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").invoke("badSubmit")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_RESULT_FAILED,
    });
  });

  it("should_include_rpcUrl_in_hint_when_prepare_fails_on_buildXdr", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").buildXdr("failingPrepare")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_PREPARE_FAILED,
      hint: expect.stringContaining("https://rpc.example"),
    });
  });

  it("should_include_rpcUrl_in_hint_when_submit_fails_on_invoke", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").invoke("failingSubmit")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_SUBMIT_FAILED,
      hint: expect.stringContaining("https://rpc.example"),
    });
  });

  it("should_throw_XDR_SIGN_FAILED_when_signTransaction_returns_empty_string", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => "GPUBLIC"),
        signTransaction: vi.fn(async () => ""),
      },
    });

    await expect(
      createCaatingaClient(config).contract("counter").invoke("increment")
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_SIGN_FAILED,
      hint: expect.stringContaining("empty"),
    });
    expect(config.wallet.signTransaction).toHaveBeenCalledWith({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  it("should_throw_XDR_SIGN_FAILED_when_signTransaction_returns_undefined", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => "GPUBLIC"),
        signTransaction: vi.fn(async () => undefined as unknown as string),
      },
    });

    await expect(
      createCaatingaClient(config).contract("counter").invoke("increment")
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_SIGN_FAILED,
      hint: expect.stringContaining("empty"),
    });
    expect(config.wallet.signTransaction).toHaveBeenCalledWith({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  it("should_submit_with_stellar_sdk_signAndSend_signTransaction_callback", async () => {
    const signAndSend = vi.fn(
      async (input: {
        signTransaction: (
          xdr: string,
          opts?: { networkPassphrase?: string; address?: string }
        ) => Promise<{ signedTxXdr: string }>;
      }) => {
        const signed = await input.signTransaction("AAAA_PREPARED", {
          networkPassphrase: "Test SDF Network ; September 2015",
          address: "GPUBLIC",
        });
        return { txHash: `hash:${signed.signedTxXdr}`, result: 7 };
      }
    );

    class Client {
      increment() {
        return {
          toXDR() {
            return "AAAA_PREPARED";
          },
          signAndSend,
        };
      }
    }

    const config = createClientConfig({
      contracts: {
        counter: {
          binding: { Client },
        },
      },
    });

    const result = await createCaatingaClient(config).contract("counter").invoke("increment", {
      debugXdr: true,
    });

    expect(signAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        signTransaction: expect.any(Function),
      })
    );
    expect(config.wallet.signTransaction).toHaveBeenCalledWith({
      xdr: "AAAA_PREPARED",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    expect(result).toMatchObject({
      status: "confirmed",
      transactionHash: "hash:AAAA_SIGNED",
      result: 7,
      xdr: {
        unsigned: "AAAA_PREPARED",
        prepared: "AAAA_PREPARED",
        signed: "AAAA_SIGNED",
      },
    });
  });

  it("should_normalize_nested_stellar_sdk_send_transaction_response_hash", async () => {
    const signAndSend = vi.fn(
      async (input: {
        signTransaction: (
          xdr: string,
          opts?: { networkPassphrase?: string; address?: string }
        ) => Promise<{ signedTxXdr: string }>;
      }) => {
        await input.signTransaction("AAAA_PREPARED", {
          networkPassphrase: "Test SDF Network ; September 2015",
          address: "GPUBLIC",
        });
        return { sendTransactionResponse: { hash: "hash:nested" }, result: 9 };
      }
    );

    class Client {
      increment() {
        return {
          toXDR() {
            return "AAAA_PREPARED";
          },
          signAndSend,
        };
      }
    }

    const config = createClientConfig({
      contracts: {
        counter: {
          binding: { Client },
        },
      },
    });

    const result = await createCaatingaClient(config).contract("counter").invoke("increment");

    expect(result).toMatchObject({
      status: "confirmed",
      transactionHash: "hash:nested",
      result: 9,
    });
  });

  it("should_fallback_to_send_when_signAndSend_is_not_available", async () => {
    const send = vi.fn(async () => ({ txHash: "hash:send", result: 3 }));

    class Client {
      increment() {
        return {
          toXDR() {
            return "AAAA_PREPARED";
          },
          send,
        };
      }
    }

    const config = createClientConfig({
      contracts: {
        counter: {
          binding: { Client },
        },
      },
    });

    const result = await createCaatingaClient(config).contract("counter").invoke("increment");

    expect(config.wallet.signTransaction).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith();
    expect(result).toMatchObject({
      status: "confirmed",
      transactionHash: "hash:send",
      result: 3,
    });
  });
});
