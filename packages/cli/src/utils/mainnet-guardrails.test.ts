import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "@caatinga/core";
import { confirmMainnetOperation } from "./mainnet-guardrails.js";

const mockQuestion = vi.fn();
vi.mock("node:readline/promises", () => ({
  default: {
    createInterface: () => ({
      question: mockQuestion,
      close: () => {},
    }),
  },
}));

describe("confirmMainnetOperation", () => {
  const originalEnv = process.env.CAATINGA_ASSUME_YES;
  const mainnetConfig = {
    rpcUrl: "https://mainnet.sorobanrpc.com",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  };
  const testnetConfig = {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  };

  beforeEach(() => {
    delete process.env.CAATINGA_ASSUME_YES;
    mockQuestion.mockReset();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CAATINGA_ASSUME_YES = originalEnv;
    } else {
      delete process.env.CAATINGA_ASSUME_YES;
    }
  });

  it("should_pass_immediately_for_non_mainnet_networks", async () => {
    await expect(
      confirmMainnetOperation({
        operation: "deploy",
        networkName: "testnet",
        networkConfig: testnetConfig,
      })
    ).resolves.toBeUndefined();
  });

  it("should_pass_when_yes_option_is_true", async () => {
    await expect(
      confirmMainnetOperation({
        operation: "deploy",
        networkName: "mainnet",
        networkConfig: mainnetConfig,
        yes: true,
      })
    ).resolves.toBeUndefined();
  });

  it("should_pass_when_CAATINGA_ASSUME_YES_env_var_is_set", async () => {
    process.env.CAATINGA_ASSUME_YES = "true";
    await expect(
      confirmMainnetOperation({
        operation: "upgrade",
        networkName: "mainnet",
        networkConfig: mainnetConfig,
      })
    ).resolves.toBeUndefined();
  });

  it("should_throw_in_non_interactive_mode_when_not_confirmed", async () => {
    // In vitest environment, isTTY is false by default.
    await expect(
      confirmMainnetOperation({
        operation: "deploy",
        networkName: "mainnet",
        networkConfig: mainnetConfig,
      })
    ).rejects.toMatchObject({
      code: CaatingaErrorCode.MAINNET_CONFIRMATION_REQUIRED,
    });
  });
});
