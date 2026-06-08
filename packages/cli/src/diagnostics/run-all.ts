import type { Diagnostic } from "./types.js";
import { artifactsDiagnostic, configDiagnostic, networkDiagnostic } from "./project-diagnostic.js";
import { nodeDiagnostic } from "./node-diagnostic.js";
import { rustDiagnostic, wasmTargetDiagnostic } from "./rust-diagnostic.js";
import { sourceDiagnostic } from "./source-diagnostic.js";
import { stellarDiagnostic } from "./stellar-diagnostic.js";

export type RunAllDiagnosticsOptions = {
  network?: string;
  source?: string;
  allowUntestedStellarCli?: boolean;
};

export async function runAllDiagnostics(
  options: RunAllDiagnosticsOptions
): Promise<Diagnostic[]> {
  return [
    nodeDiagnostic(),
    await stellarDiagnostic(options.allowUntestedStellarCli === true),
    await rustDiagnostic(),
    await wasmTargetDiagnostic(),
    await configDiagnostic(),
    await artifactsDiagnostic(),
    await networkDiagnostic(options.network),
    await sourceDiagnostic(options.source)
  ].filter((diagnostic): diagnostic is Diagnostic => diagnostic !== undefined);
}
