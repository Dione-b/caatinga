import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  walletStubOverrides,
  walletStubPnpmWorkspaceYaml,
  walletStubViteAliases,
} from "./wallet-stubs.js";

describe("wallet stub helpers", () => {
  it("should_expose_npm_overrides_for_stellar_wallets_kit", () => {
    const overrides = walletStubOverrides("./src/stubs") as {
      "@creit.tech/stellar-wallets-kit": Record<string, string>;
    };

    expect(overrides["@creit.tech/stellar-wallets-kit"]["@hot-wallet/sdk"]).toBe(
      "file:./src/stubs/hot-wallet-sdk"
    );
  });

  it("should_expose_vite_aliases", () => {
    const aliases = walletStubViteAliases("/app/src/stubs");

    expect(aliases["@hot-wallet/sdk"]).toBe(path.join("/app/src/stubs", "hot-wallet.ts"));
    expect(aliases["@trezor/connect-web"]).toContain("empty-wallet-dep");
  });

  it("should_expose_pnpm_workspace_snippet", () => {
    expect(walletStubPnpmWorkspaceYaml()).toContain("allowBuilds:");
    expect(walletStubPnpmWorkspaceYaml()).toContain("@hot-wallet/sdk");
  });
});
