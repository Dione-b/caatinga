/**
 * Timeout budgets for subprocess and network-facing calls (#145).
 *
 * These are opt-in per call site rather than a single global default. Caatinga
 * drives commands whose legitimate runtime spans four orders of magnitude —
 * `stellar --version` returns in milliseconds, while a ZK powers-of-tau
 * ceremony or a cold `cargo build` can legitimately run for many minutes. A
 * global default tight enough to catch a hang would kill real work; one loose
 * enough to be safe would not catch anything.
 *
 * Call sites left deliberately untimed: contract builds (`stellar contract
 * build`, cold Cargo compiles) and every ZK circuit/ceremony command in
 * `@caatinga/zk`. Bounding those needs a per-project budget, not a constant.
 */

/** Version and capability probes. These return immediately or not at all. */
export const VERSION_PROBE_TIMEOUT_MS = 30_000;

/** Registry metadata lookups (`npm view`). A wedged registry must not hang the CLI. */
export const REGISTRY_TIMEOUT_MS = 60_000;

/** `npx --yes @stellar/stellar-sdk generate` — downloads a package, then generates. */
export const BINDINGS_TIMEOUT_MS = 120_000;

/**
 * Signed and simulated transactions driven through the Stellar CLI: deploy,
 * upgrade, upload, invoke, read, simulate. Generous, since these wait on ledger
 * close and RPC, but bounded — an irreversible mainnet operation must not hang
 * forever with no output and no recourse.
 */
export const TRANSACTION_TIMEOUT_MS = 300_000;
