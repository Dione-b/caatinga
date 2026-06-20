import { describe, expect, it, vi } from "vitest";
import {
  decimalSaltToHex,
  fetchCreateContractSalt,
  isLikelyPublicKeySource,
  tryRecoverContractIdFromDeployFailure,
} from "./recover-deploy-contract-id.js";

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
});
