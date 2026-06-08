import { CURRENT_RUST_WASM_TARGET } from "@caatinga/core/runtime/requirements";
import { runCommand } from "@caatinga/core";
import type { Diagnostic } from "./types.js";

export async function rustDiagnostic(): Promise<Diagnostic> {
  try {
    const result = await runCommand("rustc", ["--version"]);
    return { ok: true, label: result.stdout || result.all || "Rust installed" };
  } catch {
    return {
      ok: false,
      label: "Rust not found",
      fix: `Install Rust, then run: rustup target add ${CURRENT_RUST_WASM_TARGET}`
    };
  }
}

export async function wasmTargetDiagnostic(): Promise<Diagnostic> {
  try {
    const result = await runCommand("rustup", ["target", "list", "--installed"]);
    const installedTargets = result.stdout || result.all;

    if (installedTargets.split(/\r?\n/).includes(CURRENT_RUST_WASM_TARGET)) {
      return { ok: true, label: `${CURRENT_RUST_WASM_TARGET} target installed` };
    }

    return {
      ok: false,
      label: `${CURRENT_RUST_WASM_TARGET} target not installed`,
      fix: `Run: rustup target add ${CURRENT_RUST_WASM_TARGET}`
    };
  } catch {
    return {
      ok: false,
      label: "rustup not found",
      fix: `Install rustup, then run: rustup target add ${CURRENT_RUST_WASM_TARGET}`
    };
  }
}
