import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  const originalAssumeYes = process.env.CAATINGA_ASSUME_YES;

  beforeEach(() => {
    delete process.env.CAATINGA_ASSUME_YES;
  });

  afterEach(() => {
    if (originalAssumeYes === undefined) {
      delete process.env.CAATINGA_ASSUME_YES;
    } else {
      process.env.CAATINGA_ASSUME_YES = originalAssumeYes;
    }
  });

  describe("isMainnetNetwork", () => {
    it("should_identify_mainnet_by_name_or_passphrase", () => {
      expect(isMainnetNetwork("mainnet", testnetConfig)).toBe(true);
      expect(isMainnetNetwork("custom-main", mainnetConfig)).toBe(true);
      expect(isMainnetNetwork("testnet", testnetConfig)).toBe(false);
    });
  });

  describe("requiresMainnetConfirmation — mainnet fail-closed", () => {
    it("should_require_confirmation_for_mainnet_by_default", () => {
      expect(requiresMainnetConfirmation("mainnet", testnetConfig)).toBe(true);
      expect(requiresMainnetConfirmation("prod", mainnetConfig)).toBe(true);
      expect(requiresMainnetConfirmation("testnet", testnetConfig)).toBe(false);
    });

    it("should_ignore_requireConfirmation_false_on_mainnet_when_assume_yes_unset", () => {
      // B18: a testnet config copied to mainnet must NOT silently disable the prompt.
      expect(
        requiresMainnetConfirmation("mainnet", { ...mainnetConfig, requireConfirmation: false })
      ).toBe(true);
      expect(
        requiresMainnetConfirmation("prod", { ...mainnetConfig, requireConfirmation: false })
      ).toBe(true);
      // Also by passphrase, even if the name is not literally "mainnet".
      expect(
        requiresMainnetConfirmation("custom", { ...mainnetConfig, requireConfirmation: false })
      ).toBe(true);
    });

    it("should_honour_requireConfirmation_false_on_mainnet_only_when_assume_yes_is_set", () => {
      process.env.CAATINGA_ASSUME_YES = "true";
      expect(
        requiresMainnetConfirmation("mainnet", { ...mainnetConfig, requireConfirmation: false })
      ).toBe(false);
    });

    it("should_keep_requiring_confirmation_on_mainnet_when_assume_yes_is_falsey", () => {
      for (const value of ["false", "0", "no", "n", "", "  ", "random"]) {
        process.env.CAATINGA_ASSUME_YES = value;
        expect(
          requiresMainnetConfirmation("mainnet", { ...mainnetConfig, requireConfirmation: false }),
          `CAATINGA_ASSUME_YES="${value}" must fail closed`
        ).toBe(true);
      }
    });

    it("should_accept_truthy_CAATINGA_ASSUME_YES_values_case_insensitively", () => {
      for (const value of ["true", "TRUE", "True", "1", "yes", "YES", "Y", " y "]) {
        process.env.CAATINGA_ASSUME_YES = value;
        expect(
          requiresMainnetConfirmation("mainnet", { ...mainnetConfig, requireConfirmation: false }),
          `CAATINGA_ASSUME_YES="${value}" must opt out`
        ).toBe(false);
      }
    });
  });

  describe("requiresMainnetConfirmation — non-mainnet honours config", () => {
    it("should_respect_requireConfirmation_config_knob_on_testnet", () => {
      expect(
        requiresMainnetConfirmation("testnet", { ...testnetConfig, requireConfirmation: true })
      ).toBe(true);
      expect(
        requiresMainnetConfirmation("testnet", { ...testnetConfig, requireConfirmation: false })
      ).toBe(false);
      expect(requiresMainnetConfirmation("testnet", testnetConfig)).toBe(false);
    });

    it("should_ignore_CAATINGA_ASSUME_YES_on_testnet", () => {
      process.env.CAATINGA_ASSUME_YES = "true";
      expect(
        requiresMainnetConfirmation("testnet", { ...testnetConfig, requireConfirmation: true })
      ).toBe(true);
      expect(
        requiresMainnetConfirmation("testnet", { ...testnetConfig, requireConfirmation: false })
      ).toBe(false);
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
