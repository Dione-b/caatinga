import { loadConfig, readArtifacts, resolveNetwork } from "@caatinga/core";

export type DeployCoverageLine = {
  name: string;
  ok: boolean;
  contractId?: string;
  fix?: string;
};

export async function evaluateDeployCoverage(options: {
  networkName: string;
  cwd?: string;
}): Promise<{ lines: DeployCoverageLine[]; complete: boolean }> {
  const cwd = options.cwd;
  const config = await loadConfig({ cwd });
  const network = resolveNetwork(config, options.networkName);
  const artifacts = await readArtifacts(cwd);
  const lines: DeployCoverageLine[] = [];

  for (const name of Object.keys(config.contracts)) {
    const contractId = artifacts.networks[network.name]?.contracts[name]?.contractId;
    if (contractId) {
      lines.push({ name, ok: true, contractId });
    } else {
      lines.push({
        name,
        ok: false,
        fix: `Run: caatinga deploy ${name} --network ${network.name}`
      });
    }
  }

  return { lines, complete: lines.every((line) => line.ok) };
}
