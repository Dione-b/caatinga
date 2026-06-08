import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@caatinga/core/runtime/requirements", replacement: path.resolve(__dirname, "../core/dist/runtime/requirements.js") },
      { find: "@caatinga/core", replacement: path.resolve(__dirname, "../core/dist/index.js") }
    ]
  }
});
