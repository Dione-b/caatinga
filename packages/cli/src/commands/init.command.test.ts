import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerInitCommand } from "./init.command.js";

const createProjectMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    createProjectFromTemplate: createProjectMock
  };
});

vi.mock("../utils/template-path.js", () => ({
  resolveTemplateDir: vi.fn().mockResolvedValue("/fake/templates/react-vite-counter")
}));

function createInitProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerInitCommand(program);
  return program;
}

describe("init command", () => {
  beforeEach(() => {
    createProjectMock.mockReset();
    createProjectMock.mockResolvedValue({
      targetDir: "/abs/my-dapp",
      template: {
        name: "react-vite-counter",
        version: "0.1.0",
        contracts: { default: "counter" }
      }
    });
  });

  it("prints the full deploy lifecycle and a deploy-before-frontend note", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createInitProgram().parseAsync(["node", "caatinga", "init", "my-dapp"]);

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("npm install");
      expect(output).toContain("npx caatinga build    counter");
      expect(output).toContain("npx caatinga deploy   counter --network testnet --source <identity>");
      expect(output).not.toContain("npx caatinga generate counter");
      expect(output).toContain("npm run dev");
      expect(output).toContain(
        "Note: deploy generates TypeScript bindings automatically (--no-generate to skip)"
      );
      expect(output).toContain("the dApp reads the contract ID from caatinga.artifacts.json");
      expect(output).toContain(
        "If generation fails, recover with: npx caatinga generate --network testnet"
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("falls back to bare commands and still prints the note when no default contract", async () => {
    createProjectMock.mockResolvedValue({
      targetDir: "/abs/my-dapp",
      template: { name: "blank", version: "0.1.0", contracts: {} }
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createInitProgram().parseAsync(["node", "caatinga", "init", "my-dapp"]);

      const output = logSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("npx caatinga build");
      expect(output).toContain("npx caatinga deploy   --network testnet --source <identity>");
      expect(output).toContain(
        "Note: deploy generates TypeScript bindings automatically (--no-generate to skip)"
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});
