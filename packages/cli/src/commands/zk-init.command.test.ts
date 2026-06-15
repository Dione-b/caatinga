import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Command } from "commander";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { registerZkInitCommand } from "./zk-init.command.js";

const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: loadConfigMock,
  };
});

describe("zk-init command", () => {
  let tmpDir: string;
  let originalTemplatesDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "caatinga-zk-init-"));
    originalTemplatesDir = process.env.CAATINGA_TEMPLATES_DIR;
    process.env.CAATINGA_TEMPLATES_DIR = path.resolve("packages/templates");
    loadConfigMock.mockReset();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.env.CAATINGA_TEMPLATES_DIR = originalTemplatesDir;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates a new project when given a project name", async () => {
    const program = new Command();
    registerZkInitCommand(program);
    program.exitOverride();

    const targetDir = path.join(tmpDir, "my-zk-dapp");
    await program.parseAsync(["node", "caatinga", "zk", "init", targetDir]);

    const libRs = await fs.readFile(
      path.join(targetDir, "contracts", "verifier", "src", "lib.rs"),
      "utf-8"
    );
    expect(libRs).toContain("Groth16Verifier");
  });

  it("scaffolds into the current project when no name is given", async () => {
    loadConfigMock.mockResolvedValue({
      project: "existing",
      defaultNetwork: "testnet",
      contracts: {
        counter: {
          path: "./contracts/counter",
          wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm",
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
      frontend: {
        framework: "vite-react",
        bindingsOutput: "./src/contracts/generated",
      },
    });

    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    const program = new Command();
    registerZkInitCommand(program);
    program.exitOverride();

    await program.parseAsync(["node", "caatinga", "zk", "init"]);

    const circuit = await fs.readFile(
      path.join(tmpDir, "circuits", "main.circom"),
      "utf-8"
    );
    expect(circuit).toContain("Multiplier");
  });
});
