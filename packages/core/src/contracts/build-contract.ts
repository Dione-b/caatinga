import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { resolveContract } from "./resolve-contract.js";
import { CURRENT_RUST_WASM_TARGET, resolveWasmArtifactPath } from "./wasm.js";

export type BuildContractOptions = {
  config: CaatingaConfig;
  contractName: string;
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

export async function buildContract(options: BuildContractOptions) {
  const cwd = options.cwd ?? process.cwd();
  const contract = resolveContract(options.config, options.contractName, cwd);

  await checkBinary("rustc", "Install Rust before running caatinga build.");
  await checkBinary("stellar", "Install Stellar CLI before running caatinga build.");

  let result;
  try {
    const contractConfig = options.config.contracts[options.contractName];
    const buildArgs = ["contract", "build", ...(contractConfig.buildFeatures ?? [])];
    result = await runCommand("stellar", buildArgs, {
      cwd: contract.sourcePath,
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

  const wasmPath = await resolveWasmArtifactPath(contract.wasmPath, {
    sourcePath: contract.sourcePath,
  });

  return {
    contract: {
      ...contract,
      wasmPath,
    },
    output: result.all || result.stdout,
  };
}
