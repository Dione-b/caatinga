import { CURRENT_RUST_WASM_TARGET, RUST_MIN_VERSION } from "@caatinga/core/runtime/requirements";
import { isCargoBinMissingFromPath, runCommand } from "@caatinga/core";
import { compareSemverVersions } from "../utils/semver-compare.js";
import type { Diagnostic } from "./types.js";

/**
 * Matches the version token in `rustc --version` output, e.g.
 * `rustc 1.91.0 (f8297e351 2025-10-28)`.
 */
const RUSTC_VERSION_PATTERN = /\brustc\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/;

/** Extracts the toolchain version from `rustc --version` output, if present. */
export function parseRustcVersion(output: string): string | undefined {
  return RUSTC_VERSION_PATTERN.exec(output)?.[1];
}

export async function rustDiagnostic(): Promise<Diagnostic> {
  try {
    const result = await runCommand("rustc", ["--version"]);
    const output = result.stdout || result.all || "";
    const version = parseRustcVersion(output);

    // `RUST_MIN_VERSION` is the minimum toolchain the Soroban wasm target is
    // built and tested against; flag older versions with an actionable fix
    // instead of reporting a bare "Rust installed".
    if (version !== undefined && compareSemverVersions(version, RUST_MIN_VERSION) === -1) {
      return {
        ok: false,
        label: `Rust ${version} is older than the required ${RUST_MIN_VERSION}`,
        fix: `Update Rust to ${RUST_MIN_VERSION} or newer: rustup update stable`,
      };
    }

    return { ok: true, label: output || "Rust installed" };
  } catch {
    return {
      ok: false,
      label: "Rust not found",
      fix: `Install Rust, then run: rustup target add ${CURRENT_RUST_WASM_TARGET}`,
    };
  }
}

export async function wasmTargetDiagnostic(): Promise<Diagnostic> {
  try {
    const result = await runCommand("rustup", ["target", "list", "--installed"]);
    const installedTargets = result.stdout || result.all;

    if (installedTargets.split(/\r?\n/).includes(CURRENT_RUST_WASM_TARGET)) {
      const warnings = isCargoBinMissingFromPath()
        ? [
            {
              code: "RUST_PATH_ADVISORY",
              message:
                "~/.cargo/bin is not on PATH. Caatinga enriches subprocess PATH for build, but manual cargo/stellar runs from non-login shells may still fail until PATH is updated.",
            },
          ]
        : undefined;

      return {
        ok: true,
        label: `${CURRENT_RUST_WASM_TARGET} target installed`,
        warnings,
      };
    }

    return {
      ok: false,
      label: `${CURRENT_RUST_WASM_TARGET} target not installed`,
      fix: `Run: rustup target add ${CURRENT_RUST_WASM_TARGET}`,
    };
  } catch {
    return {
      ok: false,
      label: "rustup not found",
      fix: `Install rustup, then run: rustup target add ${CURRENT_RUST_WASM_TARGET}`,
    };
  }
}
