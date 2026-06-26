import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
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

describe("wire command", () => {
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
      postDeploy: [{ contract: "coin", method: "set_minter", args: {} }],
    });
    runPostDeployHooksMock.mockResolvedValue([{ contract: "coin", method: "set_minter" }]);

    const program = new Command();
    registerWireCommand(program);

    await program.parseAsync(["node", "caatinga", "wire", "--source", "deployer"]);

    expect(runPostDeployHooksMock).toHaveBeenCalledWith({
      config: expect.objectContaining({ project: "stellar-album" }),
      networkName: undefined,
      source: "deployer",
    });
  });
});
