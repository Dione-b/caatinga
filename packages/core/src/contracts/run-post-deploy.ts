import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { checkBinary } from "../shell/check-binary.js";
import { isTransientCommandFailure } from "../shell/is-transient-command-failure.js";
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
  onTransientHookRetry?: (info: {
    hook: PostDeployHookResult;
    attempt: number;
    maxAttempts: number;
    delayMs: number;
  }) => void;
  /** Override retry backoff delays (primarily for tests). */
  hookRetryDelaysMs?: readonly number[];
};

export type PostDeployHookResult = {
  contract: string;
  method: string;
  result?: string;
};

const DEFAULT_HOOK_RETRY_DELAYS_MS = [2000, 5000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTransientHookFailure(error: unknown): boolean {
  if (!(error instanceof CaatingaError) || error.code !== CaatingaErrorCode.INVOKE_FAILED) {
    return false;
  }

  return isTransientCommandFailure(`${error.message}\n${error.hint ?? ""}`);
}

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

    const hookSource = hook.source ?? source;

    const resolvedArgs = await resolveDeployArgs({
      deployArgs: hook.args,
      artifacts,
      network: network.name,
      source: hookSource,
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
    const retryDelaysMs = options.hookRetryDelaysMs ?? DEFAULT_HOOK_RETRY_DELAYS_MS;
    const maxHookAttempts = retryDelaysMs.length + 1;
    let result: { stdout: string; stderr: string; all: string } = undefined!;

    for (let attempt = 0; attempt < maxHookAttempts; attempt++) {
      try {
        result = await runCommand(
          "stellar",
          [
            "contract",
            "invoke",
            "--id",
            contractArtifact.contractId,
            "--source-account",
            hookSource,
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
        break;
      } catch (error) {
        const isLastAttempt = attempt === maxHookAttempts - 1;
        if (!isTransientHookFailure(error) || isLastAttempt) {
          throw error;
        }

        const delayMs = retryDelaysMs[attempt];
        try {
          options.onTransientHookRetry?.({
            hook: {
              contract: hook.contract,
              method: hook.method,
            },
            attempt: attempt + 1,
            maxAttempts: maxHookAttempts,
            delayMs,
          });
        } catch {
          // Callback error is non-fatal; original transient error takes precedence.
        }
        await sleep(delayMs);
      }
    }

    if (hook.expect !== undefined) {
      const resolvedExpect = await resolveDeployArgs({
        deployArgs: { expected: hook.expect },
        artifacts,
        network: network.name,
        source: hookSource,
        cwd,
      });

      const actual = (result.stdout || result.all || "").trim();
      const expected = String(resolvedExpect.expected).trim();

      if (actual !== expected) {
        throw new CaatingaError(
          `Post-deploy verification failed for "${hook.contract}.${hook.method}".`,
          CaatingaErrorCode.POST_DEPLOY_VERIFY_FAILED,
          `Expected "${expected}" but got "${actual}".`
        );
      }
    }

    results.push({
      contract: hook.contract,
      method: hook.method,
      result: (result.stdout || result.all || "").trim() || undefined,
    });
  }

  return results;
}
