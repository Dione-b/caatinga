import {
  evaluateBindingsFreshness,
  loadConfig,
  readArtifacts,
  resolveNetwork,
  type BindingFreshnessStatus,
} from "@caatinga/core";

export type BindingCoverageLine = {
  name: string;
  status: BindingFreshnessStatus;
  reason?: string;
  fix?: string;
};

export async function evaluateBindingCoverage(options: {
  networkName: string;
  cwd?: string;
}): Promise<{ lines: BindingCoverageLine[]; allFresh: boolean }> {
  const cwd = options.cwd;
  const config = await loadConfig({ cwd });
  const network = resolveNetwork(config, options.networkName);
  const artifacts = await readArtifacts(cwd);

  const freshness = await evaluateBindingsFreshness({
    config,
    artifacts,
    networkName: network.name,
    cwd,
  });

  const lines: BindingCoverageLine[] = freshness.map((entry) => ({
    name: entry.contractName,
    status: entry.status,
    reason: entry.reason,
    ...(entry.status === "fresh"
      ? {}
      : { fix: `Run: caatinga generate ${entry.contractName} --network ${network.name}` }),
  }));

  return { lines, allFresh: lines.every((line) => line.status === "fresh") };
}
