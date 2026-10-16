import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { CaatingaConfig, ProjectStatus } from "@caatinga/core";
import { collectProjectStatus } from "@caatinga/core";
import { registerStatusCommand } from "./status.command.js";

const collectProjectStatusMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());
const collectZkStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    collectProjectStatus: collectProjectStatusMock,
    loadConfig: loadConfigMock,
  };
});

vi.mock("@caatinga/zk", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/zk")>("@caatinga/zk");
  return {
    ...actual,
    collectZkStatus: collectZkStatusMock,
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
    collectZkStatusMock.mockReset();
    loadConfigMock.mockResolvedValue(config);
    collectProjectStatusMock.mockResolvedValue(status);
    // Projects without ZK circuits report an empty list.
    collectZkStatusMock.mockResolvedValue([]);
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
      expect(warnings).toContain("npx ctg generate counter --network testnet");
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

  it("exits_with_code_1_when_strict_and_deployed_bindings_are_unknown", async () => {
    process.exitCode = undefined;
    collectProjectStatusMock.mockResolvedValue({
      ...status,
      networks: [
        {
          ...status.networks[0],
          contracts: [
            {
              ...status.networks[0].contracts[0],
              bindings: {
                ...status.networks[0].contracts[0].bindings,
                status: "unknown",
                reason: "binding marker could not be read",
              },
            },
          ],
        },
      ],
    });
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

  it("documents_every_non_fresh_status_in_the_strict_help", () => {
    const strict = createStatusProgram()
      .commands.find((command) => command.name() === "status")
      ?.options.find((option) => option.long === "--strict");

    expect(strict?.description).toMatch(/not fresh \(stale, missing, or unknown\)/);
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
      // The contract/networks block is unchanged; `zk` is purely additive.
      expect(parsed.networks).toEqual(status.networks);
      expect(parsed.project).toBe(status.project);
      expect(parsed.zk).toEqual([]);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("includes zk drift in the JSON payload", async () => {
    collectZkStatusMock.mockResolvedValue([
      {
        name: "main",
        status: "input-changed",
        ceremonyType: "dev-single-party",
        inputChanged: true,
        proofExists: true,
        inputExists: true,
        inputPath: "circuits/input.json",
        advisories: ["circuits/input.json changed since `ctg zk prove main` was last run."],
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createStatusProgram().parseAsync(["node", "caatinga", "status", "--json"]);

      const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(parsed.zk[0].name).toBe("main");
      expect(parsed.zk[0].status).toBe("input-changed");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("prints a ZK section and never lets drift affect --strict", async () => {
    collectZkStatusMock.mockResolvedValue([
      {
        name: "main",
        status: "circuit-changed",
        ceremonyType: "mpc-multi-party",
        circuitChanged: true,
        proofExists: false,
        inputExists: true,
        inputPath: "circuits/input.json",
        advisories: ["The circuit sources changed since the ceremony was imported."],
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createStatusProgram().parseAsync(["node", "caatinga", "status", "--strict"]);

      const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).toContain("ZK circuits:");
      expect(output).toContain("main: circuit changed");
      expect(output).toContain("MPC (audited)");
      // --strict guards binding freshness only; ZK drift must not flip it.
      expect(process.exitCode).toBe(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("omits the ZK section for a project without ZK circuits", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createStatusProgram().parseAsync(["node", "caatinga", "status"]);

      const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(output).not.toContain("ZK circuits:");
      expect(collectZkStatusMock).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
    }
  });
});
