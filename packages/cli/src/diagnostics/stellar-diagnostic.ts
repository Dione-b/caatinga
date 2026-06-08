import {
  assertSupportedStellarCliVersion,
  CaatingaError,
  parseStellarCliVersion,
  runCommand
} from "@caatinga/core";
import type { Diagnostic } from "./types.js";

export async function stellarDiagnostic(allowUntested: boolean): Promise<Diagnostic> {
  try {
    const result = await runCommand("stellar", ["--version"], {
      skipStellarVersionCheck: true
    });
    const version = assertSupportedStellarCliVersion({
      version: parseStellarCliVersion(result.all || result.stdout || result.stderr),
      allowUntested
    });
    return { ok: true, label: `Stellar CLI ${version}` };
  } catch (error) {
    const hint = error instanceof CaatingaError ? error.hint : undefined;
    return {
      ok: false,
      label: "Stellar CLI not ready",
      fix: hint ?? "Install Stellar CLI: cargo install --locked stellar-cli --version 25.2.0"
    };
  }
}
