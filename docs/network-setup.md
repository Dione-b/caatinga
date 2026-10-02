# Stellar & Soroban Network Setup Guide

This guide describes how to configure Stellar and Soroban networks inside a Caatinga project.

---

## 1. Network Configuration in `caatinga.config.ts`

Networks are declared inside the `networks` block of the configuration file. Each network specifies
the Soroban RPC endpoint and the network passphrase (which acts as a chain identifier). Unknown keys
are dropped during config validation, and a missing or misspelled `networkPassphrase` fails with
`CAATINGA_INVALID_CONFIG`.

Here is the schema:

```ts
export type NetworkConfig = {
  rpcUrl: string; // Soroban RPC URL
  networkPassphrase: string;
  requireConfirmation?: boolean; // prompt before mutating commands (always on for mainnet)
};
```

Mainnet always asks for interactive confirmation before `deploy`, `upgrade`, `invoke`, `wire`,
`rollback`, `regression`, and `zk invoke`; pass `-y, --yes` to skip the prompt in CI. Set
`requireConfirmation: true` to get the same prompt on any other network.

Caatinga does not fund accounts. Create and fund a testnet identity with
`stellar keys generate alice --fund --network testnet`.

---

## 2. Standard Stellar/Soroban Network Boilerplates

### Testnet (SDF Public Testnet)

Use this for public staging, testing integrations, and deploying release candidates.

- **Passphrase:** `Test SDF Network ; September 2015`
- **Funding:** Friendbot via `stellar keys generate <alias> --fund --network testnet`.

```ts
networks: {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
}
```

### Mainnet (Stellar Production Network)

Use this only for production releases.

- **Passphrase:** `Public Global Stellar Network ; September 2015`
- **Funding:** None (requires real assets).
- **RPC:** SDF does not run a public mainnet Soroban RPC. Use a provider you trust; the example
  below is the default hint Caatinga prints. Mainnet commands always use the configured `rpcUrl`.

```ts
networks: {
  mainnet: {
    rpcUrl: "https://mainnet.sorobanrpc.com",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  },
}
```

### Futurenet (SDF Experimental Futurenet)

Use this for testing bleeding-edge Protocol features.

- **Passphrase:** `Test SDF Future Network ; October 2022`
- Stellar CLI has no `--network futurenet` shorthand, so Caatinga always passes the explicit RPC URL
  and passphrase from this config.

```ts
networks: {
  futurenet: {
    rpcUrl: "https://rpc-futurenet.stellar.org",
    networkPassphrase: "Test SDF Future Network ; October 2022",
  },
}
```

### Local/Standalone (Docker)

Use this for rapid offline development.

- **Setup Command:** Run a local Stellar Quickstart Docker container (`--local`).
- **Passphrase:** `Standalone Network ; February 2017`

```ts
networks: {
  local: {
    rpcUrl: "http://localhost:8000/soroban/rpc",
    networkPassphrase: "Standalone Network ; February 2017",
  },
}
```
