import {
  CaatingaError,
  checkStellarSdkVersion,
  type SdkCompatibilityWarning,
} from "@caatinga/core";
import type { Diagnostic, DiagnosticWarning } from "./types.js";

export async function sdkDiagnostic(): Promise<Diagnostic> {
  const warnings: DiagnosticWarning[] = [];

  try {
    const report = await checkStellarSdkVersion({
      onWarning: (warning: SdkCompatibilityWarning) => {
        warnings.push({ code: warning.code, message: warning.message });
      },
    });

    return {
      ok: true,
      label: `@stellar/stellar-sdk ${report.version}`,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    if (error instanceof CaatingaError) {
      return {
        ok: false,
        label: "@stellar/stellar-sdk not ready",
        fix:
          error.hint ??
          "Install @stellar/stellar-sdk ^16.0.1 in your project. See docs/stellar-sdk-version-contract.md.",
      };
    }

    return {
      ok: false,
      label: "@stellar/stellar-sdk not ready",
      fix: "Install @stellar/stellar-sdk ^16.0.1. See docs/stellar-sdk-version-contract.md.",
    };
  }
}
