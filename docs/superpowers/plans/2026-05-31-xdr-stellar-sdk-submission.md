# XDR Stellar SDK Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align `@caatinga/client` XDR invocation with Stellar SDK generated binding transactions while preserving Caatinga's wallet adapter and debug-XDR contract.

**Architecture:** Keep XDR construction as a thin adapter over generated bindings: call the generated method, read `toXDR()`, call `prepare()` when available, and never parse XDR or serialize SCVal manually. For invocation, adapt `CaatingaWalletAdapter.signTransaction({ xdr, networkPassphrase }) => string` into the Stellar SDK `signTransaction(xdr, opts) => { signedTxXdr }` callback and delegate submission to `AssembledTransaction.signAndSend({ signTransaction })`, falling back to `send()` only for older/custom transaction objects that do not expose `signAndSend`.

**Tech Stack:** TypeScript ESM, Vitest, `@caatinga/client`, Stellar SDK generated binding transaction shape.

---

## Spec

### Motivation

Caatinga intentionally does not reimplement Stellar SDK, Soroban SDK, generated bindings, XDR parsing, or SCVal serialization. Current `buildXdr()` follows that boundary, but `invoke()` currently assumes generated transaction objects accept `{ signedXdr }` in `signAndSend()` / `send()`. Stellar SDK generated bindings return `AssembledTransaction`, whose supported submission path is `signAndSend({ signTransaction })`, where `signTransaction` returns `{ signedTxXdr }`.

### Non-goals

- Do not add CLI XDR commands.
- Do not add backend signing.
- Do not parse XDR.
- Do not serialize Soroban values manually.
- Do not replace generated bindings with a Caatinga-owned contract model.
- Do not redesign the public `CaatingaWalletAdapter` interface.

### Prior Art

Rejected alternative: keep submitting `{ signedXdr }` to `signAndSend()`. This matches current tests but not Stellar SDK generated transaction semantics.

Rejected alternative: parse prepared XDR and submit directly through RPC. That crosses the SDK boundary and turns Caatinga into a partial Stellar SDK.

Accepted alternative: adapt Caatinga's wallet signer to the generated transaction's expected signer callback and delegate signing/submission orchestration to the generated transaction object.

### Interface Contract

Public wallet interface stays:

```ts
export interface CaatingaWalletAdapter {
  getPublicKey(): Promise<string>;
  signTransaction(input: {
    xdr: string;
    networkPassphrase: string;
  }): Promise<string>;
}
```

Invocation behavior:

- `client.contract(name).buildXdr(method, args?, options?)` calls `wallet.getPublicKey()` but never calls `wallet.signTransaction()`.
- `client.contract(name).invoke(method, args?, options?)` calls generated binding method, builds/prepares XDR, signs through `CaatingaWalletAdapter`, and submits through the generated transaction.
- `debugXdr` remains opt-in and returns unsigned, prepared, and signed XDR.
- `debugRaw` remains opt-in and returns raw binding/submission output.

Supported generated transaction shapes:

```ts
type StellarSdkSignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string }
) => Promise<{ signedTxXdr: string }> | { signedTxXdr: string };

type StellarSdkTransactionLike = {
  toXDR(): string;
  prepare?: () => Promise<unknown> | unknown;
  signAndSend?: (input?: { signTransaction?: StellarSdkSignTransaction }) => Promise<unknown> | unknown;
  send?: () => Promise<unknown> | unknown;
};
```

Error contract:

- Missing `toXDR()` throws `CAATINGA_XDR_BUILD_FAILED`.
- `prepare()` failures throw `CAATINGA_XDR_PREPARE_FAILED`, unless the error is already a `CaatingaError`.
- Wallet signer throw/reject/empty result throws `CAATINGA_XDR_SIGN_FAILED`.
- Missing submit method or submit throw/reject throws `CAATINGA_XDR_SUBMIT_FAILED`.
- Unrecognized non-null object submit payload throws `CAATINGA_XDR_RESULT_FAILED`.

### Observability Plan

- Keep XDR omitted by default.
- Include unsigned/prepared/signed XDR only when `debugXdr: true`.
- Include raw submission result only when `debugRaw: true`.
- Preserve RPC URL in prepare/submit error hints.

### Rollout + Rollback

