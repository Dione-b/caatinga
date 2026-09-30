import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "@caatinga/core/browser";

const mocks = vi.hoisted(() => ({
  getAddress: vi.fn(),
  signTransaction: vi.fn(),
  getNetworkDetails: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => mocks);

import { freighterWalletAdapter } from "./freighter.js";

/** freighter-api v4 reports failures as `{ error }` in a resolved response (#231). */
describe("freighterWalletAdapter", () => {
  const passphrase = "Test SDF Network ; September 2015";

  beforeEach(() => {
    mocks.getAddress.mockReset();
    mocks.signTransaction.mockReset();
    mocks.getNetworkDetails.mockReset();
  });

  it("should_report_freighters_network_passphrase", async () => {
    mocks.getNetworkDetails.mockResolvedValue({
      network: "PUBLIC",
      networkUrl: "https://horizon.stellar.org",
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    });

    await expect(freighterWalletAdapter.getNetworkPassphrase?.()).resolves.toBe(
      "Public Global Stellar Network ; September 2015"
    );
  });

  it("should_report_an_unknown_network_when_freighter_returns_an_error", async () => {
    mocks.getNetworkDetails.mockResolvedValue({
      network: "",
      networkUrl: "",
      networkPassphrase: "",
      error: { code: -1, message: "Freighter is locked" },
    });

    await expect(freighterWalletAdapter.getNetworkPassphrase?.()).resolves.toBeUndefined();
  });

  it("should_return_the_address_when_freighter_grants_access", async () => {
    mocks.getAddress.mockResolvedValue({ address: "GABC" });

    await expect(freighterWalletAdapter.getPublicKey()).resolves.toBe("GABC");
  });

  it("should_throw_WALLET_NOT_CONNECTED_when_freighter_returns_an_error", async () => {
    mocks.getAddress.mockResolvedValue({
      address: "",
      error: { code: -4, message: "The user rejected this request." },
    });

    await expect(freighterWalletAdapter.getPublicKey()).rejects.toMatchObject({
      code: CaatingaErrorCode.WALLET_NOT_CONNECTED,
      message: expect.stringContaining("The user rejected this request."),
    });
  });

  it("should_throw_WALLET_NOT_CONNECTED_for_an_empty_address_without_error", async () => {
    mocks.getAddress.mockResolvedValue({ address: "" });

    await expect(freighterWalletAdapter.getPublicKey()).rejects.toMatchObject({
      code: CaatingaErrorCode.WALLET_NOT_CONNECTED,
    });
  });

  it("should_return_the_signed_xdr_and_forward_the_network_passphrase", async () => {
    mocks.signTransaction.mockResolvedValue({ signedTxXdr: "SIGNED", signerAddress: "GABC" });

    await expect(
      freighterWalletAdapter.signTransaction({ xdr: "UNSIGNED", networkPassphrase: passphrase })
    ).resolves.toBe("SIGNED");
    expect(mocks.signTransaction).toHaveBeenCalledWith("UNSIGNED", {
      networkPassphrase: passphrase,
    });
  });

  it("should_throw_XDR_SIGN_FAILED_with_freighters_message_when_signing_fails", async () => {
    mocks.signTransaction.mockResolvedValue({
      signedTxXdr: "",
      signerAddress: "",
      error: { code: -4, message: "The user rejected this request." },
    });

    await expect(
      freighterWalletAdapter.signTransaction({ xdr: "UNSIGNED", networkPassphrase: passphrase })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.XDR_SIGN_FAILED,
      message: expect.stringContaining("The user rejected this request."),
    });
  });
});
