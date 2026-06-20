import { CaatingaError, CaatingaErrorCode } from "@caatinga/core/browser";
import { CaatingaContractClient } from "./caatinga-contract-client.js";
import type { CaatingaClientConfig } from "../types.js";

export function createCaatingaClient(config: CaatingaClientConfig) {
  return {
    contract(contractName: string) {
      const registration = config.contracts[contractName];

      if (!registration) {
        throw new CaatingaError(
          `Contract "${contractName}" is not registered.`,
          CaatingaErrorCode.CONTRACT_NOT_FOUND,
          "Add the contract binding to createCaatingaClient()."
        );
      }

      return new CaatingaContractClient(config, contractName, registration);
    },
  };
}
