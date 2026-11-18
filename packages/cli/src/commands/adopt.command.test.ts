import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerAdoptCommand } from "./adopt.command.js";

const adoptProjectMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    adoptProject: adoptProjectMock,
  };
});

const CONTRACT_ID = `C${"A".repeat(55)}`;

function createAdoptProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerAdoptCommand(program);
  return program;
}

const adoptResult = {
  workspaceRoot: "/tmp/workspace",
  projectName: "adopted-app",
  network: "testnet",
  configWritten: true,
  configAlreadyExisted: false,
  artifactsWritten: true,
  artifactsAlreadyExisted: false,
  discoveredContracts: [
    {
      name: "counter",
      memberPath: "contracts/counter",
      wasmPath: "contracts/counter/target/wasm32v1-none/release/counter.wasm",
      wasmOnDisk: false,
    },
  ],
  importedContracts: ["counter"],
  replacedContracts: [],
  skippedContracts: [],
};

describe("adopt command", () => {
  beforeEach(() => {
    adoptProjectMock.mockReset();
    adoptProjectMock.mockResolvedValue(adoptResult);
  });

  it("passes the contract-id import through to the core adopt flow", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createAdoptProgram().parseAsync([
        "node",
        "ctg",
        "adopt",
        "--contract-id",
        CONTRACT_ID,
        "--name",
        "counter",
        "--project-name",
        "adopted-app",
        "--network",
        "testnet",
      ]);

      expect(adoptProjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          networkName: "testnet",
          projectName: "adopted-app",
          imports: [{ name: "counter", contractId: CONTRACT_ID }],
          force: undefined,
        })
      );

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Adopting Soroban workspace at /tmp/workspace");
      expect(output).toContain("Wrote caatinga.config.ts (project \"adopted-app\")");
      expect(output).toContain("counter");
      expect(output).toContain("Imported contract \"counter\" from on-chain state");
      expect(output).toContain("wasm not built yet — run ctg build");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("adopts without imports and reports the import hint", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createAdoptProgram().parseAsync(["node", "ctg", "adopt"]);

      expect(adoptProjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ imports: [] })
      );

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("ctg adopt --contract-id <C...> [--name <name>]");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("reports a skipped contract and points at --force", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    adoptProjectMock.mockResolvedValue({
      ...adoptResult,
      importedContracts: [],
      skippedContracts: ["counter"],
    });

    try {
      await createAdoptProgram().parseAsync([
        "node",
        "ctg",
        "adopt",
        "--contract-id",
        CONTRACT_ID,
      ]);

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Skipped \"counter\"");
      expect(output).toContain("use --force to replace");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("surfaces a CaatingaError through the structured error printer", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    adoptProjectMock.mockRejectedValue(
      Object.assign(new Error("boom"), {
        code: "CAATINGA_INVALID_CONFIG",
        hint: "pass --name",
      })
    );

    try {
      await createAdoptProgram().parseAsync(["node", "ctg", "adopt"]);

      expect(process.exitCode).toBe(1);
      const errors = errorSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(errors).toContain("CAATINGA_INVALID_CONFIG");
      expect(errors).toContain("pass --name");
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      process.exitCode = undefined;
    }
  });
});