Rollout is a patch-level client fix with tests. Existing `CaatingaWalletAdapter` implementations continue to work.

Rollback is reverting the client submission adapter change. Rollback risk: real Stellar SDK generated bindings will fail again if they require `signAndSend({ signTransaction })`.

---

## File Structure

- Modify: `packages/client/src/client/caatinga-contract-client.ts`
  - Owns high-level `buildXdr()` / `invoke()` orchestration.
  - Add a small internal adapter that converts `CaatingaWalletAdapter.signTransaction()` into Stellar SDK's `signTransaction` callback.
  - Submit through `signAndSend({ signTransaction })` first, then fall back to `send()`.

- Modify: `packages/client/src/client/create-caatinga-client.test.ts`
  - Update existing invoke happy-path tests from Caatinga-only `{ signedXdr }` mocks to Stellar SDK-style `signAndSend({ signTransaction })` mocks.

- Modify: `packages/client/src/client/caatinga-contract-client.test.ts`
  - Add direct regression coverage for Stellar SDK `signAndSend({ signTransaction })`, empty wallet signatures, submit failures, and legacy/custom `send()` fallback.

- Modify: `packages/templates/react-vite-counter/src/contracts/generated/counter.ts`
  - Keep the checked-in stand-in binding aligned with the Stellar SDK submission shape.

- Modify: `examples/counter-web/src/contracts/generated/counter.ts`
  - Same stand-in binding alignment for the example app.

- Modify: `docs/client.md`
  - Clarify that Caatinga adapts its wallet adapter into the generated transaction's `signAndSend({ signTransaction })` flow.

---

## Tasks

### Task 1: Add Stellar SDK-Style Invocation Tests

**Files:**
- Modify: `packages/client/src/client/create-caatinga-client.test.ts`
- Modify: `packages/client/src/client/caatinga-contract-client.test.ts`

- [ ] **Step 1: Update the happy-path mock in `create-caatinga-client.test.ts`**

Replace the `Client.increment()` transaction in `createClientConfig()` with:

```ts
class Client {
  increment() {
    return {
      toXDR() {
        return "AAAA_UNSIGNED";
      },
      async signAndSend(input: {
        signTransaction: (
          xdr: string,
          opts?: { networkPassphrase?: string; address?: string }
        ) => Promise<{ signedTxXdr: string }>;
      }) {
        const signed = await input.signTransaction("AAAA_UNSIGNED", {
          networkPassphrase: "Test SDF Network ; September 2015",
          address: "GPUBLIC"
        });
        return { txHash: `hash:${signed.signedTxXdr}`, result: 1 };
      }
    };
  }
}
```

- [ ] **Step 2: Keep the existing wallet assertion in `create-caatinga-client.test.ts`**

The existing assertion must remain:

```ts
expect(config.wallet.signTransaction).toHaveBeenCalledWith({
  xdr: "AAAA_UNSIGNED",
  networkPassphrase: "Test SDF Network ; September 2015"
});
```

This proves Caatinga's public wallet adapter did not change.

- [ ] **Step 3: Add a regression test to `caatinga-contract-client.test.ts`**

Append this test inside `describe("CaatingaContractClient (via createCaatingaClient)", () => { ... })`:

```ts
it("should_submit_with_stellar_sdk_signAndSend_signTransaction_callback", async () => {
  const signAndSend = vi.fn(async (input: {
    signTransaction: (
      xdr: string,
      opts?: { networkPassphrase?: string; address?: string }
    ) => Promise<{ signedTxXdr: string }>;
  }) => {
    const signed = await input.signTransaction("AAAA_PREPARED", {
      networkPassphrase: "Test SDF Network ; September 2015",
      address: "GPUBLIC"
    });
    return { txHash: `hash:${signed.signedTxXdr}`, result: 7 };
  });

  class Client {
    increment() {
      return {
        toXDR() {
          return "AAAA_PREPARED";
        },
        signAndSend
      };
    }
  }

  const config = createClientConfig({
    contracts: {
      counter: {
        binding: { Client }
      }
    }
  });

  const result = await createCaatingaClient(config).contract("counter").invoke("increment", {
    debugXdr: true
  });

  expect(signAndSend).toHaveBeenCalledWith(expect.objectContaining({
    signTransaction: expect.any(Function)
  }));
  expect(config.wallet.signTransaction).toHaveBeenCalledWith({
    xdr: "AAAA_PREPARED",
    networkPassphrase: "Test SDF Network ; September 2015"
  });
  expect(result).toMatchObject({
    status: "confirmed",
    transactionHash: "hash:AAAA_SIGNED",
    result: 7,
    xdr: {
      unsigned: "AAAA_PREPARED",
      prepared: "AAAA_PREPARED",
      signed: "AAAA_SIGNED"
    }
  });
});
```

