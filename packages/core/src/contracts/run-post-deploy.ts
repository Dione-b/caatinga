import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { formatNamedCliArgs } from "./format-cli-args.js";
import { resolveDeployArgs } from "./resolve-deploy-args.js";
import { assertSafeSourceAccount } from "./source-account.js";

export type RunPostDeployHooksOptions = {
  config: CaatingaConfig;
  networkName?: string;
  source?: string;
  cwd?: string;
};

export type PostDeployHookResult = {
  contract: string;
  method: string;
  result?: string;
};

export async function runPostDeployHooks(
  options: RunPostDeployHooksOptions
): Promise<PostDeployHookResult[]> {
  const cwd = options.cwd ?? process.cwd();
  const hooks = options.config.postDeploy;

  if (!hooks || hooks.length === 0) {
    return [];
  }

  const network = resolveNetwork(options.config, options.networkName);
  const source = assertSafeSourceAccount(options.source);
  const artifacts = await readArtifacts(cwd);
  const results: PostDeployHookResult[] = [];

  await checkBinary("stellar", "Install Stellar CLI before running caatinga wire.");

  for (const hook of hooks) {
    if (!options.config.contracts[hook.contract]) {
      throw new CaatingaError(
        `Post-deploy hook references unknown contract "${hook.contract}".`,
        CaatingaErrorCode.INVALID_CONFIG,
        "Fix postDeploy entries in caatinga.config.ts."
      );
    }

    const contractArtifact = artifacts.networks[network.name]?.contracts[hook.contract];
    if (!contractArtifact?.contractId) {
      throw new CaatingaError(
        `No deployed artifact found for "${hook.contract}" on "${network.name}".`,
        CaatingaErrorCode.ARTIFACT_NOT_FOUND,
        "Run caatinga deploy before caatinga wire."
      );
    }

    const resolvedArgs = await resolveDeployArgs({
      deployArgs: hook.args,
      artifacts,
      network: network.name,
      source,
      cwd,
    });

    for (const value of Object.values(resolvedArgs)) {
      if (typeof value === "string" && value.includes("${")) {
        throw new CaatingaError(
          `Post-deploy args for "${hook.contract}.${hook.method}" still contain unresolved placeholders.`,
          CaatingaErrorCode.DEPLOY_ARG_PLACEHOLDER_UNRESOLVED,
          "Deploy all dependencies first or fix postDeploy args in caatinga.config.ts."
        );
      }
    }

    const namedArgs = formatNamedCliArgs(resolvedArgs);

    const result = await runCommand(
      "stellar",
      [
        "contract",
        "invoke",
        "--id",
        contractArtifact.contractId,
        "--source-account",
        source,
        ...buildStellarNetworkArgs(network),
        "--",
        hook.method,
        ...namedArgs,
      ],
      {
        cwd,
        failureCode: CaatingaErrorCode.INVOKE_FAILED,
      }
    );

    results.push({
      contract: hook.contract,
      method: hook.method,
      result: (result.stdout || result.all || "").trim() || undefined,
    });
  }

  return results;
}
