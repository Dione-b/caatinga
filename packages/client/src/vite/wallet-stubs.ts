import path from "node:path";

export type WalletStubPaths = {
  stubsDir: string;
};

export function walletStubOverrides(stubsDir = "./src/stubs"): Record<string, unknown> {
  const posixStubsDir = stubsDir.split(path.sep).join("/");

  return {
    uuid: "^14.0.0",
    ws: "^8.21.0",
    axios: "^1.17.1",
    "@trezor/connect-web": `file:${posixStubsDir}/empty-wallet-dep`,
    "@trezor/connect-plugin-stellar": `file:${posixStubsDir}/empty-wallet-dep`,
    "@hot-wallet/sdk": `file:${posixStubsDir}/hot-wallet-sdk`,
    "@creit.tech/stellar-wallets-kit": {
      "@trezor/connect-web": `file:${posixStubsDir}/empty-wallet-dep`,
      "@trezor/connect-plugin-stellar": `file:${posixStubsDir}/empty-wallet-dep`,
      "@hot-wallet/sdk": `file:${posixStubsDir}/hot-wallet-sdk`,
    },
    "@reown/appkit-utils": {
      "@safe-global/safe-apps-sdk": "-",
      "@safe-global/safe-apps-provider": "-",
    },
    "@safe-global/safe-apps-sdk": {
      "@safe-global/safe-gateway-typescript-sdk": "-",
    },
  };
}

export function walletStubViteAliases(stubsDir: string): Record<string, string> {
  const emptyStub = path.join(stubsDir, "empty-wallet-dep", "index.cjs");

  return {
    "@hot-wallet/sdk": path.join(stubsDir, "hot-wallet.ts"),
    "@trezor/connect-web": emptyStub,
    "@trezor/connect-plugin-stellar": emptyStub,
    "@safe-global/safe-apps-sdk": emptyStub,
    "@safe-global/safe-apps-provider": emptyStub,
    "@safe-global/safe-gateway-typescript-sdk": emptyStub,
  };
}

export function walletStubPnpmWorkspaceYaml(): string {
  return `allowBuilds:
  esbuild: true

ignoredOptionalDependencies:
  - "@safe-global/safe-apps-provider"
  - "@safe-global/safe-apps-sdk"

overrides:
  uuid: "^14.0.0"
  ws: "^8.21.0"
  axios: "^1.17.1"
  "@creit.tech/stellar-wallets-kit>@trezor/connect-web": "-"
  "@creit.tech/stellar-wallets-kit>@trezor/connect-plugin-stellar": "-"
  "@creit.tech/stellar-wallets-kit>@hot-wallet/sdk": "-"
  "@reown/appkit-utils>@safe-global/safe-apps-sdk": "-"
  "@reown/appkit-utils>@safe-global/safe-apps-provider": "-"
  "@safe-global/safe-apps-sdk>@safe-global/safe-gateway-typescript-sdk": "-"
`;
}
