import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  walletStubOverrides,
  walletStubPnpmWorkspaceYaml,
  walletStubViteAliases,
} from "./wallet-stubs.js";

describe("wallet stub helpers", () => {
  it("should_expose_npm_overrides_for_stellar_wallets_kit", () => {
    const overrides = walletStubOverrides("./src/stubs") as {
      ws: string;
      axios: string;
      "@trezor/connect-web": string;
      "@creit.tech/stellar-wallets-kit": Record<string, string>;
    };

    expect(overrides.ws).toBe("^8.21.0");
    expect(overrides.axios).toBe("^1.17.1");
    expect(overrides["@trezor/connect-web"]).toBe("file:./src/stubs/empty-wallet-dep");
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
    expect(walletStubPnpmWorkspaceYaml()).toContain('ws: "^8.21.0"');
    expect(walletStubPnpmWorkspaceYaml()).toContain('axios: "^1.17.1"');
  });

  it("should_declare_empty_packages_for_pnpm_9", () => {
    expect(walletStubPnpmWorkspaceYaml().startsWith("packages: []\n")).toBe(true);
  });

  it.each(["react-vite-counter", "zk-starter"])(
    "should_match_the_%s_template_pnpm_workspace",
    async (template) => {
      const templateYaml = await readFile(
        fileURLToPath(
          new URL(`../../../templates/${template}/pnpm-workspace.yaml`, import.meta.url)
        ),
        "utf8"
      );
      const withoutComments = templateYaml
        .split("\n")
        .filter((line) => !line.startsWith("#"))
        .join("\n");

      expect(walletStubPnpmWorkspaceYaml()).toBe(withoutComments);
    }
  );
});
