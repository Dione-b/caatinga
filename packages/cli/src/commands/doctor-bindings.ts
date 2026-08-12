import {
  evaluateBindingsFreshness,
  frontendBindingsConfigHint,
  loadConfig,
  readArtifacts,
  resolveNetwork,
  type BindingFreshnessStatus,
} from "@caatinga/core";
import { npxCli } from "../utils/cli-name.js";

export type BindingCoverageLine = {
  name: string;
  status: BindingFreshnessStatus;
  reason?: string;
  fix?: string;
};

/**
 * Suggesting `generate` when no frontend is configured sends the user to a command that
 * fails with CAATINGA_INVALID_CONFIG; point at the config fix instead.
 */
function bindingFix(
  frontendUnconfigured: boolean,
  contractName: string,
  networkName: string
): { fix?: string } {
  if (frontendUnconfigured) {
    return { fix: frontendBindingsConfigHint() };
  }

  return { fix: `Run: ${npxCli(`generate ${contractName} --network ${networkName}`)}` };
}

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
      : bindingFix(entry.frontendUnconfigured === true, entry.contractName, network.name)),
  }));

  return { lines, allFresh: lines.every((line) => line.status === "fresh") };
}
