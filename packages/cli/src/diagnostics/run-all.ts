import type { CaatingaConfig } from "@caatinga/core";
import { loadConfig } from "@caatinga/core";
import type { Diagnostic } from "./types.js";
import { dependenciesDiagnostic } from "./dependencies-diagnostic.js";
import { artifactsDiagnostic, configDiagnostic, networkDiagnostic } from "./project-diagnostic.js";
import { nodeDiagnostic } from "./node-diagnostic.js";
import { rustDiagnostic, wasmTargetDiagnostic } from "./rust-diagnostic.js";
import { sdkDiagnostic } from "./sdk-diagnostic.js";
import { sourceDiagnostic } from "./source-diagnostic.js";
import { stellarDiagnostic } from "./stellar-diagnostic.js";

export type RunAllDiagnosticsOptions = {
  network?: string;
  source?: string;
};

export type RunAllDiagnosticsResult = {
  diagnostics: Diagnostic[];
  config: CaatingaConfig | undefined;
};

export async function runAllDiagnostics(
  options: RunAllDiagnosticsOptions
): Promise<RunAllDiagnosticsResult> {
  let config: CaatingaConfig | undefined;
  try {
    config = await loadConfig();
  } catch {
    // Config may not load; diagnostics will report the issue.
  }

  const diagnostics = [
    nodeDiagnostic(),
    await stellarDiagnostic(),
    await sdkDiagnostic(),
    await rustDiagnostic(),
    await wasmTargetDiagnostic(),
    await dependenciesDiagnostic(),
    await configDiagnostic(),
    await artifactsDiagnostic(),
    await networkDiagnostic(options.network),
    await sourceDiagnostic(options.source),
  ].filter((diagnostic): diagnostic is Diagnostic => diagnostic !== undefined);

  return { diagnostics, config };
}
