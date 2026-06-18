import { createRequire } from "node:module";

declare const __filename: string | undefined;

const require = createRequire(
  typeof __filename === "string" ? __filename : import.meta.url
);
export const CAATINGA_CORE_VERSION: string = require("../package.json").version;
