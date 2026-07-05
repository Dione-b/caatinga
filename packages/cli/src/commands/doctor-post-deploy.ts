import type { CaatingaConfig } from "@caatinga/core";
import { looksLikeStellarAlias } from "@caatinga/core";

export type PostDeployDiagnosticLine = {
  contract: string;
  method: string;
  arg: string;
  value: string;
  issue: string;
  fix?: string;
};

export function evaluatePostDeployDiagnostics(config: CaatingaConfig): PostDeployDiagnosticLine[] {
  const lines: PostDeployDiagnosticLine[] = [];
  const hooks = [...(config.postDeploy ?? []), ...(config.postDeployRead ?? [])];

  for (const hook of hooks) {
    for (const [arg, value] of Object.entries(hook.args)) {
      if (typeof value === "string" && looksLikeStellarAlias(value)) {
        lines.push({
          contract: hook.contract,
          method: hook.method,
          arg,
          value,
          issue: "CLI alias in method arg — may fail Stellar CLI encoding",
          fix: `Use \${source.address} or a resolved G... address for "${arg}".`,
        });
      }
    }
  }

  return lines;
}
