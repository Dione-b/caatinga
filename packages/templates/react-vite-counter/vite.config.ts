import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { walletStubViteAliases } from "@caatinga/client/vite";
import { fileURLToPath } from "node:url";

const stubsDir = fileURLToPath(new URL("./src/stubs", import.meta.url));

function templateManualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }
  if (id.includes("@stellar/stellar-sdk")) {
    return "stellar-sdk";
  }
  if (id.includes("@creit.tech/stellar-wallets-kit")) {
    return "wallet-kit";
  }
  if (id.includes("react-dom") || id.includes("/react/")) {
    return "react-vendor";
  }
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: walletStubViteAliases(stubsDir),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: templateManualChunks,
      },
    },
  },
});
