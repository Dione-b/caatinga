import type { CaatingaInvokeOptions, CaatingaReadOptions } from "../types.js";
import { normalizeReadSourceAccount } from "./read-source.js";

const INVOKE_OPTION_KEYS: readonly string[] = ["debugXdr", "debugRaw"];
const READ_OPTION_KEYS: readonly string[] = ["debugRaw", "sourceAccount"];

/**
 * A single object is only treated as options when it has at least one key and every key is
 * a known option key. Contract args are never inspected, so an argument named
 * `sourceAccount` (or any other object) is forwarded to the method instead of being
 * dropped. Pass options as the second argument when a method takes args and options.
 */
function isOptionsObject(value: object | null | undefined, optionKeys: readonly string[]): boolean {
  if (value === undefined || value === null || typeof value !== "object") {
    return false;
  }

  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => optionKeys.includes(key));
}

export function splitArgsAndOptions(
  argsOrOptions?: Record<string, unknown>,
  maybeOptions?: { debugRaw?: boolean }
) {
  return {
    args: argsOrOptions,
    debugRaw: maybeOptions?.debugRaw ?? false,
  };
}

export function splitInvokeArgsAndOptions(
  argsOrOptions?: Record<string, unknown> | CaatingaInvokeOptions,
  maybeOptions?: CaatingaInvokeOptions
) {
  const looksLikeOptions =
    argsOrOptions !== undefined &&
    ("debugXdr" in argsOrOptions || "debugRaw" in argsOrOptions || "restore" in argsOrOptions) &&
    maybeOptions === undefined;

  if (looksLikeOptions) {
    const options = argsOrOptions as CaatingaInvokeOptions;
    return {
      args: undefined,
      debugXdr: options.debugXdr ?? false,
      debugRaw: options.debugRaw ?? false,
      restore: options.restore ?? false,
    };
  }

  return {
    args: argsOrOptions as Record<string, unknown> | undefined,
    debugXdr: maybeOptions?.debugXdr ?? false,
    debugRaw: maybeOptions?.debugRaw ?? false,
    restore: maybeOptions?.restore ?? false,
  };
}

export function splitReadArgsAndOptions(
  argsOrOptions?: Record<string, unknown> | CaatingaReadOptions,
  maybeOptions?: CaatingaReadOptions
) {
  if (maybeOptions === undefined && isOptionsObject(argsOrOptions, READ_OPTION_KEYS)) {
    const options = argsOrOptions as CaatingaReadOptions;
    return {
      args: undefined,
      debugRaw: options.debugRaw ?? false,
      sourceAccount: normalizeReadSourceAccount(options.sourceAccount),
    };
  }

  return {
    args: argsOrOptions as Record<string, unknown> | undefined,
    debugRaw: maybeOptions?.debugRaw ?? false,
    sourceAccount: normalizeReadSourceAccount(maybeOptions?.sourceAccount),
  };
}
