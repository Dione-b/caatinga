import type { CaatingaInvokeOptions, CaatingaReadOptions } from "../types.js";

export function splitArgsAndOptions(
  argsOrOptions?: Record<string, unknown>,
  maybeOptions?: { debugRaw?: boolean }
) {
  return {
    args: argsOrOptions,
    debugRaw: maybeOptions?.debugRaw ?? false
  };
}

export function splitInvokeArgsAndOptions(
  argsOrOptions?: Record<string, unknown> | CaatingaInvokeOptions,
  maybeOptions?: CaatingaInvokeOptions
) {
  const looksLikeOptions =
    argsOrOptions !== undefined &&
    ("debugXdr" in argsOrOptions || "debugRaw" in argsOrOptions) &&
    maybeOptions === undefined;

  if (looksLikeOptions) {
    const options = argsOrOptions as CaatingaInvokeOptions;
    return {
      args: undefined,
      debugXdr: options.debugXdr ?? false,
      debugRaw: options.debugRaw ?? false
    };
  }

  return {
    args: argsOrOptions as Record<string, unknown> | undefined,
    debugXdr: maybeOptions?.debugXdr ?? false,
    debugRaw: maybeOptions?.debugRaw ?? false
  };
}

export function splitReadArgsAndOptions(
  argsOrOptions?: Record<string, unknown> | CaatingaReadOptions,
  maybeOptions?: CaatingaReadOptions
) {
  const looksLikeOptions =
    argsOrOptions !== undefined &&
    "debugRaw" in argsOrOptions &&
    maybeOptions === undefined;

  if (looksLikeOptions) {
    const options = argsOrOptions as CaatingaReadOptions;
    return {
      args: undefined,
      debugRaw: options.debugRaw ?? false
    };
  }

  return {
    args: argsOrOptions as Record<string, unknown> | undefined,
    debugRaw: maybeOptions?.debugRaw ?? false
  };
}
