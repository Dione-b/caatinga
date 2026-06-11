const SAFE_OPTIONAL = [
  "@safe-global/safe-apps-provider",
  "@safe-global/safe-apps-sdk"
];

// SWK ships Trezor/HOT as direct deps but defaultModules() does not register them.
// Trezor pulls protobufjs (critical advisories); HOT pulls NEAR/elliptic — unused in Caatinga templates.
const SWK_STRIPPED_DEPS = [
  "@trezor/connect-web",
  "@trezor/connect-plugin-stellar",
  "@hot-wallet/sdk"
];

/** @param {import('@pnpm/types').PackageManifest} pkg */
function readPackage(pkg) {
  if (pkg.name === "@reown/appkit-utils" && pkg.optionalDependencies) {
    for (const name of SAFE_OPTIONAL) {
      delete pkg.optionalDependencies[name];
    }
  }

  if (pkg.name === "@safe-global/safe-apps-sdk" && pkg.dependencies) {
    delete pkg.dependencies["@safe-global/safe-gateway-typescript-sdk"];
  }

  if (pkg.name === "@creit.tech/stellar-wallets-kit" && pkg.dependencies) {
    for (const name of SWK_STRIPPED_DEPS) {
      delete pkg.dependencies[name];
    }
  }

  return pkg;
}

module.exports = {
  hooks: {
    readPackage
  }
};
