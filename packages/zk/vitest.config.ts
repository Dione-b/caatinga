import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@caatinga/zk": path.resolve(__dirname, "./src/index.ts"),
    },
  },
});
