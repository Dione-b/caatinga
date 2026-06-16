import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const emptyStub = fileURLToPath(
  new URL("./src/stubs/empty-wallet-dep/index.cjs", import.meta.url)
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@hot-wallet/sdk": fileURLToPath(new URL("./src/stubs/hot-wallet.ts", import.meta.url)),
      "@trezor/connect-web": emptyStub,
      "@trezor/connect-plugin-stellar": emptyStub,
      "@safe-global/safe-apps-sdk": emptyStub,
      "@safe-global/safe-apps-provider": emptyStub,
      "@safe-global/safe-gateway-typescript-sdk": emptyStub
    }
  }
});
