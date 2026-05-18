import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@caatinga/core/browser",
        replacement: path.resolve(__dirname, "../core/dist/browser.js")
      },
      {
        find: "@caatinga/core",
        replacement: path.resolve(__dirname, "../core/dist/index.js")
      }
    ]
  }
});
