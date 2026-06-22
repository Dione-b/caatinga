import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaError, CaatingaErrorCode, type CaatingaConfig } from "@caatinga/core";
import { configDiagnostic, networkDiagnostic } from "./project-diagnostic.js";

const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async () => {
  const actual = await vi.importActual<typeof import("@caatinga/core")>("@caatinga/core");
  return {
    ...actual,
    loadConfig: loadConfigMock,
  };
});

const config: CaatingaConfig = {
  project: "app",
  defaultNetwork: "testnet",
  contracts: {},
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
};

const dependenciesError = new CaatingaError(
  "Project dependencies are not installed.",
  CaatingaErrorCode.DEPENDENCIES_NOT_INSTALLED,
  "Run npm install (or pnpm install) in the project root, then retry."
);

describe("configDiagnostic", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
  });

  it("does not duplicate the dependencies line when dependencies are missing", async () => {
    loadConfigMock.mockRejectedValue(dependenciesError);

    // dependenciesDiagnostic owns this line, so configDiagnostic must stay silent.
    await expect(configDiagnostic()).resolves.toBeUndefined();
  });

  it("passes when the config loads", async () => {
    loadConfigMock.mockResolvedValue(config);

    await expect(configDiagnostic()).resolves.toMatchObject({
      ok: true,
      label: "caatinga.config.ts found",
    });
  });
});

describe("networkDiagnostic", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
  });

  it("skips the network check when dependencies are not installed", async () => {
    loadConfigMock.mockRejectedValue(dependenciesError);

    // Must not falsely report the network as missing before npm install.
    await expect(networkDiagnostic("testnet")).resolves.toBeUndefined();
  });

  it("still reports a genuinely missing network once the config loads", async () => {
    loadConfigMock.mockResolvedValue(config);

    await expect(networkDiagnostic("ghostnet")).resolves.toMatchObject({
      ok: false,
      label: "network ghostnet not found",
    });
  });

  it("reports a configured network as found", async () => {
    loadConfigMock.mockResolvedValue(config);

    await expect(networkDiagnostic("testnet")).resolves.toMatchObject({
      ok: true,
      label: "network testnet found",
    });
  });
});
