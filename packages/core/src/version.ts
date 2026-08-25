import { createRequire } from "node:module";

// The CJS build (dist/index.cjs) rewrites import.meta.url via a tsup banner
// shim (pathToFileURL(__filename).href), so this resolves correctly in the ESM
// source, the ESM dist, and the CJS dist alike — no __filename fallback needed.
const require = createRequire(import.meta.url);
export const CAATINGA_CORE_VERSION: string = require("../package.json").version;
