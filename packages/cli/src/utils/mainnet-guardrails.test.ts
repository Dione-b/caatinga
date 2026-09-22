import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaErrorCode } from "@caatinga/core";
import { confirmMainnetOperation } from "./mainnet-guardrails.js";
import { logger } from "./logger.js";

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

  it("should_not_resolve_target_details_when_bypassed_with_yes", async () => {
    const resolveTargetDetails = vi.fn().mockResolvedValue({});

    await confirmMainnetOperation({
      operation: "upgrade",
      networkName: "mainnet",
      networkConfig: mainnetConfig,
      contractName: "token",
      yes: true,
      resolveTargetDetails,
    });

    expect(resolveTargetDetails).not.toHaveBeenCalled();
  });

  it("should_show_the_deployed_contract_id_and_wasm_hash_in_the_banner", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const originalIsTTY = { input: process.stdin.isTTY, output: process.stdout.isTTY };
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    mockQuestion.mockResolvedValue("y");

    try {
      await confirmMainnetOperation({
        operation: "upgrade",
        networkName: "mainnet",
        networkConfig: mainnetConfig,
        contractName: "token",
        resolveTargetDetails: async () => ({
          contractId: "CAJSNRSGL5BIS67LTVLFCZC6KITVRPA7YEO7YGUOBVJETMI3TONYYERP",
          deployedWasmHash: "abc123",
        }),
      });

      const banner = infoSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(banner).toContain("CAJSNRSGL5BIS67LTVLFCZC6KITVRPA7YEO7YGUOBVJETMI3TONYYERP");
      expect(banner).toContain("abc123");
      expect(banner).toContain("will be replaced");
    } finally {
      infoSpy.mockRestore();
      process.stdin.isTTY = originalIsTTY.input;
      process.stdout.isTTY = originalIsTTY.output;
    }
  });

  it("should_not_fail_when_target_detail_resolution_throws", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const originalIsTTY = { input: process.stdin.isTTY, output: process.stdout.isTTY };
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    mockQuestion.mockResolvedValue("y");

    try {
      await expect(
        confirmMainnetOperation({
          operation: "deploy",
          networkName: "mainnet",
          networkConfig: mainnetConfig,
          contractName: "token",
          resolveTargetDetails: async () => {
            throw new Error("caatinga.artifacts.json was not found.");
          },
        })
      ).resolves.toBeUndefined();
    } finally {
      infoSpy.mockRestore();
      process.stdin.isTTY = originalIsTTY.input;
      process.stdout.isTTY = originalIsTTY.output;
    }
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
