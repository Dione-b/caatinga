import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
  async function writeLocalVk(source: string) {
    const dir = path.join(cwd, "contracts", "verifier", "src");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "vk.rs"), source);
  }

  function trap() {
    invokeContractMock.mockRejectedValue(
      new CaatingaError(`Command failed\n${PLACEHOLDER_TRAP}`, CaatingaErrorCode.INVOKE_FAILED)
    );
  }

  it("should_ask_for_zk_build_embed_vk_first_when_the_local_vk_is_still_the_placeholder", async () => {
    await writeLocalVk("// PLACEHOLDER verification key shipped with the scaffold.\n");
    trap();

    await expect(invoke(true)).rejects.toMatchObject({
      code: CaatingaErrorCode.ZK_EMBED_VK_UNSUPPORTED,
      message: expect.stringContaining("most likely"),
      hint: expect.stringMatching(
        /ctg zk build <circuit> --embed-vk.*ctg deploy verifier --upgrade/
      ),
    });
  });

  it("should_ask_for_zk_build_embed_vk_first_when_there_is_no_local_vk", async () => {
    trap();

    await expect(invoke(true)).rejects.toMatchObject({
      hint: expect.stringContaining("ctg zk build <circuit> --embed-vk"),
    });
  });

  it("should_only_ask_for_a_redeploy_when_the_local_vk_is_real", async () => {
    await writeLocalVk("pub fn embedded_vk(env: &Env) { /* generated */ }\n");
    trap();

    const error = (await invoke(true).catch((e: unknown) => e)) as CaatingaError;
    expect(error).toMatchObject({
      code: CaatingaErrorCode.ZK_EMBED_VK_UNSUPPORTED,
      hint: expect.stringContaining("ctg deploy verifier --upgrade"),
    });
    expect(error.hint).not.toContain("--embed-vk");
  });

  it("should_leave_other_invoke_failures_untouched", async () => {
    const failure = new CaatingaError("network unreachable", CaatingaErrorCode.INVOKE_FAILED);
    invokeContractMock.mockRejectedValue(failure);

    await expect(invoke(true)).rejects.toBe(failure);
  });
});
