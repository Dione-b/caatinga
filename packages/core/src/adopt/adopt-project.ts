import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ContractArtifact } from "../artifacts/artifact.schema.js";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { loadConfig } from "../config/load-config.js";
import {
  resolveNetwork,
  type ResolvedNetwork,
} from "../networks/resolve-network.js";
import { WELL_KNOWN_NETWORKS } from "../networks/network-metadata.js";
import { hashWasm } from "../contracts/wasm.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { TRANSACTION_TIMEOUT_MS } from "../shell/command-timeouts.js";
import { CONTRACT_ID_REGEX } from "../stellar-cli/strkey.js";
import {
  discoverCargoWorkspace,
  type DiscoveredContract,
} from "./discover-cargo-workspace.js";

/** Marker written into artifact fields that have no local counterpart for imported contracts. */
export const IMPORTED_SOURCE_MARKER = "imported (ctg adopt)";

export type AdoptImport = {
  /**
   * Name under which the imported contract is stored in config + artifacts.
   * Optional: when omitted it defaults to the single discovered contract
   * crate, so `ctg adopt --contract-id <C…>` works unqualified; with zero or
   * several crates the name must be given explicitly.
   */
  name?: string;
  /** Deployed contract strkey (`C…`); the wasmHash is always re-derived on-chain, never taken from input. */
  contractId: string;
};

export type AdoptProjectOptions = {
  cwd: string;
  /** Project name written into generated config/artifacts; defaults to the workspace crate name, then the directory name. */
  projectName?: string;
  /** Network flag. When a config exists this overrides its defaultNetwork; otherwise it must be a well-known network. */
  networkName?: string;
  /** Already-deployed contracts to import into the artifacts file. */
  imports?: AdoptImport[];
  /** Replace an existing artifact entry for an imported contract name instead of skipping it. Never replaces the whole file. */
  force?: boolean;
  /** Test seam: the shell runner used for `stellar contract fetch`. */
  runCommandFn?: typeof runCommand;
  /** Test seam: the config loader used to resolve an existing config's network. */
  loadConfigFn?: typeof loadConfig;
};

export type AdoptProjectResult = {
  workspaceRoot: string;
  projectName: string;
  network: string;
  configWritten: boolean;
  configAlreadyExisted: boolean;
  artifactsWritten: boolean;
  artifactsAlreadyExisted: boolean;
  /** Contract crates found in the Cargo workspace and written into the generated config. */
  discoveredContracts: DiscoveredContract[];
  /** Names of contracts imported from on-chain state. */
  importedContracts: string[];
  /** Names whose existing artifact entry was replaced because --force was passed. */
  replacedContracts: string[];
  /** Names that already had an artifact entry and were left untouched (no-overwrite rule). */
  skippedContracts: string[];
};

type ResolvedAdoptNetwork = ResolvedNetwork;

