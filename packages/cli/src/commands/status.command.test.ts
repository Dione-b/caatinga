import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { CaatingaConfig, ProjectStatus } from "@caatinga/core";
import { collectProjectStatus } from "@caatinga/core";
import { registerStatusCommand } from "./status.command.js";

const collectProjectStatusMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    collectProjectStatus: collectProjectStatusMock,
    loadConfig: loadConfigMock,
  };
});

const CONTRACT_ID = `C${"2".repeat(55)}`;

const config: CaatingaConfig = {
  project: "counter-app",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./rel/counter.wasm",
      dependsOn: [],
      deployArgs: {},
    },
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  frontend: { framework: "vite-react", bindingsOutput: "./src/gen" },
};

const status: ProjectStatus = {
  project: "counter-app",
  networks: [
    {
      network: "testnet",
      contracts: [
        {
          name: "counter",
          deployed: true,
          contractId: CONTRACT_ID,
          wasmHash: "abcdef1234567890",
          deployedAt: "2026-06-11T12:00:00.000Z",
          dependencies: [],
          bindings: {
            contractName: "counter",
            status: "stale",
            outputDir: "/tmp/counter",
            marker: null,
            reason: "wasmHash changed since last generate",
          },
        },
        {
          name: "token",
          deployed: false,
          dependencies: ["counter"],
          bindings: {
            contractName: "token",
            status: "missing",
            outputDir: "/tmp/token",
            marker: null,
            reason: 'not deployed on "testnet"',
          },
        },
      ],
    },
  ],
};

function createStatusProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerStatusCommand(program);
  return program;
}

describe("status command", () => {
  beforeEach(() => {
    collectProjectStatusMock.mockReset();
    loadConfigMock.mockReset();
    loadConfigMock.mockResolvedValue(config);
    collectProjectStatusMock.mockResolvedValue(status);
  });

  it("renders the per-network table with shortened ids and freshness", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await createStatusProgram().parseAsync(["node", "caatinga", "status"]);

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Project: counter-app");
      expect(output).toContain("Network: testnet");
      expect(output).toContain("CONTRACT");
      expect(output).toContain("BINDINGS");
      expect(output).toContain(`C${"2".repeat(4)}…${"2".repeat(4)}`);
      expect(output).toContain("abcdef12");
      expect(output).toContain("stale");
      expect(output).toContain("✗");

      const warnings = warnSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(warnings).toContain("npx caatinga generate counter --network testnet");
      expect(warnings).not.toContain("token");
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("passes the network filter through to the collector", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createStatusProgram().parseAsync([
        "node",
        "caatinga",
        "status",
        "--network",
        "testnet",
      ]);

      expect(collectProjectStatus).toHaveBeenCalledWith({
        config,
        networkName: "testnet",
      });
    } finally {
      logSpy.mockRestore();
    }
  });

  it("exits_with_code_1_when_strict_and_deployed_bindings_are_stale", async () => {
    process.exitCode = undefined;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      await createStatusProgram().parseAsync(["node", "caatinga", "status", "--strict"]);

      expect(process.exitCode).toBe(1);
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("does_not_exit_when_strict_and_only_undeployed_contracts_are_stale", async () => {
    process.exitCode = undefined;
    collectProjectStatusMock.mockResolvedValue({
      ...status,
      networks: [
        {
          network: "testnet",
          contracts: [
            {
              name: "token",
              deployed: false,
              dependencies: ["counter"],
              bindings: {
                contractName: "token",
                status: "missing",
                outputDir: "/tmp/token",
                marker: null,
                reason: 'not deployed on "testnet"',
              },
            },
          ],
        },
      ],
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createStatusProgram().parseAsync(["node", "caatinga", "status", "--strict"]);
      expect(process.exitCode).toBeUndefined();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("emits parseable JSON with --json", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createStatusProgram().parseAsync(["node", "caatinga", "status", "--json"]);

      expect(logSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed).toEqual(status);
    } finally {
      logSpy.mockRestore();
    }
  });
});
