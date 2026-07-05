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
});
