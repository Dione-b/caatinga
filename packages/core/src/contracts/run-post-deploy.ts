import { readArtifacts } from "../artifacts/read-artifacts.js";
import type { CaatingaConfig, PostDeployHook } from "../config/config.schema.js";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { resolveNetwork } from "../networks/resolve-network.js";
import { requiresMainnetConfirmation } from "../networks/mainnet-guardrails.js";
import { checkBinary } from "../shell/check-binary.js";
import { isTransientCaatingaFailure } from "../shell/is-transient-command-failure.js";
import { runCommand } from "../shell/run-command.js";
import { buildStellarNetworkArgs } from "../stellar-cli/build-stellar-network-args.js";
import { formatNamedCliArgs } from "./format-cli-args.js";
import { readContract } from "./read-contract.js";
import { resolveDeployArgs } from "./resolve-deploy-args.js";
import { resolveMethodArgs } from "./resolve-method-args.js";
import { assertSafeSourceAccount } from "./source-account.js";
import { assertExpect } from "./verify-expect.js";
import { resolvePlaceholders } from "./placeholder-engine.js";
import { resolveSourceAddress } from "./resolve-source-address.js";

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
  kind: "invoke" | "read";
};

const DEFAULT_HOOK_RETRY_DELAYS_MS = [2000, 5000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTransientHookFailure(error: unknown): boolean {
  return isTransientCaatingaFailure(error, CaatingaErrorCode.INVOKE_FAILED);
}

function collectHooks(config: CaatingaConfig): PostDeployHook[] {
  const hooks: PostDeployHook[] = [];

  for (const hook of config.postDeploy ?? []) {
    hooks.push({ ...hook, kind: hook.kind ?? "invoke" });
  }

  for (const hook of config.postDeployRead ?? []) {
    hooks.push({ ...hook, kind: "read" });
  }

  return hooks;
}

async function resolveHookExpect(
  hook: PostDeployHook,
  options: {
    artifacts: Awaited<ReturnType<typeof readArtifacts>>;
    network: string;
    hookSource: string;
    cwd: string;
  }
): Promise<import("../config/config.schema.js").ExpectSpec | undefined> {
  if (hook.expect === undefined) {
    return undefined;
  }

  const isStringPlaceholder = typeof hook.expect === "string" && hook.expect.includes("${");
  const isObjectPlaceholder =
    typeof hook.expect === "object" &&
    typeof hook.expect.value === "string" &&
    hook.expect.value.includes("${");

  if (!isStringPlaceholder && !isObjectPlaceholder) {
    return hook.expect;
  }

  const sourceAddress = await resolveSourceAddress({
    source: options.hookSource,
    cwd: options.cwd,
  });

  const context = {
    artifacts: options.artifacts,
    network: options.network,
    sourceAddress,
  };

  if (isStringPlaceholder) {
    return resolvePlaceholders(hook.expect as string, context);
  }

  const expectObj = hook.expect as Exclude<typeof hook.expect, string | undefined>;
  return {
    ...expectObj,
    value: resolvePlaceholders(expectObj.value as string, context),
  };
}

export async function runPostDeployHooks(
  options: RunPostDeployHooksOptions
): Promise<PostDeployHookResult[]> {
  const cwd = options.cwd ?? process.cwd();
  const hooks = collectHooks(options.config);

  if (hooks.length === 0) {
    return [];
  }

  const network = resolveNetwork(options.config, options.networkName);
  const source = assertSafeSourceAccount(options.source);
  const artifacts = await readArtifacts(cwd);
  const results: PostDeployHookResult[] = [];

  await checkBinary("stellar", "Install Stellar CLI before running ctg wire.");

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
        "Run ctg deploy before ctg wire."
      );
    }

    const hookSource = hook.source ? assertSafeSourceAccount(hook.source) : source;
    const hookKind = hook.kind ?? "invoke";

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

    const methodArgs = await resolveMethodArgs({
      args: resolvedArgs,
      source: hookSource,
      cwd,
    });
    const namedArgs = formatNamedCliArgs(methodArgs);
    let output = "";

    if (hookKind === "read") {
      const readResult = await readContract({
        config: options.config,
        target: `${hook.contract}.${hook.method}`,
        args: namedArgs,
        networkName: network.name,
        source: hookSource,
        cwd,
      });
      output = readResult.result?.trim() ?? "";
    } else {
      const defaultRetryDelays = requiresMainnetConfirmation(network.name, network.config)
        ? []
        : DEFAULT_HOOK_RETRY_DELAYS_MS;
      const retryDelaysMs = options.hookRetryDelaysMs ?? defaultRetryDelays;
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
                kind: hookKind,
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

      output = (result.stdout || result.all || "").trim();
    }

    const resolvedExpect = await resolveHookExpect(hook, {
      artifacts,
      network: network.name,
      hookSource,
      cwd,
    });

    if (resolvedExpect !== undefined) {
      assertExpect(output, resolvedExpect, `"${hook.contract}.${hook.method}"`);
    }

    results.push({
      contract: hook.contract,
      method: hook.method,
      result: output || undefined,
      kind: hookKind,
    });
  }

  return results;
}
