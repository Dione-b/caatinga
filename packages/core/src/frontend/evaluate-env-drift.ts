import { readFile } from "node:fs/promises";
import path from "node:path";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import { loadConfig } from "../config/load-config.js";
import { computeFrontendEnvEntries } from "./sync-frontend-env.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { hashWasm, resolveWasmArtifactPath } from "../contracts/wasm.js";

export type EnvDriftEntry = {
  envKey: string;
  envValue: string | undefined;
  expectedValue: string;
  sourceKey: string;
};

export type EnvDriftReport = {
  envFile: string;
  network: string;
  drifts: EnvDriftEntry[];
  inSync: boolean;
};

function parseEnvFile(content: string): Map<string, string> {
  const entries = new Map<string, string>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries.set(key, value);
  }

  return entries;
}

export async function evaluateEnvDrift(options: {
  config?: CaatingaConfig;
  networkName?: string;
  cwd?: string;
}): Promise<EnvDriftReport | null> {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config ?? (await loadConfig({ cwd }));
  const frontend = config.frontend;

  if (!frontend?.envFile || !frontend.env) {
    return null;
  }

  const network = resolveNetwork(config, options.networkName);
  const expected = await computeFrontendEnvEntries({
    config,
    networkName: network.name,
    cwd,
  });

  const envPath = path.resolve(cwd, frontend.envFile);
  let envContent = "";
  try {
    envContent = await readFile(envPath, "utf8");
  } catch {
    return {
      envFile: frontend.envFile,
      network: network.name,
      drifts: Object.entries(frontend.env).map(([sourceKey, envKey]) => {
        const match = expected.entries.find((entry) => entry.key === envKey);
        return {
          envKey,
          envValue: undefined,
          expectedValue: match?.value ?? "",
          sourceKey,
        };
      }),
      inSync: false,
    };
  }

  const envEntries = parseEnvFile(envContent);
  const drifts: EnvDriftEntry[] = [];

  for (const [sourceKey, envKey] of Object.entries(frontend.env)) {
    const expectedEntry = expected.entries.find((entry) => entry.key === envKey);
    if (!expectedEntry) {
      continue;
    }

    const actual = envEntries.get(envKey);
    if (actual !== expectedEntry.value) {
      drifts.push({
        envKey,
        envValue: actual,
        expectedValue: expectedEntry.value,
        sourceKey,
      });
    }
  }

  return {
    envFile: frontend.envFile,
    network: network.name,
    drifts,
    inSync: drifts.length === 0,
  };
}

export async function evaluateWasmDrift(options: {
  config?: CaatingaConfig;
  networkName?: string;
  cwd?: string;
}): Promise<
  Array<{
    contract: string;
    localWasmHash?: string;
    artifactWasmHash?: string;
    drift: boolean;
  }>
> {
  const cwd = options.cwd ?? process.cwd();
  const config = options.config ?? (await loadConfig({ cwd }));
  const artifacts = await readArtifacts(cwd);
  // #87: validate the network the same way evaluateEnvDrift does, so an unknown
  // name throws NETWORK_NOT_FOUND instead of silently reporting "no drift".
  const network = resolveNetwork(config, options.networkName);
  const networkName = network.name;
  const networkArtifacts = artifacts.networks[networkName];

  const lines: Array<{
    contract: string;
    localWasmHash?: string;
    artifactWasmHash?: string;
    drift: boolean;
  }> = [];

  for (const [name, contractConfig] of Object.entries(config.contracts)) {
    const artifactHash = networkArtifacts?.contracts[name]?.wasmHash;
    let localHash: string | undefined;

    try {
      const wasmPath = await resolveWasmArtifactPath(contractConfig.wasm, {
        sourcePath: contractConfig.path,
      });
      localHash = await hashWasm(wasmPath);
    } catch {
      localHash = undefined;
    }

    lines.push({
      contract: name,
      localWasmHash: localHash,
      artifactWasmHash: artifactHash,
      drift: Boolean(localHash && artifactHash && localHash !== artifactHash),
    });
  }

  return lines;
}
