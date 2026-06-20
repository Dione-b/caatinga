import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { ZkInstallProgress } from "./install-progress.js";
import { ZkError } from "../errors/ZkError.js";

export async function downloadWithProgress(
  url: string,
  destinationPath: string,
  progress?: ZkInstallProgress
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new ZkError(
      `Failed to download ${url}: HTTP ${response.status}`,
      "ZK_DOWNLOAD_FAILED",
      "Check your network connection and try again."
    );
  }

  if (!response.body) {
    throw new ZkError(
      `Failed to download ${url}: empty response body`,
      "ZK_DOWNLOAD_FAILED",
      "Check your network connection and try again."
    );
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? Number.parseInt(contentLength, 10) : undefined;
  let loaded = 0;

  const reader = response.body.getReader();
  const nodeStream = Readable.from(
    (async function* () {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        loaded += value.byteLength;
        progress?.onDownloadProgress?.(loaded, total);
        yield Buffer.from(value);
      }
    })()
  );

  await pipeline(nodeStream, createWriteStream(destinationPath));
  progress?.onDownloadComplete?.();
}
