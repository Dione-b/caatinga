import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { walletStubViteAliases } from "@caatinga/client/vite";
import { fileURLToPath } from "node:url";

const stubsDir = fileURLToPath(new URL("./src/stubs", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: walletStubViteAliases(stubsDir),
  },
});
