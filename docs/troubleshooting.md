# Troubleshooting

Symptom-first guide for the most common Caatinga failures. For the complete error reference table, see [errors.md](./errors.md). For recovery commands, see [recovery-scenarios.md](./recovery-scenarios.md).

---

## 1. `CAATINGA_CONFIG_NOT_FOUND`

**Symptom:** Any command fails immediately.

**Cause:** Not in a project root, or `caatinga.config.ts` is missing.

**Fix:**

```bash
cd /path/to/your/project
# or scaffold:
npx caatinga init my-dapp
```

---

## 2. `CAATINGA_STELLAR_CLI_NOT_FOUND`

**Symptom:** `build`, `deploy`, or `doctor` cannot find `stellar`.

**Fix:**

```bash
npx caatinga setup
# or install manually: https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup
```

---

## 3. `CAATINGA_UNSUPPORTED_CLI_VERSION`

**Symptom:** CLI refuses to run; version below 23.0.0.

**Fix:** Upgrade Stellar CLI to ≥ 23.0.0 (27.0.0 recommended).

```bash
stellar --version
caatinga doctor
```

---

## 4. `CAATINGA_ARTIFACT_NOT_FOUND`

**Symptom:** `generate`, `deploy`, or client cannot find deployment state.

**Fix:**

```bash
caatinga deploy <contract> --network testnet --source alice
```

`caatinga build` alone does not create deployment records.

---

## 5. `CAATINGA_PLACEHOLDER_BINDING`

**Symptom:** Browser shows binding error before wallet opens.

**Cause:** `caatinga generate` was not run after deploy.

**Fix:**

```bash
caatinga generate counter --network testnet
npm run dev   # restart dev server
```

---

## 6. `CAATINGA_XDR_PREPARE_FAILED` (RPC offline)

**Symptom:** Browser invoke fails at simulation/prepare.

**Cause:** Soroban RPC unreachable or wrong URL.

**Fix:** Verify `rpcUrl` in `caatinga.config.ts` and frontend `.env`:

```bash
curl -s -o /dev/null -w "%{http_code}" https://soroban-testnet.stellar.org
```

---

## 7. `CAATINGA_XDR_SIGN_FAILED`

**Symptom:** Wallet rejects transaction.

**Cause:** Wrong network in wallet, user rejection, or stale bindings.

**Fix:** Match wallet network to config; approve transaction; regenerate bindings if contract changed.

---

## 8. `CAATINGA_DEPLOY_FAILED`

**Symptom:** Deploy exits non-zero after Stellar CLI runs.

**Fix:** Re-run the printed `stellar contract deploy` command for full output. Check funded identity:

```bash
stellar keys address alice
caatinga doctor --network testnet
```

---

## 9. `CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED`

**Symptom:** Multi-contract deploy fails before CLI invoke.

**Cause:** Dependency not deployed on selected network.

**Fix:**

```bash
caatinga deploy token --network testnet --source alice
caatinga deploy vault --network testnet --source alice
# or full graph:
caatinga deploy --network testnet --source alice
```

---

## 10. `CAATINGA_CONTRACT_DEPENDENCY_CYCLE`

**Symptom:** Config load or deploy rejects dependency graph.

**Fix:** Remove circular `dependsOn` entries; split initialization into a later `invoke` step.

---

## 11. `CAATINGA_SOURCE_ACCOUNT_REQUIRED`

**Symptom:** Deploy/invoke refuses to run.

**Fix:**

```bash
stellar keys generate alice --fund --network testnet
caatinga deploy counter --network testnet --source alice
```

Never pass `G...` addresses or secret keys as `--source`.

---

## 12. `CAATINGA_RUST_TARGET_NOT_FOUND`

**Symptom:** Build fails mentioning `wasm32v1-none`.

**Fix:**

```bash
rustup target add wasm32v1-none
caatinga build counter
```

---

## 13. `CAATINGA_BINDINGS_FAILED`

**Symptom:** `caatinga generate` fails.

**Fix:** Deploy first, then generate:

```bash
caatinga deploy counter --network testnet --source alice
caatinga generate counter --network testnet
```

---

## 14. `CAATINGA_NETWORK_NOT_FOUND`

**Symptom:** `--network foo` not recognized.

**Fix:** Add network to `caatinga.config.ts` or use configured name (`testnet`, `mainnet`).

---

## 15. `CAATINGA_DOCTOR_PARTIAL_DEPLOY` (advisory)

**Symptom:** Doctor lists contracts missing from artifacts.

**Fix:** Deploy missing contracts:

```bash
caatinga doctor --network testnet
# follow printed deploy commands
```

---

## Still stuck?

1. `caatinga doctor --network testnet`
2. Note the `CAATINGA_*` code (not the message text)
3. Search [errors.md](./errors.md) for the code
4. File an issue with config, command, and code
