import { NODE_MIN_MAJOR } from "@caatinga/core/runtime/requirements";
import type { Diagnostic } from "./types.js";

export function nodeDiagnostic(): Diagnostic {
  const version = process.versions.node;
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);

  if (major < NODE_MIN_MAJOR) {
    return {
      ok: false,
      label: `Node.js ${version} is below the required minimum ${NODE_MIN_MAJOR}.0.0`,
      fix: `Install Node.js ${NODE_MIN_MAJOR} or newer.`
    };
  }

  return { ok: true, label: `Node.js ${version}` };
}
