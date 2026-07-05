import { randomUUID } from "node:crypto";
import type { DeployArgValue } from "./resolve-deploy-args.js";

const DEFAULT_FRESH_SYMBOL_KEY = "symbol";

export type FreshSmokeArgsOptions = {
  /** Env var key to override, defaults to `symbol`. */
  symbolKey?: string;
  /** Prefix for generated ephemeral values. */
  prefix?: string;
};

export function createFreshSmokeSymbol(options: FreshSmokeArgsOptions = {}): string {
  const prefix = options.prefix ?? "smoke";
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export function withFreshSmokeArgs(
  args: Record<string, DeployArgValue>,
  options: FreshSmokeArgsOptions = {}
): Record<string, DeployArgValue> {
  const symbolKey = options.symbolKey ?? DEFAULT_FRESH_SYMBOL_KEY;

  return {
    ...args,
    [symbolKey]: createFreshSmokeSymbol(options),
  };
}

export { DEFAULT_FRESH_SYMBOL_KEY };