- [ ] **Step 4: Add a legacy/custom no-arg `send()` fallback test to `caatinga-contract-client.test.ts`**

This fallback delegates submission and signing ownership to the custom transaction's `send()` implementation. Caatinga must not call its wallet signer on this path; Caatinga wallet signing belongs to the primary Stellar SDK `signAndSend({ signTransaction })` path.

Append this test:

```ts
it("should_fallback_to_send_when_signAndSend_is_not_available", async () => {
  const send = vi.fn(async () => ({ txHash: "hash:send", result: 3 }));

  class Client {
    increment() {
      return {
        toXDR() {
          return "AAAA_PREPARED";
        },
        send
      };
    }
  }

  const config = createClientConfig({
    contracts: {
      counter: {
        binding: { Client }
      }
    }
  });

  const result = await createCaatingaClient(config).contract("counter").invoke("increment");

  expect(config.wallet.signTransaction).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledWith();
  expect(result).toMatchObject({
    status: "confirmed",
    transactionHash: "hash:send",
    result: 3
  });
});
```

- [ ] **Step 5: Run the tests and verify they fail before implementation**

Run:

```bash
pnpm --filter @caatinga/client test -- src/client/create-caatinga-client.test.ts src/client/caatinga-contract-client.test.ts
```

Expected: at least one failure because `submitTransaction()` still passes `{ signedXdr }` instead of `{ signTransaction }`.

- [ ] **Step 6: Commit tests**

```bash
git add packages/client/src/client/create-caatinga-client.test.ts packages/client/src/client/caatinga-contract-client.test.ts
git commit -m "test(client): cover stellar sdk xdr submission flow"
```

### Task 2: Implement Stellar SDK Submission Adapter

**Files:**
- Modify: `packages/client/src/client/caatinga-contract-client.ts`

- [ ] **Step 1: Replace submit-related interfaces near the top of `caatinga-contract-client.ts`**

Replace:

```ts
interface SubmitTransactionLike {
  signAndSend?: (input?: { signedXdr: string }) => Promise<unknown> | unknown;
  send?: (input?: { signedXdr: string }) => Promise<unknown> | unknown;
}
```

With:

```ts
type StellarSdkSignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string }
) => Promise<{ signedTxXdr: string }> | { signedTxXdr: string };

interface SubmitTransactionLike {
  signAndSend?: (input?: { signTransaction?: StellarSdkSignTransaction }) => Promise<unknown> | unknown;
  send?: () => Promise<unknown> | unknown;
}
```

- [ ] **Step 2: Replace the manual pre-submit signing block inside `invoke()` with a Stellar SDK signer callback**

The Caatinga wallet adapter is invoked only when the generated transaction calls the provided `signTransaction` callback through `signAndSend({ signTransaction })`. The legacy/custom `send()` fallback remains no-arg and does not require Caatinga wallet signing.

Replace the existing `let signedXdr` try/catch and empty-string validation block with:

```ts
let signedXdr: string | undefined;
const signTransaction: StellarSdkSignTransaction = async (xdr) => {
  try {
    signedXdr = await this.withWalletTimeout("signTransaction", () =>
      this.config.wallet.signTransaction({
        xdr,
        networkPassphrase: this.config.network.networkPassphrase
      })
    );
  } catch (error) {
    if (error instanceof CaatingaError) {
      throw error;
    }

    throw new CaatingaError(
      `Failed to sign XDR for "${this.contractName}.${method}".`,
      CaatingaErrorCode.XDR_SIGN_FAILED,
      "Connect a wallet and approve the transaction.",
      error
    );
  }

  if (typeof signedXdr !== "string" || signedXdr.trim().length === 0) {
    throw new CaatingaError(
      `Failed to sign XDR for "${this.contractName}.${method}".`,
      CaatingaErrorCode.XDR_SIGN_FAILED,
      "Wallet returned an empty or invalid signed XDR. The user may have dismissed the signing prompt.",
      signedXdr
    );
  }

  return { signedTxXdr: signedXdr };
};
```

