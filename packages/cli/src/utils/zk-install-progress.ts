import type { ZkInstallProgress } from "@caatinga/zk";
import { logger } from "./logger.js";

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderDownloadProgress(loaded: number, total?: number): void {
  if (total && total > 0) {
    const pct = Math.min(100, Math.round((loaded / total) * 100));
    const filled = Math.round(pct / 5);
    const bar = "=".repeat(filled) + "-".repeat(20 - filled);
    process.stderr.write(`\r[${bar}] ${pct}% (${formatBytes(loaded)}/${formatBytes(total)})`);
    if (loaded >= total) {
      process.stderr.write("\n");
    }
    return;
  }

  process.stderr.write(`\rDownloading… ${formatBytes(loaded)}`);
}

export function createZkInstallProgress(): ZkInstallProgress {
  let downloadActive = false;

  return {
    onStatus(message) {
      if (downloadActive) {
        process.stderr.write("\n");
        downloadActive = false;
      }
      logger.info(message);
    },
    onDownloadProgress(loaded, total) {
      downloadActive = true;
      renderDownloadProgress(loaded, total);
    },
    onDownloadComplete() {
      if (downloadActive) {
        process.stderr.write("\n");
        downloadActive = false;
      }
    },
  };
}
