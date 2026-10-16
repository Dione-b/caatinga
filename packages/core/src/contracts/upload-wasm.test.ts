import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaatingaError, CaatingaErrorCode } from "../errors/CaatingaError.js";

const runCommand = vi.hoisted(() => vi.fn());

vi.mock("../shell/run-command.js", () => ({
  runCommand,
}));

import { uploadWasm } from "./upload-wasm.js";

describe("uploadWasm", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should_throw_upload_failed_when_stellar_upload_fails", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-upload-"));
    const wasmPath = path.join(tmpDir, "contract.wasm");
    await writeFile(wasmPath, Buffer.from("wasm"));

    runCommand.mockRejectedValueOnce(
      new CaatingaError("upload failed", CaatingaErrorCode.UPLOAD_FAILED)
    );

    await expect(
      uploadWasm({
        wasmPath,
        network: {
          name: "testnet",
          config: {
            rpcUrl: "https://soroban-testnet.stellar.org",
            networkPassphrase: "Test SDF Network ; September 2015",
          },
        },
        source: "deployer",
        cwd: tmpDir,
      })
    ).rejects.toMatchObject({ code: CaatingaErrorCode.UPLOAD_FAILED });
  });

  it("should_accept_a_new_upload_whose_stderr_logs_the_transaction_hash_first", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-upload-"));
    const wasmPath = path.join(tmpDir, "contract.wasm");
    await writeFile(wasmPath, Buffer.from("wasm"));
    const { createHash } = await import("node:crypto");
    const wasmHash = createHash("sha256").update(Buffer.from("wasm")).digest("hex");
    const txHash = "6a5e8599dd0964dcf15079111b10b3ce9a2b345857067499bee3a24c2c16889d";
    const stderr = [
      "ℹ️  Simulating transaction…",
      `ℹ️  Signing transaction: ${txHash}`,
      "🌎 Sending transaction…",
      "✅ Transaction submitted successfully!",
      `🔗 https://stellar.expert/explorer/testnet/tx/${txHash}`,
    ].join("\n");
    // checkBinary goes through runCommand too, so every call gets this result.
    runCommand.mockResolvedValue({
      stdout: wasmHash,
      stderr,
      all: `${stderr}\n${wasmHash}`,
    });

    await expect(
      uploadWasm({
        wasmPath,
        network: {
          name: "testnet",
          config: {
            rpcUrl: "https://soroban-testnet.stellar.org",
            networkPassphrase: "Test SDF Network ; September 2015",
          },
        },
        source: "deployer",
        cwd: tmpDir,
      })
    ).resolves.toMatchObject({ wasmHash });
  });
});
