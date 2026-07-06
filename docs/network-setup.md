# Stellar & Soroban Network Setup Guide

This guide describes how to configure Stellar and Soroban networks inside a Caatinga project.

---

## 1. Network Configuration in `caatinga.config.ts`

Networks are declared inside the `networks` block of the configuration file. Each network can specify the RPC endpoint, network passphrase (which acts as a secure chain identifier), and optionally a friendbot URL for account funding.

Here is the standard schema:

```ts
export type NetworkConfig = {
  rpcUrl: string;
  passphrase: string;
  friendbotUrl?: string;
};
```

---

## 2. Standard Stellar/Soroban Network Boilerplates

### Testnet (SDF Public Testnet)

Use this for public staging, testing integrations, and deploying release candidates.

- **Passphrase:** `Test SDF Network ; September 2015`
- **friendbotUrl:** Available (allows funding accounts with 10,000 test XLM).

```ts
networks: {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org:443",
    passphrase: "Test SDF Network ; September 2015",
    friendbotUrl: "https://friendbot.stellar.org"
  }
}
```

### Mainnet (Stellar Production Network)

Use this only for production releases.

- **Passphrase:** `Public Global Stellar Network ; October 2015`
- **friendbotUrl:** None (requires real assets).

```ts
networks: {
  mainnet: {
    rpcUrl: "https://mainnet.stellar.org:443",
    passphrase: "Public Global Stellar Network ; October 2015"
  }
}
```

### Futurenet (SDF Experimental Futurenet)

Use this for testing bleeding-edge Protocol features.

- **Passphrase:** `Test SDF Future Network ; October 2022`
- **friendbotUrl:** Available.

```ts
networks: {
  futurenet: {
    rpcUrl: "https://rpc-futurenet.stellar.org:443",
    passphrase: "Test SDF Future Network ; October 2022",
    friendbotUrl: "https://friendbot-futurenet.stellar.org"
  }
}
```

### Local/Standalone (Docker)

Use this for rapid offline development.

- **Setup Command:** Run a local Stellar Quickstart Docker container.
- **Passphrase:** `Standalone Network ; Simple comparison`

```ts
networks: {
  local: {
    rpcUrl: "http://localhost:8000/soroban/rpc",
    passphrase: "Standalone Network ; Simple comparison",
    friendbotUrl: "http://localhost:8000/friendbot"
  }
}
```
