import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertDevCeremonyAllowed,
  ceremonyManifestPath,
  isProductionNetwork,
  writeDevCeremonyManifest,
} from "./dev-ceremony.js";

const tmpRoot = path.join(process.cwd(), ".artifacts", "zk-test-ceremony");

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe("dev-ceremony", () => {
  it("should_identify_mainnet_as_production_network", () => {
    expect(isProductionNetwork("mainnet")).toBe(true);
    expect(isProductionNetwork("testnet")).toBe(false);
  });

  it("should_write_and_read_dev_ceremony_manifest", async () => {
    await mkdir(tmpRoot, { recursive: true });
    await writeDevCeremonyManifest(tmpRoot);

    const raw = await readFile(ceremonyManifestPath(tmpRoot), "utf8");
    const parsed = JSON.parse(raw) as { type: string; generatedAt: string };

    expect(parsed.type).toBe("dev-single-party");
    expect(parsed.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("should_block_mainnet_when_dev_manifest_exists", async () => {
    await mkdir(tmpRoot, { recursive: true });
    await writeDevCeremonyManifest(tmpRoot);

    await expect(
      assertDevCeremonyAllowed({
        networkName: "mainnet",
        artifactsDir: tmpRoot,
        allowDevCeremony: false,
        operation: "caatinga zk invoke",
      })
    ).rejects.toMatchObject({ code: "ZK_DEV_CEREMONY_BLOCKED" });
  });

  it("should_allow_mainnet_when_allowDevCeremony_is_true", async () => {
    await mkdir(tmpRoot, { recursive: true });
    await writeDevCeremonyManifest(tmpRoot);

    await expect(
      assertDevCeremonyAllowed({
        networkName: "mainnet",
        artifactsDir: tmpRoot,
        allowDevCeremony: true,
        operation: "caatinga zk invoke",
      })
    ).resolves.toBeUndefined();
  });

  it("should_allow_testnet_with_dev_manifest", async () => {
    await mkdir(tmpRoot, { recursive: true });
    await writeDevCeremonyManifest(tmpRoot);

    await expect(
      assertDevCeremonyAllowed({
        networkName: "testnet",
        artifactsDir: tmpRoot,
        allowDevCeremony: false,
        operation: "caatinga zk invoke",
      })
    ).resolves.toBeUndefined();
  });
});