- [ ] **Step 3: Replace the `submitTransaction()` call inside `invoke()`**

Replace:

```ts
const raw = await submitTransaction(
  transaction,
  signedXdr,
  this.contractName,
  method,
  this.config.network.rpcUrl
);
```

With:

```ts
const raw = await submitTransaction(
  transaction,
  signTransaction,
  this.contractName,
  method,
  this.config.network.rpcUrl
);
```

- [ ] **Step 4: Guard `debugXdr.signed` because signing occurs inside submit**

Replace:

```ts
signed: signedXdr
```

With:

```ts
...(signedXdr ? { signed: signedXdr } : {})
```

The surrounding `xdr` object should become:

```ts
xdr: {
  unsigned: xdr.unsignedXdr,
  prepared: xdr.preparedXdr,
  ...(signedXdr ? { signed: signedXdr } : {})
}
```

- [ ] **Step 5: Replace the `submitTransaction()` signature and body**

Primary submission uses Stellar SDK `signAndSend({ signTransaction })`. If a transaction object lacks `signAndSend`, fall back to no-arg `send()` and let that custom transaction own its own submission/signing behavior.

Replace the entire `submitTransaction()` function with:

```ts
async function submitTransaction(
  transaction: unknown,
  signTransaction: StellarSdkSignTransaction,
  contractName: string,
  method: string,
  rpcUrl: string
): Promise<unknown> {
  const candidate = transaction as SubmitTransactionLike;

  if (typeof candidate.signAndSend === "function") {
    try {
      const raw = await candidate.signAndSend.call(transaction, { signTransaction });
      assertSubmitResultRecognized(raw, contractName, method);
      return raw;
    } catch (error) {
      if (error instanceof CaatingaError) {
        throw error;
      }

      throw new CaatingaError(
        `Failed to submit XDR for "${contractName}.${method}".`,
        CaatingaErrorCode.XDR_SUBMIT_FAILED,
        `RPC: ${rpcUrl}. Check wallet signature and RPC connectivity.`,
        error
      );
    }
  }

  if (typeof candidate.send === "function") {
    try {
      const raw = await candidate.send.call(transaction);
      assertSubmitResultRecognized(raw, contractName, method);
      return raw;
    } catch (error) {
      if (error instanceof CaatingaError) {
        throw error;
      }

      throw new CaatingaError(
        `Failed to submit XDR for "${contractName}.${method}".`,
        CaatingaErrorCode.XDR_SUBMIT_FAILED,
        `RPC: ${rpcUrl}. Check wallet signature and RPC connectivity.`,
        error
      );
    }
  }

  throw new CaatingaError(
    `Binding transaction for "${contractName}.${method}" cannot be submitted.`,
    CaatingaErrorCode.XDR_SUBMIT_FAILED,
    "Regenerate bindings or provide a compatible binding adapter."
  );
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @caatinga/client test -- src/client/create-caatinga-client.test.ts src/client/caatinga-contract-client.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit implementation**

```bash
git add packages/client/src/client/caatinga-contract-client.ts
git commit -m "fix(client): delegate xdr submission to generated bindings"
```

### Task 3: Align Stand-In Generated Bindings

**Files:**
- Modify: `packages/templates/react-vite-counter/src/contracts/generated/counter.ts`
- Modify: `examples/counter-web/src/contracts/generated/counter.ts`

- [ ] **Step 1: Replace the transaction helper in `packages/templates/react-vite-counter/src/contracts/generated/counter.ts`**

Replace the top helper types/classes with:

```ts
type TransactionResult = {
  txHash: string;
  result?: unknown;
};

type SignTransaction = (
  xdr: string,
  opts?: { networkPassphrase?: string; address?: string }
) => Promise<{ signedTxXdr: string }> | { signedTxXdr: string };

class ExampleTransaction {
  constructor(
    private readonly method: string,
    private readonly result?: unknown
  ) {}

  toXDR(): string {
    return `example-${this.method}-xdr`;
  }

