import { CaatingaError, checkStellarCliVersion, type CompatibilityWarning } from "@caatinga/core";
import { logger } from "../utils/logger.js";
import type { Diagnostic, DiagnosticWarning } from "./types.js";

export async function stellarDiagnostic(): Promise<Diagnostic> {
  const warnings: DiagnosticWarning[] = [];

  try {
    const report = await checkStellarCliVersion({
      onWarning: (warning: CompatibilityWarning) => {
        warnings.push({ code: warning.code, message: warning.message });
      },
    });

    return {
      ok: true,
      label: `Stellar CLI ${report.version}`,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    if (error instanceof CaatingaError) {
      return {
        ok: false,
        label: "Stellar CLI not ready",
        fix:
          error.hint ?? "Install Stellar CLI: cargo install --locked stellar-cli --version 25.2.0",
      };
    }

    logger.error(String(error));
    return {
      ok: false,
      label: "Stellar CLI not ready",
      fix: "Install Stellar CLI: cargo install --locked stellar-cli --version 25.2.0",
    };
  }
}
