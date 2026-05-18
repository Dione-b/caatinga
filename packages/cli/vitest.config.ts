import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@caatinga/core": path.resolve(__dirname, "../core/dist/index.js")
    }
  }
});
