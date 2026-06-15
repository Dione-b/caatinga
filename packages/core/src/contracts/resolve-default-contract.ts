import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

export function resolveDefaultContractName(config: CaatingaConfig): string {
  const names = Object.keys(config.contracts);
  if (names.length === 1) {
    return names[0]!;
  }

  throw new CaatingaError(
    "Pass a contract name to build.",
    CaatingaErrorCode.CONTRACT_NOT_FOUND,
    `Configured contracts: ${names.join(", ")}. Example: caatinga build ${names[0]}`
  );
}
