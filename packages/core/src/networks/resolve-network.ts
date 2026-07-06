import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";
import type { CaatingaConfig, NetworkConfig } from "../config/config.schema.js";

export type ResolvedNetwork = {
  name: string;
  config: NetworkConfig;
};

export function resolveNetwork(config: CaatingaConfig, networkName?: string): ResolvedNetwork {
  const name = networkName ?? config.defaultNetwork;
  const network = config.networks[name];

  if (!network) {
    let hint = `Add "${name}" to caatinga.config.ts networks, or pass a configured --network value.`;

    if (name === "testnet") {
      hint += `\n\nStellar Testnet Boilerplate:\n  networks: {\n    testnet: {\n      rpcUrl: "https://soroban-testnet.stellar.org:443",\n      passphrase: "Test SDF Network ; September 2015",\n      friendbotUrl: "https://friendbot.stellar.org"\n    }\n  }`;
    } else if (name === "mainnet") {
      hint += `\n\nStellar Mainnet Boilerplate:\n  networks: {\n    mainnet: {\n      rpcUrl: "https://mainnet.stellar.org:443",\n      passphrase: "Public Global Stellar Network ; October 2015"\n    }\n  }`;
    } else if (name === "futurenet") {
      hint += `\n\nStellar Futurenet Boilerplate:\n  networks: {\n    futurenet: {\n      rpcUrl: "https://rpc-futurenet.stellar.org:443",\n      passphrase: "Test SDF Future Network ; October 2022",\n      friendbotUrl: "https://friendbot-futurenet.stellar.org"\n    }\n  }`;
    }

    throw new CaatingaError(
      `Network "${name}" is not configured.`,
      CaatingaErrorCode.NETWORK_NOT_FOUND,
      hint
    );
  }

  return { name, config: network };
}
