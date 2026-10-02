import { Command } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerWireCommand } from "./wire.command.js";

const runPostDeployHooksMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: loadConfigMock,
    runPostDeployHooks: runPostDeployHooksMock,
  };
});

const baseConfig = {
  project: "stellar-album",
  defaultNetwork: "testnet",
  contracts: { coin: { path: "./c", wasm: "./c.wasm" } },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
};

describe("wire command", () => {
  beforeEach(() => {
    runPostDeployHooksMock.mockReset();
    loadConfigMock.mockReset();
  });

  it("runs_when_only_postDeployRead_hooks_are_configured", async () => {
    loadConfigMock.mockResolvedValue({
      ...baseConfig,
      postDeployRead: [{ contract: "coin", method: "minter", args: {}, kind: "read" }],
    });
    runPostDeployHooksMock.mockResolvedValue([{ contract: "coin", method: "minter" }]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const program = new Command();
      registerWireCommand(program);

      await program.parseAsync(["node", "caatinga", "wire", "--source", "deployer"]);

      expect(runPostDeployHooksMock).toHaveBeenCalledTimes(1);
      const logOutput = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(logOutput).toContain("Wire complete");
      expect(logOutput).not.toContain("No postDeploy");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("skips_when_no_hooks_are_configured", async () => {
    loadConfigMock.mockResolvedValue({ ...baseConfig, postDeploy: [], postDeployRead: [] });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const program = new Command();
      registerWireCommand(program);

      await program.parseAsync(["node", "caatinga", "wire", "--source", "deployer"]);

      expect(runPostDeployHooksMock).not.toHaveBeenCalled();
      const logOutput = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(logOutput).toContain("No postDeploy or postDeployRead hooks configured");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("delegates to runPostDeployHooks", async () => {
    loadConfigMock.mockResolvedValue({
      project: "stellar-album",
      defaultNetwork: "testnet",
      contracts: { coin: { path: "./c", wasm: "./c.wasm" } },
      networks: {
        testnet: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      },
      postDeploy: [{ contract: "coin", method: "set_minter", args: {}, kind: "invoke" }],
    });
    runPostDeployHooksMock.mockResolvedValue([{ contract: "coin", method: "set_minter" }]);

    const program = new Command();
    registerWireCommand(program);

    await program.parseAsync(["node", "caatinga", "wire", "--source", "deployer"]);

    expect(runPostDeployHooksMock).toHaveBeenCalledWith({
      config: expect.objectContaining({ project: "stellar-album" }),
      networkName: undefined,
      source: "deployer",
      onTransientHookRetry: expect.any(Function),
    });
  });

  it("logs transient retry warnings", async () => {
    loadConfigMock.mockResolvedValue({
      project: "stellar-album",
      defaultNetwork: "testnet",
      contracts: { coin: { path: "./c", wasm: "./c.wasm" } },
      networks: {
        testnet: {
          rpcUrl: "https://soroban-testnet.stellar.org",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      },
      postDeploy: [{ contract: "coin", method: "set_minter", args: {}, kind: "invoke" }],
    });
    runPostDeployHooksMock.mockImplementation(async ({ onTransientHookRetry }) => {
      onTransientHookRetry({
        hook: { contract: "coin", method: "set_minter" },
        attempt: 1,
        maxAttempts: 3,
        delayMs: 5000,
      });
      return [{ contract: "coin", method: "set_minter" }];
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const program = new Command();
      registerWireCommand(program);

      await program.parseAsync(["node", "caatinga", "wire", "--source", "deployer"]);

      expect(runPostDeployHooksMock).toHaveBeenCalledWith({
        config: expect.objectContaining({ project: "stellar-album" }),
        networkName: undefined,
        source: "deployer",
        onTransientHookRetry: expect.any(Function),
      });

      const warnOutput = warnSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(warnOutput).toContain("Post-deploy hook coin.set_minter");
      expect(warnOutput).toContain("Retrying in 5s");
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
