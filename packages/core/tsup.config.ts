import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/browser.ts", "src/runtime/requirements.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  splitting: false
});
