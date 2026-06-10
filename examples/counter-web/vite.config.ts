import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Stellar Wallets Kit drags NEAR's @hot-wallet/sdk (Node-only crypto) into
      // the browser bundle. The adapter filters HOT Wallet out, so stub the SDK
      // to keep the NEAR chain out of the build. See src/stubs/hot-wallet.ts.
      "@hot-wallet/sdk": fileURLToPath(new URL("./src/stubs/hot-wallet.ts", import.meta.url))
    }
  }
});
