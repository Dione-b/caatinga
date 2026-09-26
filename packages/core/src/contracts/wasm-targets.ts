/**
 * Dependency-free Rust/wasm target constants used by the build and deploy paths.
 *
 * These live in their own module (rather than alongside the artifact helpers in
 * `./wasm.js`) so that importing a constant never drags in `node:crypto`,
 * `node:fs/promises`, or `node:path`. The `@caatinga/core/runtime/requirements`
 * entry point is constant-only and is consumed by the CLI preflight, so it must
 * stay free of those runtime dependencies.
 */

export const LEGACY_RUST_WASM_TARGET = "wasm32-unknown-unknown";
export const CURRENT_RUST_WASM_TARGET = "wasm32v1-none";

/** Rewrites a legacy-target artifact path to the current Soroban wasm target. */
export function toCurrentWasmTargetPath(wasmPath: string): string {
  if (!wasmPath.includes(LEGACY_RUST_WASM_TARGET)) {
    return wasmPath;
  }

  return wasmPath.replaceAll(LEGACY_RUST_WASM_TARGET, CURRENT_RUST_WASM_TARGET);
}
