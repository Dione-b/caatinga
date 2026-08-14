import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { ZkError } from "../errors/ZkError.js";

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

export async function verifyFileChecksum(
  filePath: string,
  expectedSha256: string,
  description: string
): Promise<void> {
  const actual = await sha256File(filePath);
  if (actual !== expectedSha256.toLowerCase()) {
    await unlink(filePath).catch(() => undefined);
    throw new ZkError(
      `Checksum mismatch for ${description}: expected ${expectedSha256}, got ${actual}`,
      "ZK_CHECKSUM_MISMATCH",
      "The downloaded file did not match its pinned checksum and was deleted. Do not retry " +
        "unless you have verified the release asset yourself — this may indicate a tampered " +
        "download or a compromised release."
    );
  }
}
