# Recovery Scenarios

Actionable recovery paths for common failure modes. For the full error reference, see [errors.md](./errors.md). For step-by-step troubleshooting, see [troubleshooting.md](./troubleshooting.md).

---

## Interrupted deploy

| Symptom                          | What happened                                                                      | Recovery                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Deploy stopped mid-graph         | Earlier contracts in `dependsOn` order may already be in `caatinga.artifacts.json` | Re-run `caatinga deploy --network <network> --source <identity>` — already-deployed contracts are skipped unless `--force` |
| CLI killed during artifact write | Atomic write (`write temp → rename`) prevents truncated JSON                       | If file is corrupt, restore from Git or run `caatinga migrate artifacts` after fixing JSON                                 |
| Transient testnet error          | Retry logs appear: `Deploy hit a transient testnet error`                          | Wait for automatic retries or re-run deploy                                                                                |

**Doctor:** `caatinga doctor --network testnet` lists partial deploy coverage (`CAATINGA_DOCTOR_PARTIAL_DEPLOY` advisory).

---

## Invalid artifacts

| Code                          | Recovery command                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `CAATINGA_ARTIFACT_NOT_FOUND` | `caatinga init` or copy `caatinga.artifacts.json` from a teammate                                    |
| `CAATINGA_ARTIFACT_INVALID`   | Fix JSON manually, or delete and redeploy: `caatinga deploy --network <network> --source <identity>` |
| Unsupported schema version    | Upgrade CLI: `npm install -g @caatinga/cli@latest`                                                   |

**Migration:** `caatinga migrate artifacts` upgrades schema v1 → v2 on disk.

---

## RPC offline

| Symptom                                  | Code                          | Recovery                                                        |
| ---------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| Browser invoke fails at simulate/prepare | `CAATINGA_XDR_PREPARE_FAILED` | Verify `rpcUrl` in config and `.env`; test with `curl <rpcUrl>` |
| Submit rejected                          | `CAATINGA_XDR_SUBMIT_FAILED`  | Check network passphrase matches wallet network                 |
| CLI read/invoke fails                    | `CAATINGA_INVOKE_FAILED`      | Confirm Soroban RPC endpoint is reachable                       |

---

## Stellar CLI absent or wrong version

| Code                               | Recovery                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `CAATINGA_STELLAR_CLI_NOT_FOUND`   | Install from [Stellar setup guide](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) |
| `CAATINGA_UNSUPPORTED_CLI_VERSION` | Install Stellar CLI ≥ 23.0.0 (27.0.0 recommended)                                                             |
| `CAATINGA_RUST_TARGET_NOT_FOUND`   | `rustup target add wasm32v1-none`                                                                             |

**Preflight:** `caatinga doctor`

---

## Outdated bindings

| Code                                | Recovery                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `CAATINGA_PLACEHOLDER_BINDING`      | `caatinga generate <contract> --network <network>` then restart dev server |
| `CAATINGA_BINDING_CLIENT_NOT_FOUND` | Same as above                                                              |
| `CAATINGA_BINDING_METHOD_NOT_FOUND` | Regenerate bindings after contract interface change                        |

**Doctor** reports binding freshness per contract.

---

## Multi-contract partial state

When `token` deployed but `vault` failed:

```bash
caatinga deploy vault --network testnet --source alice
# or deploy full graph:
caatinga deploy --network testnet --source alice
```

Placeholders like `${contracts.token.contractId}` resolve from artifacts on retry.
