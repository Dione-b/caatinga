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

  it("creates a minimal project without the multiplier template when --minimal is passed", async () => {
    const program = new Command();
    registerZkInitCommand(program);
    program.exitOverride();

    const targetDir = path.join(tmpDir, "my-zk-minimal");
    await program.parseAsync(["node", "caatinga", "zk", "init", targetDir, "--minimal"]);

    const config = await fs.readFile(path.join(targetDir, "caatinga.config.ts"), "utf-8");
    const circuit = await fs.readFile(path.join(targetDir, "circuits", "main.circom"), "utf-8");
    expect(config).not.toContain("frontend");
    expect(config).toContain('verifierContract: "verifier"');
    expect(circuit).toContain("template Main()");
    expect(circuit).not.toContain("Multiplier");
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

    const circuit = await fs.readFile(path.join(tmpDir, "circuits", "main.circom"), "utf-8");
    expect(circuit).toContain("Multiplier");
  });

  it("merges zk config when scaffolding into the current project", async () => {
    const configPath = path.join(tmpDir, "caatinga.config.ts");
    await fs.writeFile(
      configPath,
      `import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "existing",
  defaultNetwork: "testnet",
  contracts: {
    counter: {
      path: "./contracts/counter",
      wasm: "./contracts/counter/target/wasm32v1-none/release/counter.wasm"
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  frontend: {
    framework: "vite-react",
    bindingsOutput: "./src/contracts/generated"
  }
});
`,
      "utf8"
    );
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

    const mergedConfig = await fs.readFile(configPath, "utf8");
    expect(mergedConfig).toContain("verifier");
    expect(mergedConfig).toContain("zk:");
    expect(mergedConfig).toContain('verifierContract: "verifier"');
  });

  it("fails before overwriting existing zk files unless --force is passed", async () => {
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
    await fs.mkdir(path.join(tmpDir, "circuits"), { recursive: true });
    await fs.writeFile(path.join(tmpDir, "circuits", "main.circom"), "existing", "utf8");

    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    const program = new Command();
    registerZkInitCommand(program);
    program.exitOverride();

    await program.parseAsync(["node", "caatinga", "zk", "init", "--minimal"]);

    expect(process.exitCode).toBe(1);
    await expect(fs.readFile(path.join(tmpDir, "circuits", "main.circom"), "utf8")).resolves.toBe(
      "existing"
    );
  });
});
