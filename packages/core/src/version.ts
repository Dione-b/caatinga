import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const CAATINGA_CORE_VERSION: string = require("../package.json").version;
