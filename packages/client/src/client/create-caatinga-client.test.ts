import { describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode, type CaatingaArtifacts } from "@caatinga/core/browser";
import type { CaatingaClientConfig } from "../types.js";
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
          await input.signTransaction("AAAA_UNSIGNED", {
            networkPassphrase: "Test SDF Network ; September 2015",
            address: "GPUBLIC",
          });
          return {
            sendTransactionResponse: { hash: "hash:AAAA_SIGNED", status: "PENDING" },
            get result() {
              return 1;
            },
          };
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

describe("createCaatingaClient", () => {
  it("should_throw_CONTRACT_NOT_FOUND_when_contract_name_is_unregistered", () => {
    const client = createCaatingaClient(createClientConfig());

    expect(() => client.contract("unknown")).toThrowError(
      expect.objectContaining({ code: CaatingaErrorCode.CONTRACT_NOT_FOUND })
    );
  });

  it("invokes a binding method through wallet signing", async () => {
    const config = createClientConfig();
    const client = createCaatingaClient(config);

    const result = await client.contract("counter").invoke("increment");

    expect(config.wallet.getPublicKey).toHaveBeenCalledOnce();
    expect(config.wallet.signTransaction).toHaveBeenCalledWith({
      xdr: "AAAA_UNSIGNED",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    expect(result).toEqual({
      status: "confirmed",
      contract: "counter",
      method: "increment",
      contractId: "CCOUNTER000000000000000000000000000000000000000000000000",
      transactionHash: "hash:AAAA_SIGNED",
      result: 1,
    });
  });

  it("omits xdr unless debugXdr is enabled", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").invoke("increment")).resolves.not.toHaveProperty("xdr");
  });

  it("includes xdr when debugXdr is enabled", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(
      client.contract("counter").invoke("increment", { debugXdr: true })
    ).resolves.toMatchObject({
      xdr: {
        unsigned: "AAAA_UNSIGNED",
        prepared: "AAAA_UNSIGNED",
        signed: "AAAA_SIGNED",
      },
    });
  });

  it("builds xdr without asking the wallet to sign", async () => {
    const config = createClientConfig();
    const client = createCaatingaClient(config);

    await expect(client.contract("counter").buildXdr("increment")).resolves.toEqual({
      contract: "counter",
      method: "increment",
      contractId: "CCOUNTER000000000000000000000000000000000000000000000000",
      unsignedXdr: "AAAA_UNSIGNED",
      preparedXdr: "AAAA_UNSIGNED",
    });
    expect(config.wallet.signTransaction).not.toHaveBeenCalled();
  });

  it("should_reject_with_WALLET_TIMEOUT_when_sign_never_resolves", async () => {
    vi.useFakeTimers();
    const config = createClientConfig({
      walletTimeout: 50,
      wallet: {
        getPublicKey: vi.fn(async () => "GPUBLIC"),
        signTransaction: vi.fn(() => new Promise(() => {})),
      },
    });
    const client = createCaatingaClient(config);
    const promise = client.contract("counter").invoke("increment");
    const assertion = expect(promise).rejects.toMatchObject({
      code: CaatingaErrorCode.WALLET_TIMEOUT,
    });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    vi.useRealTimers();
  });

  it("maps wallet signing failures to CAATINGA_XDR_SIGN_FAILED", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => "GPUBLIC"),
        signTransaction: vi.fn(async () => {
          throw new Error("wallet rejected");
        }),
      },
    });
    const client = createCaatingaClient(config);

    await expect(client.contract("counter").invoke("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_SIGN_FAILED,
    });
  });

  it("maps_binding_transaction_without_toXDR_to_XDR_BUILD_FAILED", async () => {
    class ClientWithoutXdr {
      increment() {
        return {};
      }
    }

    const base = createClientConfig();
    const client = createCaatingaClient({
      ...base,
      contracts: {
        counter: { binding: { Client: ClientWithoutXdr } },
      },
    } as CaatingaClientConfig);

    await expect(client.contract("counter").invoke("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_BUILD_FAILED,
    });
  });

  it("maps_binding_transaction_without_submit_to_XDR_SUBMIT_FAILED", async () => {
    class ClientWithoutSubmit {
      increment() {
        return {
          toXDR() {
            return "AAAA_UNSIGNED";
          },
        };
      }
    }

    const base = createClientConfig();
    const client = createCaatingaClient({
      ...base,
      contracts: {
        counter: { binding: { Client: ClientWithoutSubmit } },
      },
    } as CaatingaClientConfig);

    await expect(client.contract("counter").invoke("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_SUBMIT_FAILED,
    });
  });

  it("maps_submit_errors_to_XDR_SUBMIT_FAILED", async () => {
    class ClientWithFailingSubmit {
      increment() {
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

    const base = createClientConfig();
    const client = createCaatingaClient({
      ...base,
      contracts: {
        counter: { binding: { Client: ClientWithFailingSubmit } },
      },
    } as CaatingaClientConfig);

    await expect(client.contract("counter").invoke("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_SUBMIT_FAILED,
    });
  });
});
