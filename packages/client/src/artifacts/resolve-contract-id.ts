import { CaatingaError, CaatingaErrorCode, type CaatingaArtifacts } from "@caatinga/core/browser";

export function resolveContractId(input: {
  artifacts: CaatingaArtifacts;
  network: string;
  contract: string;
  explicitContractId?: string;
}): string {
  if (input.explicitContractId) {
    return input.explicitContractId;
  }

  const contractId =
    input.artifacts.networks[input.network]?.contracts[input.contract]?.contractId;

  if (contractId) {
    return contractId;
  }

  throw new CaatingaError(
    `No contract artifact found for "${input.contract}" on "${input.network}".`,
    CaatingaErrorCode.CONTRACT_ARTIFACT_NOT_FOUND,
    "Deploy the contract first or pass contractId explicitly."
  );
}
