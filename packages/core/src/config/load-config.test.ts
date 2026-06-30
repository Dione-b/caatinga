import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { loadConfig } from "./load-config.js";

describe("loadConfig", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_throw_CAATINGA_CONFIG_NOT_FOUND_when_config_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-load-"));
    await expect(loadConfig({ cwd: tmpDir })).rejects.toMatchObject({
      code: CaatingaErrorCode.CONFIG_NOT_FOUND,
    });
  });

  it("should_load_and_validate_exported_default_config", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-load-"));
    const configPath = path.join(tmpDir, "caatinga.config.ts");
    await writeFile(
      configPath,
      `export default {
  project: "tmp-app",
  defaultNetwork: "testnet",
  contracts: {
    counter: { path: "./contracts/counter", wasm: "./target/counter.wasm" }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  frontend: { bindingsOutput: "./src/gen" }
};
`,
      "utf8"
    );

    const config = await loadConfig({ cwd: tmpDir });
    expect(config.project).toBe("tmp-app");
    expect(config.contracts.counter.path).toBe("./contracts/counter");
  });

  it("should_throw_CAATINGA_INVALID_CONFIG_when_zod_validation_fails", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-load-"));
    await writeFile(
      path.join(tmpDir, "caatinga.config.ts"),
      `export default { project: "" };
`,
      "utf8"
    );

    await expect(loadConfig({ cwd: tmpDir })).rejects.toMatchObject({
      code: CaatingaErrorCode.INVALID_CONFIG,
    });
  });

  it("should_resolve_custom_config_path_relative_to_cwd", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-load-"));
    await mkdir(path.join(tmpDir, "cfg"), { recursive: true });
    await writeFile(
      path.join(tmpDir, "cfg", "k.custom.ts"),
      `export default {
  project: "nested",
  defaultNetwork: "testnet",
  contracts: { c: { path: "./p", wasm: "./w.wasm" } },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  frontend: { bindingsOutput: "./out" }
};
`,
      "utf8"
    );

    const config = await loadConfig({ cwd: tmpDir, configPath: "cfg/k.custom.ts" });
    expect(config.project).toBe("nested");
  });

  it("should_rethrow_non_zod_errors_from_loader", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-load-"));
    await writeFile(
      path.join(tmpDir, "caatinga.config.ts"),
      `throw new Error("syntax boom");
`,
      "utf8"
    );

    await expect(loadConfig({ cwd: tmpDir })).rejects.toThrow("syntax boom");
  });

  it("should_throw_INVALID_CONFIG_when_contract_graph_has_missing_dependsOn_for_deployArgs", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-load-"));
    await writeFile(
      path.join(tmpDir, "caatinga.config.ts"),
      `export default {
  project: "tmp-app",
  defaultNetwork: "testnet",
  contracts: {
    token: { path: "./contracts/token", wasm: "./target/token.wasm" },
    marketplace: {
      path: "./contracts/marketplace",
      wasm: "./target/marketplace.wasm",
      dependsOn: [],
      deployArgs: { tokenContractId: "\${contracts.token.contractId}" }
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  frontend: { bindingsOutput: "./src/gen" }
};
`,
      "utf8"
    );

    await expect(loadConfig({ cwd: tmpDir })).rejects.toMatchObject({
      code: CaatingaErrorCode.INVALID_CONFIG,
    });
  });

  it("should_throw_CAATINGA_DEPENDENCIES_NOT_INSTALLED_when_caatinga_core_is_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-load-"));
    await writeFile(
      path.join(tmpDir, "caatinga.config.ts"),
      `import { defineConfig } from "@caatinga/core";
export default defineConfig({
  project: "tmp-app",
  defaultNetwork: "testnet",
  contracts: {
    counter: { path: "./contracts/counter", wasm: "./target/counter.wasm" }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  }
});
`,
      "utf8"
    );

    await expect(loadConfig({ cwd: tmpDir })).rejects.toMatchObject({
      code: CaatingaErrorCode.DEPENDENCIES_NOT_INSTALLED,
    });
  });
});
