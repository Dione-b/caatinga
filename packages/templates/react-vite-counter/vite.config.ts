import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const xbullWalletConnectRoot = dirname(
  require.resolve("@creit-tech/xbull-wallet-connect/package.json")
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@creit-tech/xbull-wallet-connect": join(xbullWalletConnectRoot, "src/index.ts")
    }
  }
});
