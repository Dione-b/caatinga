import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { CaatingaErrorCode } from "../errors/CaatingaError.js";
import { createProjectFromTemplate } from "./create-project-from-template.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readPackageJson<T>(packageJsonPath: string): Promise<T> {
  return JSON.parse(await readFile(packageJsonPath, "utf8")) as T;
}

function collectInternalDependencies(packageJson: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}): Record<string, { section: string; value: string }> {
  const sections = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ] as const;
  const expectations: Record<string, { section: string; value: string }> = {};

  for (const section of sections) {
    for (const [name, value] of Object.entries(packageJson[section] ?? {})) {
      if (name.startsWith("@caatinga/")) {
        expectations[name] = { section, value };
      }
    }
  }

  return expectations;
}

describe("createProjectFromTemplate", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_copy_template_replace_project_placeholder_and_write_artifacts", async () => {
    const templateDir = path.resolve(__dirname, "../../../templates/react-vite-counter");
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-init-"));
    const targetDir = path.join(tmpDir, "my-dapp");

    const result = await createProjectFromTemplate({
      projectName: "my-dapp",
      targetDir,
      templateDir
    });

    expect(result.template.name).toBe("react-vite-counter");
    expect(result.template.version).toBe("0.1.0");

    const configText = await readFile(path.join(targetDir, "caatinga.config.ts"), "utf8");
    expect(configText).toContain('project: "my-dapp"');
    expect(configText).not.toContain("__PROJECT_NAME__");

    const artifactsText = await readFile(path.join(targetDir, "caatinga.artifacts.json"), "utf8");
    const artifacts = JSON.parse(artifactsText) as {
      project: string;
      version: number;
      networks: Record<string, { contracts: Record<string, unknown>; dependencyGraph: Record<string, string[]> }>;
    };
    expect(artifacts.project).toBe("my-dapp");
    expect(artifacts.version).toBe(1);
    expect(artifacts.networks.testnet).toBeDefined();
    expect(artifacts.networks.testnet.contracts).toEqual({});
    expect(artifacts.networks.testnet.dependencyGraph).toEqual({});
  });

  it("should_create_initial_artifacts_when_template_does_not_ship_artifacts", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-init-"));
    const templateDir = path.join(tmpDir, "template");
    const targetDir = path.join(tmpDir, "my-dapp");
    await mkdir(templateDir);
    await writeFile(path.join(templateDir, "caatinga.template.json"), JSON.stringify({
      name: "no-artifacts-template",
      version: "0.1.0",
      caatinga: {
        compatibleCore: "^2.0.0",
        templateVersion: 1
      },
      frontend: {
        framework: "vite-react",
        packageManager: "npm"
      },
      contracts: {
        path: "contracts",
        default: "counter"
      },
      files: {
        config: "caatinga.config.ts",
        artifacts: "caatinga.artifacts.json"
      }
    }), "utf8");
    await writeFile(path.join(templateDir, "caatinga.config.ts"), [
      "import { defineConfig } from \"@caatinga/core\";",
      "",
      "export default defineConfig({",
      "  project: \"__PROJECT_NAME__\",",
      "  defaultNetwork: \"testnet\",",
      "  contracts: {",
      "    counter: {",
      "      path: \"./contracts/counter\",",
      "      wasm: \"./contracts/counter/target/wasm32v1-none/release/counter.wasm\"",
      "    }",
      "  },",
      "  networks: {",
      "    testnet: {",
      "      rpcUrl: \"https://soroban-testnet.stellar.org\",",
      "      networkPassphrase: \"Test SDF Network ; September 2015\"",
      "    }",
      "  },",
      "  frontend: {",
      "    framework: \"vite-react\",",
      "    bindingsOutput: \"./src/contracts/generated\"",
      "  }",
      "});",
      ""
    ].join("\n"), "utf8");

    await createProjectFromTemplate({
      projectName: "my-dapp",
      targetDir,
      templateDir
    });

    const artifacts = JSON.parse(
      await readFile(path.join(targetDir, "caatinga.artifacts.json"), "utf8")
    ) as {
      project: string;
      networks: Record<string, { contracts: Record<string, unknown>; dependencyGraph: Record<string, string[]> }>;
    };

    expect(artifacts.project).toBe("my-dapp");
    expect(artifacts.networks.testnet.contracts).toEqual({});
    expect(artifacts.networks.testnet.dependencyGraph).toEqual({});
  });

  it("should_fail_when_template_manifest_is_missing", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-init-"));
    const templateDir = path.join(tmpDir, "template");
    await mkdir(templateDir);

    await expect(createProjectFromTemplate({
      projectName: "my-dapp",
      targetDir: path.join(tmpDir, "my-dapp"),
      templateDir
    })).rejects.toMatchObject({
      code: CaatingaErrorCode.TEMPLATE_MANIFEST_NOT_FOUND
    });
  });

  it("should_fail_when_template_requires_incompatible_core", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-init-"));
    const templateDir = path.join(tmpDir, "template");
    await mkdir(templateDir);
    await writeFile(path.join(templateDir, "caatinga.template.json"), JSON.stringify({
      name: "future-template",
      version: "1.0.0",
      caatinga: {
        compatibleCore: "^99.0.0",
        templateVersion: 1
      },
      frontend: {
        framework: "vite-react",
        packageManager: "npm"
      },
      contracts: {
        path: "contracts"
      },
      files: {
        config: "caatinga.config.ts",
        artifacts: "caatinga.artifacts.json"
      }
    }), "utf8");

    await expect(createProjectFromTemplate({
      projectName: "my-dapp",
      targetDir: path.join(tmpDir, "my-dapp"),
      templateDir
    })).rejects.toMatchObject({
      code: CaatingaErrorCode.TEMPLATE_INCOMPATIBLE
    });
  });

  it("should_fail_when_template_manifest_json_is_invalid", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-init-"));
    const templateDir = path.join(tmpDir, "template");
    await mkdir(templateDir);
    await writeFile(path.join(templateDir, "caatinga.template.json"), "{ not json", "utf8");

    await expect(createProjectFromTemplate({
      projectName: "my-dapp",
      targetDir: path.join(tmpDir, "my-dapp"),
      templateDir
    })).rejects.toMatchObject({
      code: CaatingaErrorCode.INVALID_TEMPLATE_MANIFEST,
      message: "Template manifest is invalid."
    });
  });

  it("should_fail_when_template_manifest_schema_is_invalid", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-init-"));
    const templateDir = path.join(tmpDir, "template");
    await mkdir(templateDir);
    await writeFile(path.join(templateDir, "caatinga.template.json"), JSON.stringify({
      name: "",
      version: "1.0.0"
    }), "utf8");

    await expect(createProjectFromTemplate({
      projectName: "my-dapp",
      targetDir: path.join(tmpDir, "my-dapp"),
      templateDir
    })).rejects.toMatchObject({
      code: CaatingaErrorCode.INVALID_TEMPLATE_MANIFEST,
      message: "Template manifest is invalid."
    });
  });

  it("ships marketplace-with-token as a multi-contract dependency template", async () => {
    const templateRoot = path.resolve(__dirname, "../../../templates");
    const templatePath = path.join(templateRoot, "marketplace-with-token");
    const manifest = JSON.parse(await readFile(path.join(templatePath, "caatinga.template.json"), "utf8"));
    const config = await readFile(path.join(templatePath, "caatinga.config.ts"), "utf8");
    const mainSource = await readFile(path.join(templatePath, "src/main.ts"), "utf8");
    const appSource = await readFile(path.join(templatePath, "src/App.tsx"), "utf8");
    const marketplaceSource = await readFile(path.join(templatePath, "contracts/marketplace/src/lib.rs"), "utf8");
    const packageJson = await readPackageJson<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    }>(path.join(templatePath, "package.json"));

    expect(manifest.name).toBe("marketplace-with-token");
    expect(config).toContain("dependsOn: [\"token\"]");
    expect(config).toContain("tokenContractId: \"${contracts.token.contractId}\"");
    expect(mainSource).not.toContain("placeholder");
    expect(appSource).toContain("__constructor");
    expect(packageJson.dependencies?.["@caatinga/client"]).toEqual(expect.any(String));
    expect(packageJson.dependencies?.react).toEqual(expect.any(String));
    expect(packageJson.dependencies?.vite).toEqual(expect.any(String));
    expect(packageJson.scripts?.build).toContain("vite build");
    expect(marketplaceSource).toContain("pub fn __constructor");
    expect(marketplaceSource).toContain("pub fn token_contract_id");
    await expect(readFile(path.join(templatePath, "contracts/token/src/lib.rs"), "utf8")).resolves.toBeTruthy();
    await expect(readFile(path.join(templatePath, "contracts/marketplace/src/lib.rs"), "utf8")).resolves.toBeTruthy();
  });

  it("should_pin_internal_dependency_ranges_for_official_templates", async () => {
    const templateRoot = path.resolve(__dirname, "../../../templates");
    const packageVersions = await Promise.all([
      readPackageJson<{ version: string }>(path.resolve(__dirname, "../../../client/package.json")),
      readPackageJson<{ version: string }>(path.resolve(__dirname, "../../package.json")),
      readPackageJson<{ version: string }>(path.resolve(__dirname, "../../../cli/package.json")),
      readPackageJson<{ version: string }>(path.resolve(__dirname, "../../../zk/package.json"))
    ]);
    const [clientPackageJson, corePackageJson, cliPackageJson, zkPackageJson] = packageVersions;
    const expectedInternalDependencies = {
      "@caatinga/client": {
        section: "dependencies",
        value: `^${clientPackageJson.version}`
      },
      "@caatinga/core": {
        section: "dependencies",
        value: `^${corePackageJson.version}`
      },
      "@caatinga/cli": {
        section: "devDependencies",
        value: `^${cliPackageJson.version}`
      }
    } satisfies Record<string, { section: string; value: string }>;
    const expectedZkStarterDependencies = {
      ...expectedInternalDependencies,
      "@caatinga/zk": {
        section: "dependencies",
        value: `^${zkPackageJson.version}`
      }
    };

    const templateExpectations = [
      {
        template: "react-vite-counter",
        expected: expectedInternalDependencies
      },
      {
        template: "marketplace-with-token",
        expected: {
          "@caatinga/client": expectedInternalDependencies["@caatinga/client"],
          "@caatinga/core": expectedInternalDependencies["@caatinga/core"],
          "@caatinga/cli": expectedInternalDependencies["@caatinga/cli"]
        }
      },
      {
        template: "zk-starter",
        expected: expectedZkStarterDependencies
      }
    ];

    for (const { template, expected } of templateExpectations) {
      const packageJson = await readPackageJson<{
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      }>(path.join(templateRoot, template, "package.json"));
      expect(collectInternalDependencies(packageJson)).toEqual(expected);
    }
  });

  it("should_include_public_dependencies_in_react_vite_counter_template", async () => {
    const templatePackageJsonPath = path.resolve(
      __dirname,
      "../../../templates/react-vite-counter/package.json"
    );
    const packageJson = await readPackageJson<{
      dependencies?: Record<string, string>;
    }>(templatePackageJsonPath);

    expect(packageJson.dependencies?.["@creit.tech/stellar-wallets-kit"]).toBe("^2.3.0");
  });

  it("should_install_cleanly_on_pnpm_10_26_plus", async () => {
    const templateRoot = path.resolve(__dirname, "../../../templates/react-vite-counter");
    const packageJson = await readPackageJson<{
      dependencies?: Record<string, string>;
      overrides?: Record<string, unknown>;
    }>(path.join(templateRoot, "package.json"));
    const viteConfig = await readFile(path.join(templateRoot, "vite.config.ts"), "utf8");

    expect(packageJson.dependencies?.["@creit.tech/stellar-wallets-kit"]).toBe("^2.3.0");
    expect(packageJson.overrides?.uuid).toBe("^14.0.0");
    expect(packageJson.overrides?.["@creit.tech/stellar-wallets-kit"]).toEqual({
      "@trezor/connect-web": "file:./src/stubs/empty-wallet-dep",
      "@trezor/connect-plugin-stellar": "file:./src/stubs/empty-wallet-dep",
      "@hot-wallet/sdk": "file:./src/stubs/hot-wallet-sdk"
    });

    const workspaceYaml = await readFile(path.join(templateRoot, "pnpm-workspace.yaml"), "utf8");
    expect(workspaceYaml).toContain("allowBuilds:");
    expect(workspaceYaml).toContain("esbuild: true");
    expect(workspaceYaml).toContain("overrides:");
    expect(workspaceYaml).toContain("ignoredOptionalDependencies:");
    expect(workspaceYaml).toContain('uuid: "^14.0.0"');

    expect(viteConfig).toContain("@caatinga/client/vite");
    expect(viteConfig).toContain("walletStubViteAliases");
  });

  it("ships a counter contract compatible with the supported wasm32v1-none build target", async () => {
    const templatePath = path.resolve(__dirname, "../../../templates/react-vite-counter");
    const config = await readFile(path.join(templatePath, "caatinga.config.ts"), "utf8");
    const cargoToml = await readFile(path.join(templatePath, "contracts/counter/Cargo.toml"), "utf8");

    expect(config).toContain("target/wasm32v1-none/release/counter.wasm");
    expect(cargoToml).toContain('soroban-sdk = "22.0.1"');
    expect(cargoToml).toContain('soroban-sdk = { version = "22.0.1", features = ["testutils"] }');
  });

  it("ships zk-starter with a minimal vite-react frontend", async () => {
    const templatePath = path.resolve(__dirname, "../../../templates/zk-starter");
    const viteConfig = await readFile(path.join(templatePath, "vite.config.ts"), "utf8");
    const packageJson = await readPackageJson<{
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    }>(path.join(templatePath, "package.json"));

    await expect(readFile(path.join(templatePath, "index.html"), "utf8")).resolves.toContain('id="root"');
    await expect(readFile(path.join(templatePath, "src/main.tsx"), "utf8")).resolves.toContain("ReactDOM.createRoot");
    await expect(readFile(path.join(templatePath, "src/App.tsx"), "utf8")).resolves.toContain("WalletProvider");
    await expect(readFile(path.join(templatePath, "src/caatinga.ts"), "utf8")).resolves.toContain("createCaatingaClient");
    await expect(readFile(path.join(templatePath, "src/components/CircuitCard.tsx"), "utf8")).resolves.toContain(
      "verify_proof"
    );
    await expect(readFile(path.join(templatePath, "src/components/LoadingModal.tsx"), "utf8")).resolves.toBeTruthy();
    await expect(
      readFile(path.join(templatePath, "src/bindings/verifier/src/index.ts"), "utf8")
    ).resolves.toContain("__caatingaPlaceholder");

    expect(packageJson.dependencies?.react).toBeDefined();
    expect(packageJson.dependencies?.["@caatinga/zk"]).toBeDefined();
    expect(packageJson.scripts?.dev).toBe("vite");
    expect(viteConfig).toContain("@vitejs/plugin-react");
    expect(viteConfig).toContain("/zk-artifacts");
  });

  it("ships zk-starter with wasm32v1-none verifier config", async () => {
    const templatePath = path.resolve(__dirname, "../../../templates/zk-starter");
    const config = await readFile(path.join(templatePath, "caatinga.config.ts"), "utf8");
    const cargoToml = await readFile(path.join(templatePath, "contracts/verifier/Cargo.toml"), "utf8");
    const inputJson = JSON.parse(
      await readFile(path.join(templatePath, "circuits/input.json"), "utf8")
    ) as Record<string, string>;

    expect(config).toContain("wasm32v1-none");
    expect(cargoToml).toContain('soroban-sdk = "25.1.0"');
    expect(inputJson).not.toHaveProperty("c");
  });

  it("keeps zk-starter verifier files aligned with the canonical scaffold", async () => {
    const templatePath = path.resolve(__dirname, "../../../templates/zk-starter/contracts/verifier");
    const scaffoldPath = path.resolve(__dirname, "../../scaffolds/zk-verifier");
    const verifierFiles = [
      "Cargo.toml",
      "Cargo.lock",
      "src/lib.rs",
      "src/test.rs"
    ];

    for (const file of verifierFiles) {
      await expect(readFile(path.join(templatePath, file), "utf8")).resolves.toBe(
        await readFile(path.join(scaffoldPath, file), "utf8")
      );
    }
  });

  it("ships lockfiles for official Rust contracts so smoke builds stay reproducible", async () => {
    const templateContracts = [
      "../../../templates/react-vite-counter/contracts/counter/Cargo.lock",
      "../../../templates/marketplace-with-token/contracts/token/Cargo.lock",
      "../../../templates/marketplace-with-token/contracts/marketplace/Cargo.lock",
      "../../../templates/zk-starter/contracts/verifier/Cargo.lock"
    ];

    await Promise.all(templateContracts.map(async templateContractLockPath => {
      await expect(
        readFile(path.resolve(__dirname, templateContractLockPath), "utf8")
      ).resolves.toContain("[[package]]");
    }));
  });
});
