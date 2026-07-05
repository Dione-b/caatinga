import type { ResolvedNetwork } from "../networks/resolve-network.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { parseWasmHash } from "../stellar-cli/parse-wasm-hash.js";
import { assertSafeSourceAccount } from "./source-account.js";
import { hashWasm } from "./wasm.js";

export type UploadWasmOptions = {
  wasmPath: string;
  network: ResolvedNetwork;
  source?: string;
  cwd?: string;
  expectedHash?: string;
};

export type UploadWasmResult = {
  wasmHash: string;
  output: string;
};

export async function uploadWasm(options: UploadWasmOptions): Promise<UploadWasmResult> {
  const cwd = options.cwd ?? process.cwd();
  const source = assertSafeSourceAccount(options.source);
  const localHash = await hashWasm(options.wasmPath);

  if (options.expectedHash !== undefined && localHash !== options.expectedHash.toLowerCase()) {
    throw new CaatingaError(
      `Local WASM hash "${localHash}" does not match --expected-hash "${options.expectedHash}".`,
      CaatingaErrorCode.INVALID_CONFIG,
      "Rebuild the contract or pass the correct --expected-hash value."
    );
  }

  await checkBinary("stellar", "Install Stellar CLI before uploading contract WASM.");

  const result = await runCommand(
    "stellar",
    [
      "contract",
      "upload",
      "--wasm",
      options.wasmPath,
      "--source-account",
      source,
      ...buildStellarNetworkArgs(options.network),
    ],
    {
      cwd,
      failureCode: CaatingaErrorCode.UPLOAD_FAILED,
    }
  );

  const output = result.all || `${result.stdout}\n${result.stderr}`;
  const uploadedHash = parseWasmHash(output);

  if (uploadedHash !== localHash) {
    throw new CaatingaError(
      `Uploaded WASM hash "${uploadedHash}" does not match local hash "${localHash}".`,
      CaatingaErrorCode.UPLOAD_FAILED,
      "Verify the WASM file path and rebuild if needed."
    );
  }

  return {
    wasmHash: uploadedHash,
    output,
  };
}
