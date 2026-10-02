import { describe, expect, it, vi } from "vitest";
import {
  HORIZON_RECOVERY_TIMEOUT_MS,
  decimalSaltToHex,
  fetchCreateContractSalt,
  isLikelyPublicKeySource,
  resolveHorizonUrl,
  tryRecoverContractIdFromDeployFailure,
} from "./recover-deploy-contract-id.js";
import { STELLAR_CLI_SIGNING_FAILURE_REGEX } from "./version.js";

const runCommandMock = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand: runCommandMock,
}));

describe("recover deploy contract id", () => {
  it("should_detect_public_key_sources", () => {
    expect(
      isLikelyPublicKeySource("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF")
    ).toBe(true);
    expect(isLikelyPublicKeySource("alice")).toBe(false);
  });

  it("should_convert_decimal_salt_to_hex", () => {
    expect(
      decimalSaltToHex(
        "36760584017419743124423536061373365464991553746983011352231996661702535035363"
      )
    ).toBe("5145c0d3671aa4c41fa2615b64030e9be5cddb08411ce792bf568ef51f1239e3");
  });

  it("should_throw_when_the_salt_is_not_a_decimal_integer", () => {
    expect(() => decimalSaltToHex("not-a-salt")).toThrow(SyntaxError);
  });

  it("should_fetch_create_contract_salt_from_horizon", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              transaction_successful: true,
              type: "invoke_host_function",
              function: "HostFunctionTypeHostFunctionTypeCreateContract",
              salt: "36760584017419743124423536061373365464991553746983011352231996661702535035363",
            },
          ],
        },
      }),
    });

    await expect(
      fetchCreateContractSalt(
        "https://horizon-testnet.stellar.org",
        "9fd39d640ef3bae443d2b2748aa3f2ca43bb8261a9d5b8a8fa07fc3c0c1c85d6",
        fetchImpl
      )
    ).resolves.toBe(
      "36760584017419743124423536061373365464991553746983011352231996661702535035363"
    );
  });

  it("should_recover_contract_id_after_stellar_signing_failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              transaction_successful: true,
              type: "invoke_host_function",
              function: "HostFunctionTypeHostFunctionTypeCreateContract",
              salt: "36760584017419743124423536061373365464991553746983011352231996661702535035363",
            },
          ],
        },
      }),
    });

    runCommandMock.mockResolvedValue({
      stdout: "CBSUOUQOC4XKDYXBPS73PACWGPPNETMHXL5MZVM5BRTTRKKCPBOMY7S2\n",
      stderr: "",
      all: "CBSUOUQOC4XKDYXBPS73PACWGPPNETMHXL5MZVM5BRTTRKKCPBOMY7S2\n",
    });

    const contractId = await tryRecoverContractIdFromDeployFailure({
      output: [
        "Transaction hash is 9fd39d640ef3bae443d2b2748aa3f2ca43bb8261a9d5b8a8fa07fc3c0c1c85d6",
        "error: xdr processing error: xdr value invalid",
      ].join("\n"),
      source: "alice",
      network: {
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
      },
      fetchImpl,
    });

    expect(contractId).toBe("CBSUOUQOC4XKDYXBPS73PACWGPPNETMHXL5MZVM5BRTTRKKCPBOMY7S2");
    expect(runCommandMock).toHaveBeenCalledWith(
      "stellar",
      expect.arrayContaining([
        "contract",
        "id",
        "wasm",
        "--salt",
        "5145c0d3671aa4c41fa2615b64030e9be5cddb08411ce792bf568ef51f1239e3",
      ]),
      expect.any(Object)
    );
  });

  it("should_resolve_horizon_url_for_known_networks", () => {
    expect(
      resolveHorizonUrl({
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
      })
    ).toBe("https://horizon-testnet.stellar.org");

    expect(
      resolveHorizonUrl({
        rpcUrl: "https://mainnet.sorobanrpc.com",
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      })
    ).toBe("https://horizon.stellar.org");
  });

  it("should_return_null_for_custom_or_unknown_network_passphrases", () => {
    expect(
      resolveHorizonUrl({
        rpcUrl: "http://localhost:8000/rpc",
        networkPassphrase: "Custom Standalone Network ; 2026",
      })
    ).toBeNull();
  });

  it("should_return_null_for_networks_without_horizon", () => {
    expect(
      resolveHorizonUrl({
        rpcUrl: "https://rpc-futurenet.stellar.org",
        networkPassphrase: "Test SDF Future Network ; October 2022",
      })
    ).toBeNull();
  });

  it("should_return_null_when_recovering_on_custom_network_without_throwing", async () => {
    const contractId = await tryRecoverContractIdFromDeployFailure({
      output: [
        "Transaction hash is 9fd39d640ef3bae443d2b2748aa3f2ca43bb8261a9d5b8a8fa07fc3c0c1c85d6",
        "error: xdr processing error: xdr value invalid",
      ].join("\n"),
      source: "alice",
      network: {
        rpcUrl: "http://localhost:8000/rpc",
        networkPassphrase: "Custom Standalone Network ; 2026",
      },
    });

    expect(contractId).toBeNull();
  });

  it("should_return_null_when_contract_id_resolution_fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              transaction_successful: true,
              type: "invoke_host_function",
              function: "HostFunctionTypeHostFunctionTypeCreateContract",
              salt: "36760584017419743124423536061373365464991553746983011352231996661702535035363",
            },
          ],
        },
      }),
    });

    runCommandMock.mockRejectedValue(new Error("stellar command failed"));

    const contractId = await tryRecoverContractIdFromDeployFailure({
      output: [
        "Transaction hash is 9fd39d640ef3bae443d2b2748aa3f2ca43bb8261a9d5b8a8fa07fc3c0c1c85d6",
        "error: xdr processing error: xdr value invalid",
      ].join("\n"),
      source: "alice",
      network: {
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: "Test SDF Network ; September 2015",
      },
      fetchImpl,
    });

    expect(contractId).toBeNull();
  });

  it("should_return_null_when_the_horizon_salt_is_malformed", async () => {
    runCommandMock.mockReset();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            {
              transaction_successful: true,
              type: "invoke_host_function",
              function: "HostFunctionTypeHostFunctionTypeCreateContract",
              salt: "not-a-salt",
            },
          ],
        },
      }),
    });

    await expect(
      tryRecoverContractIdFromDeployFailure({
        output: [
          "Transaction hash is 9fd39d640ef3bae443d2b2748aa3f2ca43bb8261a9d5b8a8fa07fc3c0c1c85d6",
          "error: xdr processing error: xdr value invalid",
        ].join("\n"),
        source: "alice",
        network: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
        fetchImpl,
      })
    ).resolves.toBeNull();
    expect(runCommandMock).not.toHaveBeenCalled();
  });
});

