import { Account, SorobanDataBuilder, StrKey, xdr as StellarXdr } from "@stellar/stellar-sdk";
import { Client as StellarContractClient, NULL_ACCOUNT, Spec } from "@stellar/stellar-sdk/contract";
import { describe, expect, it, vi } from "vitest";
import { CaatingaError, CaatingaErrorCode, type CaatingaArtifacts } from "@caatinga/core/browser";
import { DEFAULT_READ_SOURCE_ACCOUNT } from "../constants.js";
import { createCaatingaClient } from "./create-caatinga-client.js";

const WALLET_PUBLIC_KEY = "GPUBLIC";
const READ_SOURCE_ACCOUNT = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(3));
const OVERRIDE_READ_SOURCE_ACCOUNT = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(5));
const REAL_CONTRACT_ID = StrKey.encodeContract(new Uint8Array(32).fill(7));

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

let lastClientInput: { publicKey?: string } | undefined;

function createClientConfig(overrides: Record<string, unknown> = {}) {
  const wallet = {
    getPublicKey: vi.fn(async () => "GPUBLIC"),
    signTransaction: vi.fn(async () => "AAAA_SIGNED"),
  };

  class Client {
    async increment(options?: {
      restore?: boolean;
      signTransaction?: (xdr: string) => Promise<{ signedTxXdr: string }>;
    }) {
      if (options?.restore) {
        await options.signTransaction?.("AAAA_RESTORE");
      }

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
          return { txHash: `hash:${signed.signedTxXdr}`, result: 1, status: "SUCCESS" };
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

    /** Read-only method whose contract argument is literally named `sourceAccount`. */
    lookupAccount(args?: { sourceAccount?: string }) {
      return {
        toXDR() {
          return "AAAA_LOOKUP_UNSIGNED";
        },
        async prepare() {
          return {
            result: args?.sourceAccount ?? "no-args",
            toXDR() {
              return "AAAA_LOOKUP_PREPARED";
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

    missingAccount() {
      return Promise.reject(new Error("ACCOUNT_NOT_FOUND"));
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

    failedLifecycle() {
      return {
        toXDR() {
          return "AAAA_FAILED_UNSIGNED";
        },
        async signAndSend(input: { signTransaction: (xdr: string) => Promise<unknown> }) {
          await input.signTransaction("AAAA_FAILED_UNSIGNED");
          return {
            sendTransactionResponse: { hash: "hash:failed", status: "PENDING" },
            getTransactionResponse: {
              status: "FAILED",
              resultXdr: "AAAA_RESULT",
              diagnosticEvents: [{ type: "contract" }],
            },
          };
        },
      };
    }

    pendingLifecycle() {
      return {
        toXDR() {
          return "AAAA_PENDING_UNSIGNED";
        },
        async signAndSend(input: { signTransaction: (xdr: string) => Promise<unknown> }) {
          await input.signTransaction("AAAA_PENDING_UNSIGNED");
          return {
            sendTransactionResponse: { hash: "hash:pending", status: "PENDING" },
            getTransactionResponse: { status: "NOT_FOUND" },
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

  it("should_forward_opt_in_state_restoration_and_wallet_signer_to_generated_binding", async () => {
    const signTransaction = vi.fn(async () => "AAAA_SIGNED");
    const client = createCaatingaClient(
      createClientConfig({
        wallet: {
          getPublicKey: vi.fn(async () => "GPUBLIC"),
          signTransaction,
        },
      })
    );

    await client.contract("counter").invoke("increment", { restore: true });

    expect(signTransaction).toHaveBeenCalledWith({
      xdr: "AAAA_RESTORE",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  it("should_classify_missing_account_during_generated_method_construction", async () => {
    const client = createCaatingaClient(createClientConfig());

    await expect(client.contract("counter").simulate("missingAccount")).rejects.toMatchObject({
      code: CaatingaErrorCode.SIMULATION_ACCOUNT_NOT_FOUND,
    });
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

  describe("read-only source account resolution", () => {
    const disconnectedWallet = () => ({
      getPublicKey: vi.fn(async () => {
        throw new Error("no wallet");
      }),
      signTransaction: vi.fn(async () => "AAAA_SIGNED"),
    });

    it("should_omit_publicKey_when_wallet_getPublicKey_rejects_and_nothing_is_configured", async () => {
      const config = createClientConfig({ wallet: disconnectedWallet() });
      const client = createCaatingaClient(config);

      const result = await client.contract("counter").simulate("get");

      expect(result.status).toBe("simulated");
      expect(result.result).toBe(42);
      // The placeholder is never handed to the binding client: omitting the key makes the
      // SDK build the transaction with its local null account instead of an RPC lookup.
      expect(lastClientInput?.publicKey).toBeUndefined();
    });

    it("should_omit_publicKey_when_wallet_is_omitted_from_config", async () => {
      const config = createClientConfig();
      delete (config as { wallet?: unknown }).wallet;
      const client = createCaatingaClient(config);

      const result = await client.contract("counter").simulate("get");

      expect(result.status).toBe("simulated");
      expect(result.result).toBe(42);
      expect(lastClientInput?.publicKey).toBeUndefined();
    });

    it("should_omit_publicKey_when_wallet_getPublicKey_returns_a_blank_string", async () => {
      const config = createClientConfig({
        wallet: {
          getPublicKey: vi.fn(async () => "   "),
          signTransaction: vi.fn(async () => "AAAA_SIGNED"),
        },
      });
      const client = createCaatingaClient(config);

      const result = await client.contract("counter").simulate("get");

      expect(result.result).toBe(42);
      expect(lastClientInput?.publicKey).toBeUndefined();
    });

    it("should_omit_publicKey_when_the_configured_source_is_the_default_placeholder", async () => {
      const config = createClientConfig({
        wallet: disconnectedWallet(),
        readSourceAccount: DEFAULT_READ_SOURCE_ACCOUNT,
      });
      const client = createCaatingaClient(config);

      const result = await client.contract("counter").simulate("get");

      expect(result.result).toBe(42);
      expect(lastClientInput?.publicKey).toBeUndefined();
    });

    it("should_fall_back_when_the_wallet_reports_WALLET_NOT_CONNECTED", async () => {
      const config = createClientConfig({
        wallet: {
          getPublicKey: vi.fn(async () => {
            throw new CaatingaError(
              "Freighter did not return an address.",
              CaatingaErrorCode.WALLET_NOT_CONNECTED
            );
          }),
          signTransaction: vi.fn(async () => "AAAA_SIGNED"),
        },
        readSourceAccount: READ_SOURCE_ACCOUNT,
      });
      const client = createCaatingaClient(config);

      const result = await client.contract("counter").simulate("get");

      expect(result.result).toBe(42);
      expect(lastClientInput?.publicKey).toBe(READ_SOURCE_ACCOUNT);
    });

    it("should_surface_WALLET_TIMEOUT_instead_of_falling_back", async () => {
      const config = createClientConfig({
        wallet: {
          getPublicKey: vi.fn(() => new Promise<string>(() => {})),
          signTransaction: vi.fn(async () => "AAAA_SIGNED"),
        },
        walletTimeout: 5,
      });
      const client = createCaatingaClient(config);
      lastClientInput = undefined;

      await expect(client.contract("counter").simulate("get")).rejects.toMatchObject({
        code: CaatingaErrorCode.WALLET_TIMEOUT,
      });
      expect(lastClientInput).toBeUndefined();
    });

    it("should_surface_caatinga_errors_other_than_WALLET_NOT_CONNECTED", async () => {
      const config = createClientConfig({
        wallet: {
          getPublicKey: vi.fn(async () => {
            throw new CaatingaError("Failed to sign XDR.", CaatingaErrorCode.XDR_SIGN_FAILED);
          }),
          signTransaction: vi.fn(async () => "AAAA_SIGNED"),
        },
      });
      const client = createCaatingaClient(config);

      await expect(client.contract("counter").simulate("get")).rejects.toMatchObject({
        code: CaatingaErrorCode.XDR_SIGN_FAILED,
      });
    });

    it("should_use_configured_readSourceAccount_when_the_wallet_has_no_key", async () => {
      const config = createClientConfig({
        wallet: disconnectedWallet(),
        readSourceAccount: READ_SOURCE_ACCOUNT,
      });
      const client = createCaatingaClient(config);

      const result = await client.contract("counter").simulate("get");

      expect(result.status).toBe("simulated");
      expect(lastClientInput?.publicKey).toBe(READ_SOURCE_ACCOUNT);
    });

    it("should_prefer_the_connected_wallet_over_the_configured_readSourceAccount", async () => {
      const config = createClientConfig({ readSourceAccount: READ_SOURCE_ACCOUNT });
      const client = createCaatingaClient(config);

      const result = await client.contract("counter").simulate("get");

      expect(result.result).toBe(42);
      expect(lastClientInput?.publicKey).toBe(WALLET_PUBLIC_KEY);
    });

    it("should_prefer_the_sourceAccount_option_over_the_connected_wallet", async () => {
      const client = createCaatingaClient(createClientConfig());

      const result = await client
        .contract("counter")
        .simulate("get", { sourceAccount: OVERRIDE_READ_SOURCE_ACCOUNT });

      expect(result.status).toBe("simulated");
      expect(lastClientInput?.publicKey).toBe(OVERRIDE_READ_SOURCE_ACCOUNT);
    });

    it("should_reject_an_invalid_sourceAccount_option", async () => {
      const client = createCaatingaClient(createClientConfig());

      await expect(
        client.contract("counter").simulate("get", { sourceAccount: "GPUBLIC" })
      ).rejects.toMatchObject({
        code: CaatingaErrorCode.INVALID_CONFIG,
        message: expect.stringContaining('the sourceAccount option of "counter.get"'),
      });
    });

    it("should_reject_an_invalid_configured_readSourceAccount", async () => {
      const config = createClientConfig({
        wallet: disconnectedWallet(),
        readSourceAccount: "not-an-account",
      });
      const client = createCaatingaClient(config);

      await expect(client.contract("counter").simulate("get")).rejects.toMatchObject({
        code: CaatingaErrorCode.INVALID_CONFIG,
        message: expect.stringContaining('CaatingaClientConfig.readSourceAccount of "counter.get"'),
      });
    });

    it("should_not_validate_the_configured_source_while_the_wallet_provides_a_key", async () => {
      const config = createClientConfig({ readSourceAccount: "not-an-account" });
      const client = createCaatingaClient(config);

      const result = await client.contract("counter").simulate("get");

      expect(result.result).toBe(42);
      expect(lastClientInput?.publicKey).toBe(WALLET_PUBLIC_KEY);
    });

    it("should_forward_a_single_object_with_arg_keys_as_contract_args", async () => {
      const client = createCaatingaClient(createClientConfig());

      const result = await client.contract("counter").simulate<number>("get", {
        sourceAccount: OVERRIDE_READ_SOURCE_ACCOUNT,
        fallback: 7,
      });

      // `sourceAccount` travelled as a contract argument, so the wallet stays the source.
      expect(result.result).toBe(7);
      expect(lastClientInput?.publicKey).toBe(WALLET_PUBLIC_KEY);
    });

    it("should_treat_a_lone_sourceAccount_key_as_options", async () => {
      const client = createCaatingaClient(createClientConfig());

      // A lone `{ sourceAccount }` object is indistinguishable from read options, so a
      // method argument with that name needs the two-argument form (see docs/client.md).
      const asOptions = await client
        .contract("counter")
        .simulate<string>("lookupAccount", { sourceAccount: OVERRIDE_READ_SOURCE_ACCOUNT });

      expect(asOptions.result).toBe("no-args");
      expect(lastClientInput?.publicKey).toBe(OVERRIDE_READ_SOURCE_ACCOUNT);

      const asArgs = await client
        .contract("counter")
        .simulate<string>("lookupAccount", { sourceAccount: "GARG" }, {});

      expect(asArgs.result).toBe("GARG");
      expect(lastClientInput?.publicKey).toBe(WALLET_PUBLIC_KEY);
    });
  });

  it("should_map_omitted_wallet_to_WALLET_NOT_CONNECTED_on_invoke", async () => {
    const config = createClientConfig();
    delete (config as { wallet?: unknown }).wallet;
    const client = createCaatingaClient(config);

    await expect(client.contract("counter").invoke("increment")).rejects.toMatchObject({
      code: CaatingaErrorCode.WALLET_NOT_CONNECTED,
    });
  });

  it("should_map_omitted_wallet_to_WALLET_NOT_CONNECTED_on_buildXdr", async () => {
    const config = createClientConfig();
    delete (config as { wallet?: unknown }).wallet;
    const client = createCaatingaClient(config);

    await expect(client.contract("counter").buildXdr("increment")).rejects.toMatchObject({
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

  it("should_report_failed_on_chain_transactions_with_diagnostics", async () => {
    const result = await createCaatingaClient(createClientConfig())
      .contract("counter")
      .invoke("failedLifecycle");

    expect(result).toMatchObject({
      status: "failed",
      transactionHash: "hash:failed",
      resultXdr: "AAAA_RESULT",
      diagnosticEvents: [{ type: "contract" }],
    });
  });

  it("should_report_pending_when_transaction_status_is_unresolved", async () => {
    const result = await createCaatingaClient(createClientConfig())
      .contract("counter")
      .invoke("pendingLifecycle");

    expect(result).toMatchObject({
      status: "pending",
      transactionHash: "hash:pending",
    });
  });

  it("should_throw_WALLET_NETWORK_MISMATCH_before_signing_when_wallet_is_on_another_network", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => "GPUBLIC"),
        signTransaction: vi.fn(async () => "AAAA_SIGNED"),
        getNetworkPassphrase: vi.fn(async () => "Public Global Stellar Network ; September 2015"),
      },
    });

    await expect(
      createCaatingaClient(config).contract("counter").invoke("increment")
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.WALLET_NETWORK_MISMATCH,
      hint: expect.stringContaining("Public Global Stellar Network"),
    });
    expect(config.wallet.getPublicKey).not.toHaveBeenCalled();
    expect(config.wallet.signTransaction).not.toHaveBeenCalled();
  });

  it("should_invoke_when_wallet_reports_the_app_network", async () => {
    const config = createClientConfig({
      wallet: {
        getPublicKey: vi.fn(async () => "GPUBLIC"),
        signTransaction: vi.fn(async () => "AAAA_SIGNED"),
        getNetworkPassphrase: vi.fn(async () => "Test SDF Network ; September 2015"),
      },
    });

    await expect(
      createCaatingaClient(config).contract("counter").invoke("increment")
    ).resolves.toMatchObject({ status: "confirmed" });
  });

  it("should_not_block_invoke_when_wallet_cannot_report_its_network", async () => {
    for (const getNetworkPassphrase of [
      vi.fn(async () => undefined),
      vi.fn(async () => {
        throw new Error("module does not support getNetwork");
      }),
    ]) {
      const config = createClientConfig({
        wallet: {
          getPublicKey: vi.fn(async () => "GPUBLIC"),
          signTransaction: vi.fn(async () => "AAAA_SIGNED"),
          getNetworkPassphrase,
        },
      });

      await expect(
        createCaatingaClient(config).contract("counter").invoke("increment")
      ).resolves.toMatchObject({ status: "confirmed" });
    }
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

  it("should_submit_the_prepared_transaction_returned_by_build_xdr", async () => {
    const originalSignAndSend = vi.fn(async () => {
      throw new Error("submitted original transaction");
    });
    const preparedSignAndSend = vi.fn(
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
        return { txHash: `hash:${signed.signedTxXdr}`, result: 11, status: "SUCCESS" };
      }
    );
    const prepare = vi.fn(async () => ({
      toXDR() {
        return "AAAA_PREPARED";
      },
      signAndSend: preparedSignAndSend,
    }));

    class Client {
      increment() {
        return {
          toXDR() {
            return "AAAA_UNSIGNED";
          },
          prepare,
          signAndSend: originalSignAndSend,
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

    expect(prepare).toHaveBeenCalledOnce();
    expect(originalSignAndSend).not.toHaveBeenCalled();
    expect(preparedSignAndSend).toHaveBeenCalledOnce();
    expect(config.wallet.signTransaction).toHaveBeenCalledWith({
      xdr: "AAAA_PREPARED",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    expect(result).toMatchObject({
      status: "confirmed",
      transactionHash: "hash:AAAA_SIGNED",
      result: 11,
      xdr: {
        unsigned: "AAAA_UNSIGNED",
        prepared: "AAAA_PREPARED",
        signed: "AAAA_SIGNED",
      },
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
        return { txHash: `hash:${signed.signedTxXdr}`, result: 7, status: "SUCCESS" };
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
        return {
          sendTransactionResponse: { hash: "hash:nested" },
          getTransactionResponse: { status: "SUCCESS" },
          result: 9,
        };
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
    const send = vi.fn(async () => ({ txHash: "hash:send", result: 3, status: "SUCCESS" }));

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

describe("read source accounts against @stellar/stellar-sdk", () => {
  const readSpec = new Spec([
    StellarXdr.ScSpecEntry.scSpecEntryFunctionV0(
      new StellarXdr.ScSpecFunctionV0({
        doc: "",
        name: "get",
        inputs: [],
        outputs: [StellarXdr.ScSpecTypeDef.scSpecTypeU32()],
      })
    ),
  ]);

  const rpcCalls: Array<["getAccount", string] | ["simulateTransaction", string]> = [];

  const rpcServer = {
    getAccount: async (id: string) => {
      rpcCalls.push(["getAccount", id]);
      return new Account(id, "1");
    },
    simulateTransaction: async (transaction: { source: string }) => {
      rpcCalls.push(["simulateTransaction", transaction.source]);
      return {
        _parsed: true,
        latestLedger: 1,
        events: [],
        transactionData: new SorobanDataBuilder(),
        minResourceFee: "100",
        result: { auth: [], retval: StellarXdr.ScVal.scvU32(42) },
      };
    },
  };

  class StellarReadClient extends StellarContractClient {
    constructor(options: {
      contractId: string;
      publicKey?: string;
      rpcUrl: string;
      networkPassphrase: string;
    }) {
      super(readSpec, { ...options, server: rpcServer as never });
    }
  }

  function createSdkClient(overrides: Record<string, unknown> = {}) {
    rpcCalls.length = 0;
    return createCaatingaClient(
      createClientConfig({
        ...overrides,
        contracts: {
          counter: {
            binding: { Client: StellarReadClient },
            contractId: REAL_CONTRACT_ID,
          },
        },
      })
    );
  }

  it("should_build_a_wallet_less_read_from_NULL_ACCOUNT_without_getAccount", async () => {
    const client = createSdkClient({ wallet: undefined });

    await expect(client.contract("counter").read<number>("get")).resolves.toBe(42);
    // The SDK simulates while assembling the transaction, and Caatinga calls `simulate()` again
    // because the generated binding has no `prepare()`. Neither lookup hits the RPC account.
    expect(rpcCalls.filter(([method]) => method === "getAccount")).toEqual([]);
    expect(rpcCalls.filter(([method]) => method === "simulateTransaction")).toEqual([
      ["simulateTransaction", NULL_ACCOUNT],
      ["simulateTransaction", NULL_ACCOUNT],
    ]);
  });

  it("should_load_a_configured_read_source_with_getAccount", async () => {
    const client = createSdkClient({
      wallet: undefined,
      readSourceAccount: READ_SOURCE_ACCOUNT,
    });

    await expect(client.contract("counter").read<number>("get")).resolves.toBe(42);
    expect(rpcCalls).toEqual([
      ["getAccount", READ_SOURCE_ACCOUNT],
      ["simulateTransaction", READ_SOURCE_ACCOUNT],
      ["simulateTransaction", READ_SOURCE_ACCOUNT],
    ]);
  });

  it("should_load_the_wallet_public_key_with_getAccount", async () => {
    const walletKey = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(9));
    const client = createSdkClient({
      wallet: {
        getPublicKey: vi.fn(async () => walletKey),
        signTransaction: vi.fn(async () => "AAAA_SIGNED"),
      },
    });

    await expect(client.contract("counter").read<number>("get")).resolves.toBe(42);
    expect(rpcCalls).toEqual([
      ["getAccount", walletKey],
      ["simulateTransaction", walletKey],
      ["simulateTransaction", walletKey],
    ]);
  });
});
