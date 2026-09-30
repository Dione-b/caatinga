import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { isMainnetNetwork } from "../networks/mainnet-guardrails.js";
import type { ResolvedNetwork } from "../networks/resolve-network.js";
import { validateSourceShape } from "./validate-source-shape.js";

export function assertSafeSourceAccount(source: string | undefined): string {
  if (!source) {
    throw new CaatingaError(
      "A source account or Stellar CLI identity is required.",
      CaatingaErrorCode.SOURCE_ACCOUNT_REQUIRED,
      "Pass a Stellar CLI identity alias, for example: --source alice"
    );
  }

  const unsafeSource = validateSourceShape(source);
  if (unsafeSource) {
    throw unsafeSource;
  }

  return source;
}

/** Identity used when neither --source nor CAATINGA_SOURCE is provided. */
export const DEFAULT_CLI_SOURCE = "alice";

/** Where a resolved CLI source value came from, for honest disclosure to users. */
export type CliSourceOrigin = "explicit" | "env" | "default";

export type ResolvedCliSource = {
  source: string;
  origin: CliSourceOrigin;
};

type DescribeCliSourceOptions = {
  /**
   * Target network. On mainnet the built-in `alice` fallback is refused: an
   * identity the user never chose must not act on mainnet.
   */
  network?: ResolvedNetwork;
};

/**
 * Resolve the CLI source identity and report where the value came from so the
 * CLI can disclose an implicit fallback instead of silently signing/simulating
 * as `alice`.
 */
export function describeCliSource(
  explicit?: string,
  options: DescribeCliSourceOptions = {}
): ResolvedCliSource {
  if (explicit) {
    return { source: assertSafeSourceAccount(explicit), origin: "explicit" };
  }

  const fromEnv = process.env.CAATINGA_SOURCE;
  if (fromEnv) {
    return { source: assertSafeSourceAccount(fromEnv), origin: "env" };
  }

  if (options.network && isMainnetNetwork(options.network.name, options.network.config)) {
    throw new CaatingaError(
      `A source identity is required on mainnet network "${options.network.name}".`,
      CaatingaErrorCode.SOURCE_ACCOUNT_REQUIRED,
      `Caatinga does not fall back to "${DEFAULT_CLI_SOURCE}" on mainnet. Pass --source <alias> or set CAATINGA_SOURCE.`
    );
  }

  return { source: assertSafeSourceAccount(DEFAULT_CLI_SOURCE), origin: "default" };
}

export function resolveCliSource(
  explicit?: string,
  options: DescribeCliSourceOptions = {}
): string {
  return describeCliSource(explicit, options).source;
}
