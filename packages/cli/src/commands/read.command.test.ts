import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { CaatingaConfig } from "@caatinga/core";
import { readContract } from "@caatinga/core";
import { registerReadCommand } from "./read.command.js";

const readContractMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    readContract: readContractMock,
    loadConfig: loadConfigMock
  };
});

const config: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {
    app: {
      path: "./contracts/app",
      wasm: "./contracts/app/target/wasm32v1-none/release/app.wasm",
      dependsOn: [],
      deployArgs: {}
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  }
};

function createReadProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerReadCommand(program);
  return program;
}

describe("read command", () => {
  beforeEach(() => {
    readContractMock.mockReset();
    loadConfigMock.mockReset();
    loadConfigMock.mockResolvedValue(config);
    readContractMock.mockResolvedValue({
      network: { name: "testnet" },
      target: { contractName: "app", method: "version" },
      result: "1\n"
    });
  });

  it("delegates to readContract with --send=no semantics in core", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createReadProgram().parseAsync(["node", "caatinga", "read", "app.version", "--network", "testnet"]);

      expect(readContract).toHaveBeenCalledWith({
        config,
        target: "app.version",
        args: [],
        networkName: "testnet",
        source: undefined
      });
      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Read complete");
      expect(output).toContain("1");
    } finally {
      logSpy.mockRestore();
    }
  });
});