describe("horizon recovery timeout", () => {
  const HORIZON_URL = "https://horizon-testnet.stellar.org";
  const TX_HASH = "9fd39d640ef3bae443d2b2748aa3f2ca43bb8261a9d5b8a8fa07fc3c0c1c85d6";

  /** Never settles on its own — only the abort signal can end it. */
  const hangingFetch = () =>
    vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason ?? new Error("aborted"));
          });
        })
    ) as unknown as typeof fetch;

  it("should_expose_a_positive_default_timeout", () => {
    expect(HORIZON_RECOVERY_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("should_pass_an_abort_signal_to_the_horizon_fetch", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });

    await fetchCreateContractSalt(HORIZON_URL, TX_HASH, fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith(
      `${HORIZON_URL}/transactions/${TX_HASH}/operations`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("should_return_null_when_the_horizon_fetch_times_out", async () => {
    await expect(
      fetchCreateContractSalt(HORIZON_URL, TX_HASH, hangingFetch(), 10)
    ).resolves.toBeNull();
  });

  it("should_return_null_when_horizon_returns_unparseable_json", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON at position 0");
      },
    });

    await expect(
      fetchCreateContractSalt(HORIZON_URL, TX_HASH, fetchImpl as unknown as typeof fetch)
    ).resolves.toBeNull();
  });

  it("should_not_hang_or_throw_when_recovery_times_out_after_a_failed_deploy", async () => {
    await expect(
      tryRecoverContractIdFromDeployFailure({
        output: [
          `Transaction hash is ${TX_HASH}`,
          "error: xdr processing error: xdr value invalid",
        ].join("\n"),
        source: "alice",
        network: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
        fetchImpl: hangingFetch(),
        horizonTimeoutMs: 10,
      })
    ).resolves.toBeNull();
  });
});

describe("STELLAR_CLI_SIGNING_FAILURE_REGEX", () => {
  it("should_match_the_signing_failure_both_the_invoke_and_recovery_paths_key_off", () => {
    expect(
      STELLAR_CLI_SIGNING_FAILURE_REGEX.test("error: xdr processing error: xdr value invalid")
    ).toBe(true);
  });

  it("should_not_match_unrelated_stellar_cli_failures", () => {
    expect(STELLAR_CLI_SIGNING_FAILURE_REGEX.test("error: simulation failed")).toBe(false);
  });
});
