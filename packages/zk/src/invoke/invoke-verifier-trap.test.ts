import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaatingaError, CaatingaErrorCode, type CaatingaConfig } from "@caatinga/core";
import proofFixture from "../../test/fixtures/multiplier/proof.json" with { type: "json" };
import { invokeVerifier } from "./invoke-verifier.js";

const invokeContractMock = vi.hoisted(() => vi.fn());

vi.mock("@caatinga/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@caatinga/core")>();
  return { ...actual, invokeContract: invokeContractMock };
});

// What the Stellar CLI reported on testnet when verify_proof_embedded ran against
// a verifier deployed with the scaffold's placeholder vk.rs.
const PLACEHOLDER_TRAP =
  '0: [Diagnostic Event] contract:CBHU5PQUABYJCNYTUMNTKQGVCQNUH73XGDVLR4ZYLOEVSKF4XWNGVKBX, topics:[error, Error(WasmVm, InvalidAction)], data:["VM call trapped: UnreachableCodeReached", verify_proof_embedded]';

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-invoke-"));
  await writeFile(path.join(cwd, "proof.json"), JSON.stringify(proofFixture));
  await writeFile(path.join(cwd, "public.json"), JSON.stringify(["33"]));
  invokeContractMock.mockReset();
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

function invoke(embedVk: boolean) {
  return invokeVerifier({
    verifierContract: "verifier",
    network: "testnet",
    sourceAccount: "alice",
    proofPath: "proof.json",
    vkPath: "verification_key.json",
    publicSignalsPath: "public.json",
    embedVk,
    cwd,
    config: {} as CaatingaConfig,
  });
}

describe("invokeVerifier against a verifier that still has the placeholder key", () => {
  it("should_report_CAATINGA_ZK_EMBED_VK_UNSUPPORTED_with_a_redeploy_hint", async () => {
    invokeContractMock.mockRejectedValue(
      new CaatingaError(`Command failed\n${PLACEHOLDER_TRAP}`, CaatingaErrorCode.INVOKE_FAILED)
    );

    await expect(invoke(true)).rejects.toMatchObject({
      code: CaatingaErrorCode.ZK_EMBED_VK_UNSUPPORTED,
      hint: expect.stringContaining("ctg deploy verifier --upgrade"),
    });
  });

  it("should_leave_other_invoke_failures_untouched", async () => {
    const failure = new CaatingaError("network unreachable", CaatingaErrorCode.INVOKE_FAILED);
    invokeContractMock.mockRejectedValue(failure);

    await expect(invoke(true)).rejects.toBe(failure);
  });
});
