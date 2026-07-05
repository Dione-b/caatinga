import { evaluateEnvDrift, type EnvDriftReport } from "@caatinga/core";

export type EnvSyncDiagnosticLine = {
  envKey: string;
  envValue?: string;
  expectedValue: string;
  fix: string;
};

export async function evaluateEnvSyncDiagnostics(options: {
  networkName?: string;
}): Promise<{ report: EnvDriftReport | null; lines: EnvSyncDiagnosticLine[] }> {
  const report = await evaluateEnvDrift({ networkName: options.networkName });
  if (!report) {
    return { report: null, lines: [] };
  }

  const lines = report.drifts.map((drift) => ({
    envKey: drift.envKey,
    envValue: drift.envValue,
    expectedValue: drift.expectedValue,
    fix: `Run: npx caatinga sync-env --network ${report.network}`,
  }));

  return { report, lines };
}
