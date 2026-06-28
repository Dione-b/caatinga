import path from "node:path";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { resolveContract } from "./resolve-contract.js";
import { CURRENT_RUST_WASM_TARGET, resolveWasmArtifactPath } from "./wasm.js";

export type BuildWorkspaceOptions = {
  config: CaatingaConfig;
  cwd?: string;
};

const MISSING_WASM_TARGET_HINT_SUBSTRINGS = [
  "not installed",
  "not found",
  "needs to be installed",
  "add the",
  "rustup target",
] as const;

function isMissingRustWasmTargetError(error: unknown): boolean {
  if (!(error instanceof CaatingaError)) {
    return false;
  }

  const parts = [
    error.message,
    error.hint ?? "",
    error.cause === undefined ? "" : String(error.cause),
  ];
  const haystack = parts.join("\n").toLowerCase();

  if (!haystack.includes(CURRENT_RUST_WASM_TARGET)) {
    return false;
  }

  return MISSING_WASM_TARGET_HINT_SUBSTRINGS.some((needle) => haystack.includes(needle));
}

export async function buildWorkspace(options: BuildWorkspaceOptions) {
  const cwd = options.cwd ?? process.cwd();
  const buildRoot = options.config.buildRoot;

  if (!buildRoot) {
    throw new CaatingaError(
      "Workspace build requires buildRoot in caatinga.config.ts.",
      CaatingaErrorCode.INVALID_CONFIG,
      'Set buildRoot: "." for Cargo workspaces that build from the repository root.'
    );
  }

  const hasBuildFeatures = Object.values(options.config.contracts).some(
    (c) => c.buildFeatures && c.buildFeatures.length > 0
  );
  if (hasBuildFeatures) {
    console.warn(
      "Warning: buildFeatures is set on one or more contracts but is ignored in workspace builds (buildRoot). " +
        "Use individual contract builds (caatinga build <contract>) to apply buildFeatures."
    );
  }

  const buildPath = path.resolve(cwd, buildRoot);

  await checkBinary("rustc", "Install Rust before running caatinga build.");
  await checkBinary("stellar", "Install Stellar CLI before running caatinga build.");

  let result;
  try {
    result = await runCommand("stellar", ["contract", "build"], {
      cwd: buildPath,
      failureCode: CaatingaErrorCode.BUILD_FAILED,
    });
  } catch (error) {
    if (
      error instanceof CaatingaError &&
      error.code === CaatingaErrorCode.BUILD_FAILED &&
      isMissingRustWasmTargetError(error)
    ) {
      throw new CaatingaError(
        `Required Rust wasm target "${CURRENT_RUST_WASM_TARGET}" is missing.`,
        CaatingaErrorCode.RUST_TARGET_NOT_FOUND,
        `Run \`rustup target add ${CURRENT_RUST_WASM_TARGET}\` and retry.`,
        error
      );
    }
    throw error;
  }

  const contracts = await Promise.all(
    Object.keys(options.config.contracts).map(async (contractName) => {
      const contract = resolveContract(options.config, contractName, cwd);
      const wasmPath = await resolveWasmArtifactPath(contract.wasmPath, {
        sourcePath: contract.sourcePath,
      });
      return {
        ...contract,
        wasmPath,
      };
    })
  );

  return {
    buildPath,
    contracts,
    output: result.all || result.stdout,
  };
}
