import { runCommand, validateSourceShape } from "@caatinga/core";
import type { Diagnostic } from "./types.js";

export async function sourceDiagnostic(source: string | undefined): Promise<Diagnostic | undefined> {
  if (!source) return undefined;

  const unsafeSource = validateSourceShape(source);
  if (unsafeSource) {
    return {
      ok: false,
      label: `source identity ${source} rejected (${unsafeSource.code})`,
      fix: unsafeSource.hint
    };
  }

  try {
    await runCommand("stellar", ["keys", "public-key", source]);
    return { ok: true, label: `source identity ${source} found` };
  } catch {
    return {
      ok: false,
      label: `source identity ${source} not found`,
      fix: `Create and fund it: stellar keys generate ${source} --fund --network testnet`
    };
  }
}
