import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";

export type SyncFrontendEnvOptions = {
  config: CaatingaConfig;
  networkName?: string;
  cwd?: string;
};

export type SyncFrontendEnvResult = {
  envFile: string;
  entries: Array<{ key: string; value: string }>;
};

const NETWORK_ENV_KEYS = new Set(["rpcUrl", "networkPassphrase"]);
const WASM_HASH_PATTERN = /^(.+)\.wasmHash$/;

function formatEnvValue(value: string): string {
  if (/[;\s]/.test(value)) {
    return `"${value.replaceAll('"', '\\"')}"`;
  }
  return value;
}

const ENV_ASSIGNMENT_PATTERN = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/;

async function readExistingEnv(envFile: string): Promise<string | undefined> {
  try {
    return await readFile(envFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

/**
 * Rewrites only the keys Caatinga manages, leaving every other line (unrelated
 * variables, comments, blank lines) byte-identical. Overwriting the whole file
 * would silently destroy user-owned secrets living in the same .env.
 */
function mergeEnvContents(
  existing: string | undefined,
  entries: Array<{ key: string; value: string }>
): string {
  const managed = new Map(
    entries.map(({ key, value }) => [key, `${key}=${formatEnvValue(value)}`])
  );

  if (existing === undefined) {
    return `${[...managed.values()].join("\n")}\n`;
  }

  const written = new Set<string>();
  const hadTrailingNewline = existing.endsWith("\n");
  const lines = (hadTrailingNewline ? existing.slice(0, -1) : existing).split("\n");

  const merged = lines.map((line) => {
    const key = line.match(ENV_ASSIGNMENT_PATTERN)?.[1];
    if (key === undefined || !managed.has(key) || written.has(key)) {
      return line;
    }
    written.add(key);
    const rewritten = managed.get(key) as string;
    // #153: keep a leading `export ` so a file written for shell `source` still
    // exports the managed variables after ctg sync-env rewrites the line.
    return /^\s*export\s+/.test(line) ? `export ${rewritten}` : rewritten;
  });

  const appended = entries
    .filter(({ key }) => !written.has(key))
    .map(({ key }) => managed.get(key) as string);

  if (appended.length > 0 && merged.length > 0 && merged[merged.length - 1]?.trim() !== "") {
    merged.push("");
  }

  return `${[...merged, ...appended].join("\n")}\n`;
}

export async function syncFrontendEnv(
  options: SyncFrontendEnvOptions
): Promise<SyncFrontendEnvResult> {
  const cwd = options.cwd ?? process.cwd();
  const frontend = options.config.frontend;

  if (!frontend?.envFile || !frontend.env) {
    throw new CaatingaError(
      "Frontend env sync is not configured.",
      CaatingaErrorCode.INVALID_CONFIG,
      "Add frontend.envFile and frontend.env to caatinga.config.ts before running ctg sync-env."
    );
  }

  const network = resolveNetwork(options.config, options.networkName);
  const artifacts = await readArtifacts(cwd);
  const networkArtifacts = artifacts.networks[network.name];

  if (!networkArtifacts) {
    throw new CaatingaError(
      `No deployment artifacts found for network "${network.name}".`,
      CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      "Run ctg deploy before ctg sync-env."
    );
  }

  const entries: Array<{ key: string; value: string }> = [];

  for (const [sourceKey, envKey] of Object.entries(frontend.env)) {
    let value: string | undefined;

    if (sourceKey === "rpcUrl") {
      value = network.config.rpcUrl;
    } else if (sourceKey === "networkPassphrase") {
      value = network.config.networkPassphrase;
    } else if (NETWORK_ENV_KEYS.has(sourceKey)) {
      throw new CaatingaError(
        `Unsupported frontend env source key "${sourceKey}".`,
        CaatingaErrorCode.INVALID_CONFIG,
        "Use rpcUrl or networkPassphrase for network values."
      );
    } else {
      const wasmHashMatch = sourceKey.match(WASM_HASH_PATTERN);
      const lookupKey = wasmHashMatch ? wasmHashMatch[1] : sourceKey;

      const contractArtifact = networkArtifacts.contracts[lookupKey];
      if (!contractArtifact?.contractId) {
        throw new CaatingaError(
          `No deployed artifact found for "${lookupKey}" on "${network.name}".`,
          CaatingaErrorCode.ARTIFACT_NOT_FOUND,
          `Deploy ${lookupKey} before running ctg sync-env.`
        );
      }

      value = wasmHashMatch ? contractArtifact.wasmHash : contractArtifact.contractId;
    }

    entries.push({ key: envKey, value });
  }

  const envFile = path.resolve(cwd, frontend.envFile);
  await mkdir(path.dirname(envFile), { recursive: true });

  const body = mergeEnvContents(await readExistingEnv(envFile), entries);
  await writeFile(envFile, body, "utf8");

  return { envFile, entries };
}

export async function computeFrontendEnvEntries(
  options: SyncFrontendEnvOptions
): Promise<SyncFrontendEnvResult> {
  const cwd = options.cwd ?? process.cwd();
  const frontend = options.config.frontend;

  if (!frontend?.envFile || !frontend.env) {
    throw new CaatingaError(
      "Frontend env sync is not configured.",
      CaatingaErrorCode.INVALID_CONFIG,
      "Add frontend.envFile and frontend.env to caatinga.config.ts."
    );
  }

  const network = resolveNetwork(options.config, options.networkName);
  const artifacts = await readArtifacts(cwd);
  const networkArtifacts = artifacts.networks[network.name];

  if (!networkArtifacts) {
    throw new CaatingaError(
      `No deployment artifacts found for network "${network.name}".`,
      CaatingaErrorCode.ARTIFACT_NOT_FOUND,
      "Run ctg deploy before comparing env values."
    );
  }

  const entries: Array<{ key: string; value: string; sourceKey: string }> = [];

  for (const [sourceKey, envKey] of Object.entries(frontend.env)) {
    let value: string | undefined;

    if (sourceKey === "rpcUrl") {
      value = network.config.rpcUrl;
    } else if (sourceKey === "networkPassphrase") {
      value = network.config.networkPassphrase;
    } else if (NETWORK_ENV_KEYS.has(sourceKey)) {
      throw new CaatingaError(
        `Unsupported frontend env source key "${sourceKey}".`,
        CaatingaErrorCode.INVALID_CONFIG,
        "Use rpcUrl or networkPassphrase for network values."
      );
    } else {
      const wasmHashMatch = sourceKey.match(WASM_HASH_PATTERN);
      const lookupKey = wasmHashMatch ? wasmHashMatch[1] : sourceKey;

      const contractArtifact = networkArtifacts.contracts[lookupKey];
      if (!contractArtifact?.contractId) {
        throw new CaatingaError(
          `No deployed artifact found for "${lookupKey}" on "${network.name}".`,
          CaatingaErrorCode.ARTIFACT_NOT_FOUND,
          `Deploy ${lookupKey} before comparing env values.`
        );
      }

      value = wasmHashMatch ? contractArtifact.wasmHash : contractArtifact.contractId;
    }

    entries.push({ key: envKey, value, sourceKey });
  }

  return {
    envFile: path.resolve(cwd, frontend.envFile),
    entries: entries.map(({ key, value }) => ({ key, value })),
  };
}
