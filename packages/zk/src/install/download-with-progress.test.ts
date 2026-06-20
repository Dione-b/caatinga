import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadWithProgress } from "./download-with-progress.js";

describe("downloadWithProgress", () => {
  let tempDir = "";

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("should_stream_download_and_report_progress", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-download-"));
    const destination = path.join(tempDir, "circom");
    const payload = Buffer.from("circom-binary-chunk");
    const progressCalls: Array<{ loaded: number; total?: number }> = [];
    let completed = false;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-length" ? String(payload.length) : null;
          },
        },
        body: {
          getReader() {
            let sent = false;
            return {
              async read() {
                if (sent) {
                  return { done: true, value: undefined };
                }
                sent = true;
                return { done: false, value: payload };
              },
            };
          },
        },
      }))
    );

    await downloadWithProgress("https://example.com/circom", destination, {
      onDownloadProgress(loaded, total) {
        progressCalls.push({ loaded, total });
      },
      onDownloadComplete() {
        completed = true;
      },
    });

    expect(await readFile(destination)).toEqual(payload);
    expect(progressCalls.at(-1)).toEqual({ loaded: payload.length, total: payload.length });
    expect(completed).toBe(true);
  });

  it("should_throw_ZkError_when_response_is_not_ok", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-download-"));
    const destination = path.join(tempDir, "circom");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        headers: { get: () => null },
        body: null,
      }))
    );

    await expect(
      downloadWithProgress("https://example.com/missing", destination)
    ).rejects.toMatchObject({
      name: "ZkError",
      code: "ZK_DOWNLOAD_FAILED",
    });
  });
});