  async prepare(): Promise<ExampleTransaction> {
    return this;
  }

  async signAndSend(input?: { signTransaction?: SignTransaction }): Promise<TransactionResult> {
    const signed = input?.signTransaction
      ? await input.signTransaction(this.toXDR())
      : { signedTxXdr: this.toXDR() };

    return {
      txHash: `example-transaction-hash:${signed.signedTxXdr}`,
      result: this.result
    };
  }
}
```

- [ ] **Step 2: Apply the same replacement in `examples/counter-web/src/contracts/generated/counter.ts`**

Use the exact same helper block from Step 1.

- [ ] **Step 3: Run client tests**

Run:

```bash
pnpm --filter @caatinga/client test
```

Expected: all client tests pass.

- [ ] **Step 4: Run template/example typecheck if available through package scripts**

Run:

```bash
pnpm typecheck
```

Expected: TypeScript passes across the workspace.

- [ ] **Step 5: Commit stand-in binding updates**

```bash
git add packages/templates/react-vite-counter/src/contracts/generated/counter.ts examples/counter-web/src/contracts/generated/counter.ts
git commit -m "test(client): align stand-in bindings with stellar sdk submission"
```

### Task 4: Update Client Documentation

**Files:**
- Modify: `docs/client.md`

- [ ] **Step 1: Replace the Binding Contract section**

Replace the existing numbered list under `## Binding Contract` with:

```md
The default binding adapter expects generated bindings to:

1. export `Client`
2. accept `contractId`, `publicKey`, `rpcUrl`, and `networkPassphrase`
3. expose contract methods on the client instance
4. return a transaction-like object with `toXDR()`
5. optionally expose `prepare()` for simulation/preparation
6. expose `signAndSend({ signTransaction })` for signed submission, where `signTransaction` returns `{ signedTxXdr }`

Caatinga adapts `CaatingaWalletAdapter.signTransaction({ xdr, networkPassphrase })` into the generated transaction's `signTransaction(xdr, opts)` callback. Caatinga does not parse XDR or serialize Soroban values.

If Stellar CLI changes this generated shape, the compatibility fix belongs in the binding adapter/client integration layer, not in application code.
```

- [ ] **Step 2: Run docs grep for stale `{ signedXdr }` contract language**

Run:

```bash
rg -n "signedXdr|signAndSend\\(\\)|signAndSend\\(\\{ signedXdr" docs packages/client/README.md packages/client/src
```

Expected: no docs claim that generated `signAndSend()` accepts `{ signedXdr }`. Code may still contain `signedXdr` internally as the wallet return bridge.

- [ ] **Step 3: Commit docs**

```bash
git add docs/client.md
git commit -m "docs(client): document stellar sdk xdr submission boundary"
```

### Task 5: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run client package tests**

Run:

```bash
pnpm --filter @caatinga/client test
```

Expected: all tests pass.

- [ ] **Step 2: Run core error surface tests**

Run:

```bash
pnpm --filter @caatinga/core test -- src/errors/error-surface.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run workspace typecheck**

Run:

```bash
pnpm typecheck
```

Expected: TypeScript passes.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git diff --stat
git diff -- packages/client/src/client/caatinga-contract-client.ts packages/client/src/client/create-caatinga-client.test.ts packages/client/src/client/caatinga-contract-client.test.ts docs/client.md
```

Expected: diff only changes XDR submission compatibility, tests, stand-in bindings, and docs.

- [ ] **Step 5: Commit final verification fixes if any**

If verification required follow-up edits, commit them:

```bash
git add packages/client docs examples packages/templates
git commit -m "fix(client): complete xdr submission compatibility"
```

If no follow-up edits were needed, do not create an empty commit.

---

## Self-Review

**Spec coverage:** Motivation, non-goals, prior art, interface contract, observability, and rollout/rollback are represented. Tasks cover tests, implementation, examples/templates, docs, and verification.

**Placeholder scan:** No `TBD`, `TODO`, "similar to", or undefined implementation steps remain. All code-changing steps include exact code blocks.

**Type consistency:** `StellarSdkSignTransaction`, `signedTxXdr`, `signAndSend({ signTransaction })`, and `CaatingaWalletAdapter.signTransaction({ xdr, networkPassphrase })` are named consistently across tests, implementation, and docs.
