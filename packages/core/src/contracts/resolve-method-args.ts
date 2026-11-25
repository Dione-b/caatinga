import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { CONTRACT_ID_REGEX, STELLAR_ADDRESS_REGEX, STRKEY_BODY } from "../stellar-cli/strkey.js";
import { assertSafeCliArgs, formatNamedCliArgs } from "./format-cli-args.js";
import { resolveSourceAddress } from "./resolve-source-address.js";
import type { DeployArgValue } from "./resolve-deploy-args.js";

export type ResolveMethodArgsOptions = {
  args: Record<string, DeployArgValue>;
  source?: string;
  cwd?: string;
  /** When true, resolve all string values that look like CLI aliases. */
  resolveAliases?: boolean;
};

/** Muxed account strkey (`M` prefix): 55 base32 chars of key plus 13 more for the 64-bit id. */
const MUXED_ADDRESS_REGEX = new RegExp(`^M${STRKEY_BODY}[A-Z2-7]{13}$`);
/** Integer literals, e.g. i128/u64 amounts and ids. */
const INTEGER_REGEX = /^-?\d+$/;
/** 32-byte values in hex, e.g. BytesN<32> hashes. */
const HEX_32_BYTES_REGEX = /^[0-9a-fA-F]{64}$/;

/**
 * Whether a method arg should be resolved with `stellar keys address`. Values that are already
 * on-chain identifiers (account, contract or muxed strkeys) or obvious literals (integers,
 * 32-byte hex) are never aliases, so resolved `${contracts.<name>.contractId}` placeholders,
 * amounts and hashes pass through unchanged.
 */
function looksLikeStellarAlias(value: string): boolean {
  if (
    STELLAR_ADDRESS_REGEX.test(value) ||
    CONTRACT_ID_REGEX.test(value) ||
    MUXED_ADDRESS_REGEX.test(value) ||
    INTEGER_REGEX.test(value) ||
    HEX_32_BYTES_REGEX.test(value)
  ) {
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

const LITERAL_ESCAPE_PREFIX = "\\";

/** Strips a leading backslash escape so `\alice` is treated as the literal string "alice". */
function unescapeLiteral(value: string): string {
  return value.slice(LITERAL_ESCAPE_PREFIX.length);
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
    if (typeof value === "string" && value.startsWith(LITERAL_ESCAPE_PREFIX)) {
      resolved[key] = unescapeLiteral(value);
      continue;
    }

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
          `expected Address (G...), got identity alias "${value}". If the value is a plain String arg, escape it with a leading backslash ("\\${value}") or pass --no-resolve-aliases. Otherwise use ${"${source.address}"} or pass the resolved G... address.`,
          error
        );
      }
      throw error;
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

  assertSafeCliArgs(args);

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
