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

  const contractId = input.artifacts.networks[input.network]?.contracts[input.contract]?.contractId;

  if (contractId) {
    return contractId;
  }

  const hint = formatMissingContractArtifactHint(input.artifacts, input.network, input.contract);

  throw new CaatingaError(
    `No contract artifact found for "${input.contract}" on "${input.network}".`,
    CaatingaErrorCode.CONTRACT_ARTIFACT_NOT_FOUND,
    hint
  );
}

function formatMissingContractArtifactHint(
  artifacts: CaatingaArtifacts,
  network: string,
  contract: string
): string {
  const deployCommand = `caatinga deploy ${contract} --network ${network} --source <identity>`;
  const buildNote = "caatinga build does not register a contract ID.";

  if (Object.keys(artifacts.networks).length === 0) {
    return [
      "caatinga.artifacts.json has no network scaffold.",
      `Run caatinga doctor --network ${network} to inspect deploy readiness, then run: ${deployCommand}.`,
      buildNote,
      "Or pass contractId in the client registration.",
    ].join(" ");
  }

  if (!artifacts.networks[network]) {
    return [
      `No artifacts exist for network "${network}".`,
      `Run: ${deployCommand}.`,
      buildNote,
      "Or pass contractId in the client registration.",
    ].join(" ");
  }

  return [
    `Contract "${contract}" is not deployed on "${network}".`,
    `Run: ${deployCommand}.`,
    "Or pass contractId in the client registration.",
  ].join(" ");
}
