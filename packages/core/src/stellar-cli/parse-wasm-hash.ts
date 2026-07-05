import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const WASM_HASH_REGEX = /\b[0-9a-fA-F]{64}\b/;

export function parseWasmHash(output: string): string {
  const match = output.match(WASM_HASH_REGEX);

  if (!match) {
    throw new CaatingaError(
      "Could not find WASM hash in Stellar CLI output.",
      CaatingaErrorCode.WASM_HASH_NOT_FOUND,
      "Check whether the Stellar CLI upload output format changed."
    );
  }

  return match[0].toLowerCase();
}
