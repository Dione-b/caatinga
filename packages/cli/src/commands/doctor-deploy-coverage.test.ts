import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaatingaConfig } from "@caatinga/core";
import { evaluateDeployCoverage } from "./doctor-deploy-coverage.js";
import { reportDeployCoverage } from "./doctor.command.js";

const loadConfigMock = vi.hoisted(() => vi.fn());
const readArtifactsMock = vi.hoisted(() => vi.fn());
const resolveNetworkMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: loadConfigMock,
    readArtifacts: readArtifactsMock,
    resolveNetwork: resolveNetworkMock,
  };
});

const config: CaatingaConfig = {
  project: "marketplace-app",
  defaultNetwork: "testnet",
  contracts: {
    token: {
      path: "./contracts/token",
      wasm: "./token.wasm",
      dependsOn: [],
      deployArgs: {},
    },
    marketplace: {
      path: "./contracts/marketplace",
      wasm: "./marketplace.wasm",
      dependsOn: ["token"],
      deployArgs: {
        tokenContractId: "${contracts.token.contractId}",
      },
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
};

const tokenContractId = "C".padEnd(56, "T");

describe("evaluateDeployCoverage", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    readArtifactsMock.mockReset();
    resolveNetworkMock.mockReset();

    loadConfigMock.mockResolvedValue(config);
    resolveNetworkMock.mockReturnValue({
      name: "testnet",
      rpcUrl: config.networks.testnet.rpcUrl,
      networkPassphrase: config.networks.testnet.networkPassphrase,
    });
  });

  it("should_mark_complete_when_all_configured_contracts_have_contract_ids", async () => {
    readArtifactsMock.mockResolvedValue({
      project: "marketplace-app",
      version: 1,
      networks: {
        testnet: {
          contracts: {
            token: { contractId: tokenContractId },
            marketplace: { contractId: "C".padEnd(56, "M") },
          },
          dependencyGraph: {},
        },
      },
    });

    const result = await evaluateDeployCoverage({ networkName: "testnet" });

    expect(result.complete).toBe(true);
    expect(result.lines).toEqual([
      { name: "token", ok: true, contractId: tokenContractId },
      { name: "marketplace", ok: true, contractId: "C".padEnd(56, "M") },
    ]);
  });

  it("should_report_missing_contracts_when_artifacts_lack_contract_ids", async () => {
    readArtifactsMock.mockResolvedValue({
      project: "marketplace-app",
      version: 1,
      networks: {
        testnet: {
          contracts: {
            token: { contractId: tokenContractId },
          },
          dependencyGraph: {},
        },
      },
    });

    const result = await evaluateDeployCoverage({ networkName: "testnet" });

    expect(result.complete).toBe(false);
    expect(result.lines).toEqual([
      { name: "token", ok: true, contractId: tokenContractId },
      {
        name: "marketplace",
        ok: false,
        fix: "Run: npx caatinga deploy marketplace --network testnet --source <identity>",
      },
    ]);
  });
});

describe("reportDeployCoverage", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    readArtifactsMock.mockReset();
    resolveNetworkMock.mockReset();

    loadConfigMock.mockResolvedValue(config);
    resolveNetworkMock.mockReturnValue({
      name: "testnet",
      rpcUrl: config.networks.testnet.rpcUrl,
      networkPassphrase: config.networks.testnet.networkPassphrase,
    });
  });

  it("should_print_advisory_when_coverage_is_incomplete_without_throwing", async () => {
    readArtifactsMock.mockResolvedValue({
      project: "marketplace-app",
      version: 1,
      networks: {
        testnet: {
          contracts: {
            token: { contractId: tokenContractId },
          },
          dependencyGraph: {},
        },
      },
    });

    await expect(reportDeployCoverage("testnet")).resolves.toBeUndefined();
  });
});
