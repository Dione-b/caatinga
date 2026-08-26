import type { ContractConfig } from "./config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveDeployOrder } from "../contracts/resolve-deploy-order.js";
import { CONTRACT_ID_PLACEHOLDER_SOURCE } from "../contracts/placeholder-engine.js";

/** Whole-value form of the shared placeholder grammar. */
const CONTRACT_ID_PLACEHOLDER = new RegExp(`^${CONTRACT_ID_PLACEHOLDER_SOURCE}$`);

function parseContractIdPlaceholder(value: string): string | undefined {
  return value.match(CONTRACT_ID_PLACEHOLDER)?.[1];
}

export function validateContractGraph(contracts: Record<string, ContractConfig>): void {
  resolveDeployOrder({ contracts, includeDependencies: true });

  for (const [contractName, config] of Object.entries(contracts)) {
    for (const [argKey, value] of Object.entries(config.deployArgs)) {
      if (typeof value !== "string") {
        continue;
      }

      const referencedContract = parseContractIdPlaceholder(value);
      if (!referencedContract) {
        continue;
      }

      if (!contracts[referencedContract]) {
        throw new CaatingaError(
          `Contract dependency "${referencedContract}" was not found.`,
          CaatingaErrorCode.CONTRACT_DEPENDENCY_NOT_FOUND,
          `Add "${referencedContract}" to caatinga.config.ts or remove it from deployArgs.`
        );
      }

      if (!config.dependsOn.includes(referencedContract)) {
        throw new CaatingaError(
          `Contract "${contractName}" deploy arg "${argKey}" references "${referencedContract}" but "${referencedContract}" is not in dependsOn.`,
          CaatingaErrorCode.INVALID_CONFIG,
          `Add "${referencedContract}" to contracts.${contractName}.dependsOn.`
        );
      }
    }
  }
}
