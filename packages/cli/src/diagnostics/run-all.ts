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

export async function runAllDiagnostics(options: RunAllDiagnosticsOptions): Promise<Diagnostic[]> {
  return [
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
}
