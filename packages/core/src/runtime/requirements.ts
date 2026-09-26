// Imported from the dependency-free `wasm-targets` module rather than
// `contracts/wasm.js`; the latter imports `node:crypto` / `node:fs/promises` and
// would otherwise be pulled into this constant-only entry point.
export { CURRENT_RUST_WASM_TARGET } from "../contracts/wasm-targets.js";

export const NODE_MIN_MAJOR = 22;
// Consumed by the CLI `doctor` Rust diagnostic (`rust-diagnostic.ts`), which
// reports an actionable failure when the installed toolchain is older.
export const RUST_MIN_VERSION = "1.91.0";
