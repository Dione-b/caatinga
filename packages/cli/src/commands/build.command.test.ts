import { beforeEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import type { CaatingaConfig } from "@caatinga/core";
import { buildContract, CaatingaError, CaatingaErrorCode } from "@caatinga/core";
import { registerBuildCommand } from "./build.command.js";
import { evaluateDeployCoverage } from "./doctor-deploy-coverage.js";

const buildContractMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());
const evaluateDeployCoverageMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    buildContract: buildContractMock,
    loadConfig: loadConfigMock,
  };
});

vi.mock("./doctor-deploy-coverage.js", () => ({
  evaluateDeployCoverage: evaluateDeployCoverageMock,
}));

const config: CaatingaConfig = {
  project: "counter-app",
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
};

function createBuildProgram(): Command {
  const program = new Command();
  program.exitOverride();
  registerBuildCommand(program);
  return program;
}

describe("build command", () => {
  beforeEach(() => {
    buildContractMock.mockReset();
    loadConfigMock.mockReset();
    evaluateDeployCoverageMock.mockReset();

    loadConfigMock.mockResolvedValue(config);
    buildContractMock.mockResolvedValue({
      contract: {
        name: "counter",
        config: config.contracts.counter,
      },
    });
    evaluateDeployCoverageMock.mockResolvedValue({
      complete: true,
      lines: [
        {
          name: "counter",
          ok: true,
          contractId: "C".padEnd(56, "A"),
        },
      ],
    });
  });

  it("warns after build when default network lacks contract ids", async () => {
    evaluateDeployCoverageMock.mockResolvedValue({
      complete: false,
      lines: [
        {
          name: "counter",
          ok: false,
          fix: "Run: npx ctg deploy counter --network testnet --source <identity>",
        },
      ],
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createBuildProgram().parseAsync(["node", "caatinga", "build", "counter"]);

      expect(buildContract).toHaveBeenCalledWith({
        config,
        contractName: "counter",
      });
      expect(evaluateDeployCoverage).toHaveBeenCalledWith({ networkName: "testnet" });
      const warnings = warnSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(warnings).toContain(
        "Next: npx ctg deploy counter --network testnet --source <identity>"
      );
      expect(warnings).toContain("build alone is not enough");
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it("does not warn after build when default network has contract ids", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createBuildProgram().parseAsync(["node", "caatinga", "build", "counter"]);

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it("warns instead of failing when artifacts are missing after build", async () => {
    evaluateDeployCoverageMock.mockRejectedValue(
      new CaatingaError(
        "caatinga.artifacts.json was not found.",
        CaatingaErrorCode.ARTIFACT_NOT_FOUND
      )
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createBuildProgram().parseAsync(["node", "caatinga", "build", "counter"]);

      const warnings = warnSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(warnings).toContain(
        "Next: npx ctg deploy counter --network testnet --source <identity>"
      );
      expect(warnings).toContain("build alone is not enough");
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it("does not warn about frontend for projects without a frontend config", async () => {
    const minimalConfig: CaatingaConfig = {
      ...config,
      frontend: undefined,
    };
    loadConfigMock.mockResolvedValue(minimalConfig);
    evaluateDeployCoverageMock.mockResolvedValue({
      complete: false,
      lines: [
        {
          name: "counter",
          ok: false,
          fix: "Run: npx ctg deploy counter --network testnet --source <identity>",
        },
      ],
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createBuildProgram().parseAsync(["node", "caatinga", "build", "counter"]);

      const warnings = warnSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(warnings).toContain(
        "Next: npx ctg deploy counter --network testnet --source <identity>"
      );
      expect(warnings).not.toContain("frontend needs contractId");
    } finally {
      warnSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  it("builds the sole configured contract when no name is passed", async () => {
    const verifierConfig: CaatingaConfig = {
      ...config,
      contracts: {
        verifier: {
          path: "./contracts/verifier",
          wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm",
          dependsOn: [],
          deployArgs: {},
        },
      },
    };
    loadConfigMock.mockResolvedValue(verifierConfig);
    buildContractMock.mockResolvedValue({
      contract: {
        name: "verifier",
        config: verifierConfig.contracts.verifier,
      },
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createBuildProgram().parseAsync(["node", "caatinga", "build"]);

      expect(buildContract).toHaveBeenCalledWith({
        config: verifierConfig,
        contractName: "verifier",
      });
    } finally {
      logSpy.mockRestore();
    }
  });

  it("builds all configured contracts when no name is passed", async () => {
    const multiContractConfig: CaatingaConfig = {
      ...config,
      contracts: {
        counter: config.contracts.counter,
        token: {
          path: "./contracts/token",
          wasm: "./contracts/token/target/wasm32v1-none/release/token.wasm",
          dependsOn: [],
          deployArgs: {},
        },
      },
    };
    loadConfigMock.mockResolvedValue(multiContractConfig);
    buildContractMock
      .mockResolvedValueOnce({
        contract: {
          name: "counter",
          config: multiContractConfig.contracts.counter,
        },
      })
      .mockResolvedValueOnce({
        contract: {
          name: "token",
          config: multiContractConfig.contracts.token,
        },
      });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await createBuildProgram().parseAsync(["node", "caatinga", "build"]);

      expect(buildContract).toHaveBeenCalledTimes(2);
      expect(buildContract).toHaveBeenNthCalledWith(1, {
        config: multiContractConfig,
        contractName: "counter",
      });
      expect(buildContract).toHaveBeenNthCalledWith(2, {
        config: multiContractConfig,
        contractName: "token",
      });
    } finally {
      logSpy.mockRestore();
    }
  });
});
