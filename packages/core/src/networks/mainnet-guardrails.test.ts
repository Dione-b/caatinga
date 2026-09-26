import { describe, expect, it } from "vitest";
import { isMainnetNetwork, requiresMainnetConfirmation } from "./mainnet-guardrails.js";

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

describe("mainnet-guardrails", () => {
  const testnetConfig = {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: TESTNET_PASSPHRASE,
  };

  const mainnetConfig = {
    rpcUrl: "https://mainnet.sorobanrpc.com",
    networkPassphrase: MAINNET_PASSPHRASE,
  };

  describe("isMainnetNetwork", () => {
    it("should_identify_mainnet_by_name_or_passphrase", () => {
      expect(isMainnetNetwork("mainnet", testnetConfig)).toBe(true);
      expect(isMainnetNetwork("custom-main", mainnetConfig)).toBe(true);
      expect(isMainnetNetwork("testnet", testnetConfig)).toBe(false);
    });
  });

  describe("requiresMainnetConfirmation — mainnet always fails closed", () => {
    it("should_require_confirmation_for_mainnet_by_default", () => {
      expect(requiresMainnetConfirmation("mainnet", testnetConfig)).toBe(true);
      expect(requiresMainnetConfirmation("prod", mainnetConfig)).toBe(true);
      expect(requiresMainnetConfirmation("testnet", testnetConfig)).toBe(false);
    });

    it("should_ignore_requireConfirmation_false_on_mainnet", () => {
      // B18 regression: a testnet config copied to mainnet with
      // requireConfirmation: false must not disable the guardrail.
      expect(
        requiresMainnetConfirmation("mainnet", { ...mainnetConfig, requireConfirmation: false })
      ).toBe(true);
      expect(
        requiresMainnetConfirmation("prod", { ...mainnetConfig, requireConfirmation: false })
      ).toBe(true);
      // By passphrase only — name is not literally "mainnet".
      expect(
        requiresMainnetConfirmation("custom", { ...mainnetConfig, requireConfirmation: false })
      ).toBe(true);
    });

    it("should_require_confirmation_on_mainnet_when_requireConfirmation_is_true", () => {
      expect(
        requiresMainnetConfirmation("mainnet", { ...mainnetConfig, requireConfirmation: true })
      ).toBe(true);
    });
  });

  describe("requiresMainnetConfirmation — non-mainnet honours requireConfirmation", () => {
    it("should_only_require_confirmation_when_requireConfirmation_is_true", () => {
      expect(
        requiresMainnetConfirmation("testnet", { ...testnetConfig, requireConfirmation: true })
      ).toBe(true);
      expect(
        requiresMainnetConfirmation("testnet", { ...testnetConfig, requireConfirmation: false })
      ).toBe(false);
      // Undefined → not required on non-mainnet.
      expect(requiresMainnetConfirmation("testnet", testnetConfig)).toBe(false);
    });
  });

  describe("isMainnetNetwork — independence from confirmation", () => {
    it("should_keep_isMainnetNetwork_true_when_requireConfirmation_is_false", () => {
      const optOutMainnet = { ...mainnetConfig, requireConfirmation: false };
      expect(isMainnetNetwork("mainnet", optOutMainnet)).toBe(true);
      // B18: the network is still mainnet, and confirmation is still required.
      expect(requiresMainnetConfirmation("mainnet", optOutMainnet)).toBe(true);
    });
  });
});
