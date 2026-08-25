import { describe, expect, it } from "vitest";
import { isMainnetNetwork, requiresMainnetConfirmation } from "./mainnet-guardrails.js";

describe("mainnet-guardrails", () => {
  const testnetConfig = {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  };

  const mainnetConfig = {
    rpcUrl: "https://mainnet.sorobanrpc.com",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  };

  it("should_identify_mainnet_by_name_or_passphrase", () => {
    expect(isMainnetNetwork("mainnet", testnetConfig)).toBe(true);
    expect(isMainnetNetwork("custom-main", mainnetConfig)).toBe(true);
    expect(isMainnetNetwork("testnet", testnetConfig)).toBe(false);
  });

  it("should_require_confirmation_for_mainnet_by_default", () => {
    expect(requiresMainnetConfirmation("mainnet", testnetConfig)).toBe(true);
    expect(requiresMainnetConfirmation("prod", mainnetConfig)).toBe(true);
    expect(requiresMainnetConfirmation("testnet", testnetConfig)).toBe(false);
  });

  it("should_respect_requireConfirmation_config_knob", () => {
    expect(
      requiresMainnetConfirmation("testnet", { ...testnetConfig, requireConfirmation: true })
    ).toBe(true);
    expect(
      requiresMainnetConfirmation("mainnet", { ...mainnetConfig, requireConfirmation: false })
    ).toBe(false);
  });
});
