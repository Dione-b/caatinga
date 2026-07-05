import { defineConfig } from "tsup";

const cjsImportMetaUrlShim =
  'const __caatingaImportMetaUrl = require("node:url").pathToFileURL(__filename).href;';

export default defineConfig({
  entry: ["src/index.ts", "src/browser.ts", "src/runtime/requirements.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  splitting: false,
  esbuildOptions(options, context) {
    if (context.format !== "cjs") {
      return;
    }

    options.define = {
      ...(options.define ?? {}),
      "import.meta.url": "__caatingaImportMetaUrl",
    };
    options.banner = {
      js: `${cjsImportMetaUrlShim}\n`,
      ...(typeof options.banner === "object" ? options.banner : {}),
    };
  },
});
