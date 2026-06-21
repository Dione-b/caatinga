import { readArtifacts } from "./read-artifacts.js";
import { restoreArtifactFromHistory } from "./update-artifact.js";
import { writeArtifacts } from "./write-artifacts.js";

export async function rollbackContractArtifact(input: {
  networkName: string;
  contractName: string;
  contractId: string;
  cwd?: string;
}) {
  const cwd = input.cwd ?? process.cwd();
  const artifacts = await readArtifacts(cwd);
  const next = restoreArtifactFromHistory({
    artifacts,
    networkName: input.networkName,
    contractName: input.contractName,
    contractId: input.contractId,
  });
  const path = await writeArtifacts(next, cwd);
  return { path, artifacts: next };
}
