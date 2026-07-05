import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { CaatingaConfig } from "@caatinga/core";
import { registerUpgradeCommand } from "./upgrade.command.js";

const upgradeContractInPlaceMock = vi.hoisted(() => vi.fn());
const generateBindingsGraphMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());
const syncFrontendEnvMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    upgradeContractInPlace: upgradeContractInPlaceMock,
    generateBindingsGraph: generateBindingsGraphMock,
    loadConfig: loadConfigMock,
    syncFrontendEnv: syncFrontendEnvMock,
  };
});

const CONTRACT_ID = `C${"2".repeat(55)}`;
const WASM_HASH = "a".repeat(64);

const config: CaatingaConfig = {
  project: "album",
  defaultNetwork: "testnet",
  contracts: {
    sticker: {
      path: "./contracts/sticker",
      wasm: "./contracts/sticker/target/wasm32v1-none/release/sticker.wasm",
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
    envFile: ".env.local",
    env: {
      "sticker.contractId": "VITE_STICKER_CONTRACT_ID",
    },
  },
};

function createUpgradeProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerUpgradeCommand(program);
  return program;
}

describe("upgrade command", () => {
  beforeEach(() => {
    upgradeContractInPlaceMock.mockReset();
    generateBindingsGraphMock.mockReset();
    loadConfigMock.mockReset();
    syncFrontendEnvMock.mockReset();
    loadConfigMock.mockResolvedValue(config);
    upgradeContractInPlaceMock.mockResolvedValue({
      contractName: "sticker",
      contractId: CONTRACT_ID,
      wasmHash: WASM_HASH,
      network: { name: "testnet" },
      skipped: false,
      artifactPath: "/tmp/caatinga.artifacts.json",
    });
    generateBindingsGraphMock.mockResolvedValue({
      network: { name: "testnet" },
      results: [
        {
          contractName: "sticker",
          importPath: "./src/contracts/generated/sticker",
        },
      ],
    });
    syncFrontendEnvMock.mockResolvedValue({ envFile: ".env.local" });
  });

  it("should_call_upgradeContractInPlace_with_source_and_network", async () => {
    const program = createUpgradeProgram();

    await program.parseAsync([
      "node",
      "caatinga",
      "upgrade",
      "sticker",
      "--network",
      "testnet",
      "--source",
      "deployer",
    ]);

    expect(upgradeContractInPlaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contractName: "sticker",
        networkName: "testnet",
        source: "deployer",
      })
    );
  });

  it("should_pass_if_changed_and_expected_hash", async () => {
    const program = createUpgradeProgram();

    await program.parseAsync([
      "node",
      "caatinga",
      "upgrade",
      "sticker",
      "--source",
      "deployer",
      "--if-changed",
      "--expected-hash",
      WASM_HASH,
    ]);

    expect(upgradeContractInPlaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ifChanged: true,
        expectedHash: WASM_HASH,
      })
    );
  });

  it("should_run_generate_and_sync_env_when_requested", async () => {
    const program = createUpgradeProgram();

    await program.parseAsync([
      "node",
      "caatinga",
      "upgrade",
      "sticker",
      "--source",
      "deployer",
      "--generate",
      "--sync-env",
    ]);

    expect(generateBindingsGraphMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contractNames: ["sticker"],
        networkName: "testnet",
      })
    );
    expect(syncFrontendEnvMock).toHaveBeenCalled();
  });

  it("should_not_upload_when_upgrade_is_skipped", async () => {
    upgradeContractInPlaceMock.mockResolvedValueOnce({
      contractName: "sticker",
      contractId: CONTRACT_ID,
      wasmHash: WASM_HASH,
      network: { name: "testnet" },
      skipped: true,
      artifactPath: "/tmp/caatinga.artifacts.json",
    });

    const program = createUpgradeProgram();
    await program.parseAsync([
      "node",
      "caatinga",
      "upgrade",
      "sticker",
      "--source",
      "deployer",
      "--if-changed",
    ]);

    expect(generateBindingsGraphMock).not.toHaveBeenCalled();
    expect(syncFrontendEnvMock).not.toHaveBeenCalled();
  });
});