async function fileExists(fullPath: string): Promise<boolean> {
  try {
    await stat(fullPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveAdoptNetwork(
  cwd: string,
  networkName: string | undefined,
  configExists: boolean,
  loadConfigFn: typeof loadConfig
): Promise<ResolvedAdoptNetwork> {
  if (configExists) {
    // A config wins: its networks are the ones `ctg` commands will actually use
    // after adoption, so the artifacts must be recorded under the same name.
    const config = await loadConfigFn({ cwd });
    const resolved = resolveNetwork(config, networkName);
    return { name: resolved.name, config: resolved.config, origin: resolved.origin };
  }

  const name = networkName ?? "testnet";
  const wellKnown = WELL_KNOWN_NETWORKS[name];
  if (!wellKnown) {
    throw new CaatingaError(
      `Network "${name}" is not a well-known network and no caatinga.config.ts exists.`,
      CaatingaErrorCode.INVALID_CONFIG,
      "ctg adopt can only target testnet or mainnet without a config. Run ctg init first to create a caatinga.config.ts for custom networks."
    );
  }
  return { name, config: wellKnown, origin: networkName === undefined ? "config" : "flag" };
}

/**
 * Imports one already-deployed contract by fetching its WASM through the
 * Stellar CLI and hashing the fetched bytes, so the recorded `wasmHash` always
 * reflects on-chain state rather than user input. Kept behind an injectable
 * `runCommandFn` so tests never shell out.
 */
async function importContractArtifact(
  spec: AdoptImport & { name: string },
  network: ResolvedAdoptNetwork,
  cwd: string,
  runCommandFn: typeof runCommand
): Promise<ContractArtifact> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-adopt-fetch-"));
  const outFile = path.join(tempDir, "contract.wasm");
  try {
    await runCommandFn(
      "stellar",
      [
        "contract",
        "fetch",
        "--id",
        spec.contractId,
        "--out-file",
        outFile,
        ...buildStellarNetworkArgs(network),
      ],
      {
        cwd,
        failureCode: CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
        timeout: TRANSACTION_TIMEOUT_MS,
      }
    );

    const wasmHash = await hashWasm(outFile);

    return {
      contractId: spec.contractId,
      wasmHash,
      deployedAt: new Date().toISOString(),
      sourcePath: IMPORTED_SOURCE_MARKER,
      wasmPath: IMPORTED_SOURCE_MARKER,
      dependencies: [],
      resolvedDeployArgs: {},
    };
  } catch (error) {
    if (
      error instanceof CaatingaError &&
      error.code === CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND
    ) {
      throw new CaatingaError(
        `Contract "${spec.name}" is not deployed on "${network.name}" (contract ID ${spec.contractId}).`,
        CaatingaErrorCode.DEPENDENCY_CONTRACT_NOT_FOUND,
        [
          "Verify the contract ID and the --network value; ctg adopt only imports contracts that already exist on-chain.",
          error.hint ? `Stellar CLI diagnostics:\n${error.hint}` : undefined,
        ]
          .filter(Boolean)
          .join("\n\n"),
        error
      );
    }

    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * When an import is given without a name, fall back to the single discovered
 * contract crate. With zero or several crates there is no unambiguous default,
 * so fail loudly instead of guessing.
 */
function resolveDefaultImportName(
  contracts: DiscoveredContract[],
  networkName: string
): string {
  const [singleContract] = contracts;
  if (singleContract) {
    return singleContract.name;
  }

  throw new CaatingaError(
    "Could not infer a name for the imported contract.",
    CaatingaErrorCode.INVALID_CONFIG,
    contracts.length === 0
      ? `No contract crates were discovered in the Cargo workspace — pass --name <name> when importing a contract on ${networkName}.`
      : `Multiple contract crates were discovered — pass --name <name> to pick which one the --contract-id belongs to.`
  );
}

function generateConfigSource(projectName: string, contracts: DiscoveredContract[]): string {
  const contractEntries = contracts
    .map(
      (contract) =>
        `    "${contract.name}": {\n      path: "./${contract.memberPath}",\n      wasm: "${contract.wasmPath}"\n    }`
    )
    .join(",\n");

  return `import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "${projectName}",
  defaultNetwork: "testnet",
  contracts: {
${contractEntries}
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    },
    mainnet: {
      rpcUrl: "https://mainnet.sorobanrpc.com",
      networkPassphrase: "Public Global Stellar Network ; September 2015"
    }
  }
});
`;
}

/**
 * Zero-touch adoption of an existing Soroban Cargo workspace (#294):
 * discovers contract crates, writes `caatinga.config.ts` and a v2
 * `caatinga.artifacts.json` when they are absent, and imports
 * already-deployed contracts by re-deriving their wasmHash on-chain.
 *
 * Nothing pre-existing is ever overwritten: an existing config is left as-is,
 * an existing artifacts file is merged (existing entries win) unless
 * `--force` names the contract to replace.
 */
export async function adoptProject(options: AdoptProjectOptions): Promise<AdoptProjectResult> {
  const cwd = path.resolve(options.cwd);
  const runCommandFn = options.runCommandFn ?? runCommand;
  const loadConfigFn = options.loadConfigFn ?? loadConfig;

  const discovery = await discoverCargoWorkspace(cwd);

  const configPath = path.join(cwd, "caatinga.config.ts");
  const artifactsPath = path.join(cwd, "caatinga.artifacts.json");
  const configExists = await fileExists(configPath);
  const artifactsExists = await fileExists(artifactsPath);

  const network = await resolveAdoptNetwork(cwd, options.networkName, configExists, loadConfigFn);

  // Validate every import before any file is written, so a malformed contract
  // ID can never leave a half-adopted project behind.
  for (const spec of options.imports ?? []) {
    if (!CONTRACT_ID_REGEX.test(spec.contractId)) {
      throw new CaatingaError(
        `Invalid contract ID: ${spec.contractId}`,
        CaatingaErrorCode.INVALID_CONFIG,
        "A contract ID is a `C` prefix followed by 55 base32 characters (A-Z2-7), as printed by ctg deploy."
      );
    }
  }

  const projectName =
    options.projectName ?? discovery.packageName ?? path.basename(cwd);

  const importedContracts: string[] = [];
  const replacedContracts: string[] = [];
  const skippedContracts: string[] = [];

  let configWritten = false;
  if (!configExists) {
    await writeFile(configPath, generateConfigSource(projectName, discovery.contracts), "utf8");
    configWritten = true;
  }

  let artifacts;
  if (!artifactsExists) {
    artifacts = createInitialArtifacts(projectName, { networks: [network.name] });
  } else {
    // Corrupted files fail loudly here on purpose: repair is `ctg doctor --fix`
    // (#222), not a silent adopt-time rewrite.
    artifacts = await readArtifacts(cwd);
  }

  if (options.imports && options.imports.length > 0) {
    const networkRecord = artifacts.networks[network.name] ?? {
      contracts: {},
      dependencyGraph: {},
    };

    for (const spec of options.imports) {
      const name = spec.name ?? resolveDefaultImportName(discovery.contracts, network.name);
      const existing = networkRecord.contracts[name];
      if (existing && !options.force) {
        skippedContracts.push(name);
        continue;
      }

      const imported = await importContractArtifact({ ...spec, name }, network, cwd, runCommandFn);
      networkRecord.contracts[name] = imported;
      importedContracts.push(name);
      if (existing) {
        replacedContracts.push(name);
      }
    }

    artifacts.networks[network.name] = networkRecord;
  }

  await writeArtifacts(artifacts, cwd);

  return {
    workspaceRoot: discovery.workspaceRoot,
    projectName,
    network: network.name,
    configWritten,
    configAlreadyExisted: configExists,
    artifactsWritten: true,
    artifactsAlreadyExisted: artifactsExists,
    discoveredContracts: discovery.contracts,
    importedContracts,
    replacedContracts,
    skippedContracts,
  };
}
