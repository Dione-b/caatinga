# **PROJECT_NAME**

Experimental Caatinga multi-contract template with a real constructor dependency.

## Deploy

```bash
npm install
npm test             # run Rust contract tests
npx caatinga build token
npx caatinga build marketplace
npx caatinga deploy --network testnet --source alice
npx caatinga generate token
npx caatinga generate marketplace
```

`npm test` runs `cargo test` for both `token` and `marketplace` contracts.

Deploy order:

1. `token`
2. `marketplace`

`marketplace.deployArgs.tokenContractId` resolves from `${contracts.token.contractId}` after the token deploy writes `caatinga.artifacts.json`. Caatinga passes that value to the contract `__constructor` as `--token_contract_id`.
