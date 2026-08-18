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
npx ctg init my-dapp
```

---

## 2. `CAATINGA_STELLAR_CLI_NOT_FOUND`

**Symptom:** `build`, `deploy`, or `doctor` cannot find `stellar`.

**Fix:**

```bash
# Install manually: https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli
```

---

## 3. `CAATINGA_UNSUPPORTED_CLI_VERSION`

**Symptom:** CLI refuses to run; version below 23.0.0.

**Fix:** Upgrade Stellar CLI to ≥ 23.0.0 (27.0.0 recommended).

```bash
stellar --version
ctg doctor
```

---

## 4. `CAATINGA_ARTIFACT_NOT_FOUND`

**Symptom:** `generate`, `deploy`, or client cannot find deployment state.

**Fix:**

```bash
ctg deploy <contract> --network testnet --source alice
```

`ctg build` alone does not create deployment records.

---

## 5. `CAATINGA_PLACEHOLDER_BINDING`

**Symptom:** Browser shows binding error before wallet opens.

**Cause:** `ctg generate` was not run after deploy.

**Fix:**

```bash
ctg generate counter --network testnet
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
ctg doctor --network testnet
```

---

## 9. `CAATINGA_DEPLOY_ARG_PLACEHOLDER_UNRESOLVED`

**Symptom:** Multi-contract deploy fails before CLI invoke.

**Cause:** Dependency not deployed on selected network.

**Fix:**

```bash
ctg deploy token --network testnet --source alice
ctg deploy vault --network testnet --source alice
# or full graph:
ctg deploy --network testnet --source alice
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
ctg deploy counter --network testnet --source alice
```

Never pass `G...` addresses or secret keys as `--source`.

---

## 12. `CAATINGA_RUST_TARGET_NOT_FOUND`

**Symptom:** Build fails mentioning `wasm32v1-none`.

**Fix:**

```bash
rustup target add wasm32v1-none
ctg build counter
```

---

## 13. `CAATINGA_BINDINGS_FAILED`

**Symptom:** `ctg generate` fails.

**Fix:** Deploy first, then generate:

```bash
ctg deploy counter --network testnet --source alice
ctg generate counter --network testnet
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
ctg doctor --network testnet
# follow printed deploy commands
```

---

## Security fixes

**Applies to versions before the fix landed on `main` (3.9.2 and earlier are affected; check `npm view @caatinga/cli dist-tags` for the current patched version).**

- **`ctg identity import` tar path traversal.** Import previously extracted attacker-controlled tarballs without checking entry paths, so a crafted archive could write files outside the target Stellar config directory. Import now lists archive entries first and refuses the import if any entry would resolve outside the target directory. Only import archives from a source you trust — the check blocks path traversal, not a malicious archive's legitimate-looking contents.
- **Unverified `circom` downloads (`ensureCircom`).** The ZK toolchain downloaded and executed a platform `circom` binary from GitHub with no integrity check, so a compromised release asset or on-path tamperer could get an arbitrary binary run and cached for reuse. Every `circom` binary — freshly downloaded or read from `~/.caatinga/zk-tools` cache — is now verified against a pinned SHA-256 before use. A mismatch deletes the file and raises `ZK_CHECKSUM_MISMATCH` (see [errors.md](./errors.md#zk)) instead of running an unverified binary.

If either of these was ever exploited against you (unexpected files outside your Stellar config dir, or a `circom` binary you didn't expect), treat any keys under the affected `--path` as compromised and rotate them.

---

## Still stuck?

1. `ctg doctor --network testnet`
2. Note the `CAATINGA_*` code (not the message text)
3. Search [errors.md](./errors.md) for the code
4. File an issue with config, command, and code
