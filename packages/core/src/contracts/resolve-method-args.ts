import { CaatingaError, CaatingaErrorCode, toCaatingaError } from "../errors/CaatingaError.js";
import { formatNamedCliArgs } from "./format-cli-args.js";
import { resolveSourceAddress } from "./resolve-source-address.js";
import type { DeployArgValue } from "./resolve-deploy-args.js";

const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

export type ResolveMethodArgsOptions = {
  args: Record<string, DeployArgValue>;
  source?: string;
  cwd?: string;
  /** When true, resolve all string values that look like CLI aliases. */
  resolveAliases?: boolean;
};

function looksLikeStellarAlias(value: string): boolean {
  if (STELLAR_ADDRESS_REGEX.test(value)) {
    return false;
  }

  if (value.includes("${") || value.includes(" ") || value.includes("/")) {
    return false;
  }

  if (value.length < 3) {
    return false;
  }

  return /^[A-Za-z0-9_-]+$/.test(value);
}

export async function resolveMethodArgs(
  options: ResolveMethodArgsOptions
): Promise<Record<string, DeployArgValue>> {
  const resolveAliases = options.resolveAliases ?? true;
  if (!resolveAliases) {
    return options.args;
  }

  const resolved: Record<string, DeployArgValue> = {};

  for (const [key, value] of Object.entries(options.args)) {
    if (typeof value !== "string" || !looksLikeStellarAlias(value)) {
      resolved[key] = value;
      continue;
    }

    try {
      resolved[key] = await resolveSourceAddress({
        source: value,
        cwd: options.cwd,
      });
    } catch (error) {
      if (error instanceof CaatingaError) {
        throw new CaatingaError(
          `Method arg "${key}" looks like a CLI identity alias but could not be resolved to an Address.`,
          CaatingaErrorCode.ADDRESS_ALIAS_UNRESOLVED,
          `expected Address (G...), got identity alias "${value}". Use ${"${source.address}"} or pass the resolved G... address.`,
          error
        );
      }
      throw toCaatingaError(error);
    }
  }

  return resolved;
}

export function parseNamedCliArgs(args: readonly string[]): Record<string, string> {
  const named: Record<string, string> = {};

  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      continue;
    }

    named[key] = value;
    index += 1;
  }

  return named;
}

export async function resolveCliMethodArgs(
  args: readonly string[],
  options: { source?: string; cwd?: string; resolveAliases?: boolean } = {}
): Promise<string[]> {
  if (args.length === 0) {
    return [];
  }

  const named = parseNamedCliArgs(args);
  if (Object.keys(named).length === 0) {
    return [...args];
  }

  const resolved = await resolveMethodArgs({
    args: named,
    source: options.source,
    cwd: options.cwd,
    resolveAliases: options.resolveAliases,
  });

  return formatNamedCliArgs(resolved);
}

export { STELLAR_ADDRESS_REGEX, looksLikeStellarAlias };
