import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { ZkError } from "../errors/ZkError.js";

type ChecksumContext = {
  /** Version of the tool the artifact belongs to, e.g. `2.1.9`. */
  version?: string;
  /** Where the artifact was downloaded from. */
  downloadUrl?: string;
  /** GitHub release the pinned checksum was recorded from. */
  releaseUrl?: string;
};

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

/**
 * Fails the operation when a downloaded or cached tool does not match its
 * pinned SHA-256.
 *
 * The message deliberately carries the release and download URLs: a mismatch
 * is a possible supply-chain signal, and the operator needs somewhere concrete
 * to look rather than a bare hash comparison. It never retries — an automatic
 * re-download after a checksum failure would defeat the point of pinning.
 */
export async function verifyFileChecksum(
  filePath: string,
  expectedSha256: string,
  description: string,
  context?: ChecksumContext
): Promise<void> {
  const actual = await sha256File(filePath);
  if (actual !== expectedSha256.toLowerCase()) {
    await unlink(filePath).catch(() => undefined);

    const details = [`expected ${expectedSha256}`, `got ${actual}`];
    if (context?.version) {
      details.push(`pinned version ${context.version}`);
    }

    let hint =
      `The ${description} did not match its pinned checksum and was deleted. ` +
      `Do not retry blindly. Verify the release asset yourself (${context?.releaseUrl ?? "the upstream GitHub release"}) ` +
      `before re-running, and compare the published checksum against the one pinned in packages/zk/src/install/lazy-install-zk-tools.ts.`;

    if (context?.downloadUrl) {
      hint += `\n\nDownloaded from: ${context.downloadUrl}`;
    }
    if (context?.releaseUrl) {
      hint += `\nRelease page: ${context.releaseUrl}`;
    }
    hint +=
      "\n\nIf this is a newly supported platform or a new version, the checksum pin needs updating in Caatinga itself — treat the mismatch as a possible supply-chain compromise, not a flaky download.";

    throw new ZkError(
      `Checksum mismatch for ${description}: ${details.join(", ")}`,
      "ZK_CHECKSUM_MISMATCH",
      hint
    );
  }
}
