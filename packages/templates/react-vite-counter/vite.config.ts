import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Empty CJS module. Aliasing browser-hostile wallet sub-deps here keeps them out
// of the bundle on yarn/bun (and as a safety net on npm/pnpm). Install-time
// overrides in package.json / pnpm-workspace.yaml block the same deps from
// being installed. CJS interop lets any named import resolve to `undefined`
// without an esbuild "not exported" error.
const emptyStub = fileURLToPath(
  new URL("./src/stubs/empty-wallet-dep/index.cjs", import.meta.url)
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Stellar Wallets Kit drags NEAR's @hot-wallet/sdk (Node-only crypto) into
      // the browser bundle. The adapter filters HOT Wallet out, so stub the SDK
      // to keep the NEAR chain out of the build. See src/stubs/hot-wallet.ts.
      "@hot-wallet/sdk": fileURLToPath(new URL("./src/stubs/hot-wallet.ts", import.meta.url)),
      // SWK + Reown/WalletConnect pull Trezor Connect (Node-only) and Safe Global
      // SDKs that none of the wallets Caatinga ships actually use.
      "@trezor/connect-web": emptyStub,
      "@trezor/connect-plugin-stellar": emptyStub,
      "@safe-global/safe-apps-sdk": emptyStub,
      "@safe-global/safe-apps-provider": emptyStub,
      "@safe-global/safe-gateway-typescript-sdk": emptyStub
    }
  }
});
