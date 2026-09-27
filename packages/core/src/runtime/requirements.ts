// Imported from the dependency-free `wasm-targets` module rather than
// `contracts/wasm.js`; the latter imports `node:crypto` / `node:fs/promises` and
// would otherwise be pulled into this constant-only entry point.
export { CURRENT_RUST_WASM_TARGET } from "../contracts/wasm-targets.js";

export const NODE_MIN_MAJOR = 22;
// Consumed by the CLI `doctor` Rust diagnostic (`rust-diagnostic.ts`), which
// reports an actionable failure when the installed toolchain is older.
export const RUST_MIN_VERSION = "1.91.1";

// Toolchains `stellar contract build` refuses to build contracts with
// ("use a rust version other than 1.81, 1.82, 1.83 or 1.91.0"). Entries are
// either a `major.minor` line (every patch release) or an exact version.
export const RUST_BLOCKED_VERSIONS: readonly string[] = ["1.81", "1.82", "1.83", "1.91.0"];
