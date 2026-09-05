import { readFile } from "node:fs/promises";
import path from "node:path";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import { runCommand } from "../shell/run-command.js";
import {
  evaluateStellarSdkCompatibility,
  parseStellarSdkVersion,
  type SdkCompatibilityReport,
  type SdkCompatibilityWarning,
} from "./compat.js";

export type CheckStellarSdkVersionOptions = {
  cwd?: string;
  lastTestedVersion?: string;
  onWarning?: (warning: SdkCompatibilityWarning) => void;
};

async function readInstalledSdkVersion(cwd: string): Promise<string | undefined> {
  try {
    const pkgPath = path.join(cwd, "node_modules", "@stellar", "stellar-sdk", "package.json");
    const raw = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

async function resolveRegistrySdkVersion(): Promise<string> {
  const result = await runCommand("npm", ["view", "@stellar/stellar-sdk", "version"], {
    skipStellarVersionCheck: true,
  });
  return parseStellarSdkVersion(result.stdout || result.all);
}

export async function checkStellarSdkVersion(
  input: CheckStellarSdkVersionOptions = {}
): Promise<SdkCompatibilityReport> {
  const cwd = input.cwd ?? process.cwd();
  let version: string;

  try {
    const installed = await readInstalledSdkVersion(cwd);
    version = installed ?? (await resolveRegistrySdkVersion());
  } catch (error) {
    if (error instanceof CaatingaError) {
      throw error;
    }

    throw new CaatingaError(
      "Could not resolve @stellar/stellar-sdk version.",
      CaatingaErrorCode.STELLAR_SDK_VERSION_PARSE_FAILED,
      "Install @stellar/stellar-sdk in your project or ensure npm registry access.",
      error
    );
  }

  const report = evaluateStellarSdkCompatibility({
    version,
    lastTestedVersion: input.lastTestedVersion,
  });

  for (const warning of report.warnings) {
    if (input.onWarning) {
      input.onWarning(warning);
    } else {
      defaultEmitWarning(warning);
    }
  }

  return report;
}

function defaultEmitWarning(_warning: SdkCompatibilityWarning): void {
  // Intentionally a no-op: library consumers and browser builds should not
  // receive unsolicited stderr output.  Supply an `onWarning` callback to
  // handle warnings explicitly.
}
