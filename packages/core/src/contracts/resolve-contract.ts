import path from "node:path";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { ContractConfig, CaatingaConfig } from "../config/config.schema.js";

export type ResolvedContract = {
  name: string;
  config: ContractConfig;
  sourcePath: string;
  wasmPath: string;
};

export function resolveContract(
  config: CaatingaConfig,
  contractName: string,
  cwd = process.cwd()
): ResolvedContract {
  const contract = config.contracts[contractName];

  if (!contract) {
    throw new CaatingaError(
      `Contract "${contractName}" is not configured.`,
      CaatingaErrorCode.CONTRACT_NOT_FOUND,
      `Add "${contractName}" to caatinga.config.ts contracts, or pass a configured contract name.`
    );
  }

  return {
    name: contractName,
    config: contract,
    sourcePath: path.resolve(cwd, contract.path),
    wasmPath: path.resolve(cwd, contract.wasm),
  };
}
