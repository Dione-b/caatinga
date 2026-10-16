import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const WASM_HASH_REGEX = /\b[0-9a-fA-F]{64}\b/g;

/**
 * Returns the WASM hash from `stellar contract upload` output.
 *
 * The CLI prints the WASM hash last, on stdout. When it uploads a new WASM it
 * first logs the transaction hash on stderr ("Signing transaction: <hash>",
 * the explorer link), so with both streams combined the *first* 64-hex token is
 * the transaction, not the WASM. Take the last one.
 */
export function parseWasmHash(output: string): string {
  const match = output.match(WASM_HASH_REGEX)?.at(-1);

  if (!match) {
    throw new CaatingaError(
      "Could not find WASM hash in Stellar CLI output.",
      CaatingaErrorCode.WASM_HASH_NOT_FOUND,
      "Check whether the Stellar CLI upload output format changed."
    );
  }

  return match.toLowerCase();
}
