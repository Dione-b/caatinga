import { access } from "node:fs/promises";
import {
  CaatingaError,
  CaatingaErrorCode,
  loadConfig,
  readArtifacts,
  resolveNetwork,
} from "@caatinga/core";
import type { Diagnostic } from "./types.js";

export async function configDiagnostic(): Promise<Diagnostic | undefined> {
  try {
    await loadConfig();
    return { ok: true, label: "caatinga.config.ts found" };
  } catch (error) {
    if (error instanceof CaatingaError) {
      if (error.code === CaatingaErrorCode.DEPENDENCIES_NOT_INSTALLED) {
        // The dependencies diagnostic already owns this line; reporting it here
        // too duplicates "Project dependencies not installed" in doctor output.
        return undefined;
      }

      if (error.code === CaatingaErrorCode.CONFIG_NOT_FOUND) {
        return {
          ok: false,
          label: "caatinga.config.ts not found",
          fix: error.hint ?? "Run this command from a Caatinga project root.",
        };
      }

      if (error.code === CaatingaErrorCode.INVALID_CONFIG) {
        return {
          ok: false,
          label: "caatinga.config.ts is invalid",
          fix: error.hint ?? "Fix schema errors in caatinga.config.ts.",
        };
      }

      return {
        ok: false,
        label: "caatinga.config.ts not ready",
        fix: error.hint ?? "Run this command from a Caatinga project root.",
      };
    }

    return {
      ok: false,
      label: "caatinga.config.ts not ready",
      fix: "Run this command from a Caatinga project root.",
    };
  }
}

export async function artifactsDiagnostic(): Promise<Diagnostic> {
  try {
    await access("caatinga.artifacts.json");
    await readArtifacts();
    return { ok: true, label: "caatinga.artifacts.json found" };
  } catch {
    return {
      ok: false,
      label: "caatinga.artifacts.json not found or invalid",
      fix: "Run caatinga init, or restore a valid caatinga.artifacts.json file.",
    };
  }
}

export async function networkDiagnostic(
  networkName: string | undefined
): Promise<Diagnostic | undefined> {
  if (!networkName) return undefined;

  try {
    const config = await loadConfig();
    const network = resolveNetwork(config, networkName);
    return { ok: true, label: `network ${network.name} found` };
  } catch (error) {
    if (
      error instanceof CaatingaError &&
      (error.code === CaatingaErrorCode.DEPENDENCIES_NOT_INSTALLED ||
        error.code === CaatingaErrorCode.CONFIG_NOT_FOUND)
    ) {
      // The config cannot be loaded for a reason unrelated to the network, so we
      // cannot tell whether the network exists. Skip rather than falsely report
      // it missing; the dependencies/config diagnostics carry the real signal.
      return undefined;
    }

    const hint = error instanceof CaatingaError ? error.hint : undefined;
    return {
      ok: false,
      label: `network ${networkName} not found`,
      fix: hint ?? `Add "${networkName}" to caatinga.config.ts networks.`,
    };
  }
}
