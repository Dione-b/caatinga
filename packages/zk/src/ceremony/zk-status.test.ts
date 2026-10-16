import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectZkStatus } from "./zk-status.js";
import { hashCircuitSources } from "./import-ceremony.js";
import { writeDevCeremonyManifest, writeMpcCeremonyManifest } from "./dev-ceremony.js";
import type { CaatingaConfig } from "@caatinga/core";

let cwd: string;

const config: CaatingaConfig = {
  project: "zk-app",
  defaultNetwork: "testnet",
  contracts: {},
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  },
  zk: {
    circuits: {
      main: {
        path: "circuits",
        protocol: "groth16",
        curve: "bls12381",
        verifierContract: "verifier",
      },
    },
  },
};

async function artifactsDir(): Promise<string> {
  const dir = path.join(cwd, ".artifacts", "zk", "main");
  await mkdir(dir, { recursive: true });
  return dir;
}

beforeEach(async () => {
  cwd = await mkdtemp(path.join(os.tmpdir(), "caatinga-zk-status-"));
  await mkdir(path.join(cwd, "circuits"), { recursive: true });
  await writeFile(path.join(cwd, "circuits", "main.circom"), "template Main() {}");
  await writeFile(path.join(cwd, "circuits", "input.json"), JSON.stringify({ a: "1" }));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe("collectZkStatus", () => {
  it("should_report_a_circuit_that_has_not_been_built", async () => {
    const [status] = await collectZkStatus({ config, cwd });

    expect(status?.name).toBe("main");
    expect(status?.status).toBe("not-built");
    expect(status?.advisories.join(" ")).toContain("ctg zk build");
  });

  it("should_report_a_dev_ceremony_without_guessing_circuit_drift", async () => {
    const dir = await artifactsDir();
    await writeDevCeremonyManifest(dir);

    const [status] = await collectZkStatus({ config, cwd });

    // A dev manifest records no circuit hash, so drift is unknowable and must
    // not be reported as either fresh or stale.
    expect(status?.ceremonyType).toBe("dev-single-party");
    expect(status?.status).toBe("up-to-date");
    expect(status?.circuitChanged).toBeUndefined();
  });

  it("should_report_input_drift_against_the_last_proof", async () => {
    const dir = await artifactsDir();
    await writeDevCeremonyManifest(dir);
    await writeFile(
      path.join(dir, "prove.json"),
      JSON.stringify({ circuitName: "main", inputHash: "not-the-current-hash", publicSignals: 0 })
    );

    const [status] = await collectZkStatus({ config, cwd });

    expect(status?.inputChanged).toBe(true);
    expect(status?.status).toBe("input-changed");
    expect(status?.advisories.join(" ")).toContain("changed since");
  });

  it("should_not_report_input_drift_before_any_proof_exists", async () => {
    const dir = await artifactsDir();
    await writeDevCeremonyManifest(dir);
    // No prove.json: there is no recorded input to compare against, so a
    // changed input.json must not be reported as drift.
    await writeFile(path.join(cwd, "circuits", "input.json"), JSON.stringify({ a: "changed" }));

    const [status] = await collectZkStatus({ config, cwd });

    expect(status?.inputChanged).toBeUndefined();
    expect(status?.status).toBe("up-to-date");
  });

  it("should_detect_verification_key_drift_after_a_ceremony_import", async () => {
    const dir = await artifactsDir();
    await writeDevCeremonyManifest(dir);
    await writeFile(path.join(dir, "prove.json"), JSON.stringify({ vkHash: "old-vk-hash" }));
    // The imported ceremony's key replaces the one the proof was made against.
    await writeFile(path.join(dir, "verification_key.json"), JSON.stringify({ IC: [] }));

    const [status] = await collectZkStatus({ config, cwd });

    expect(status?.vkChanged).toBe(true);
    expect(status?.status).toBe("vk-changed");
    expect(status?.advisories.join(" ")).toContain("verification key changed since");
  });

  it("should_not_report_key_drift_when_the_key_is_unchanged", async () => {
    const dir = await artifactsDir();
    await writeDevCeremonyManifest(dir);
    const vkContents = JSON.stringify({
      IC: [
        ["1", "2", "3"],
        ["4", "5", "6"],
      ],
    });
    await writeFile(path.join(dir, "verification_key.json"), vkContents);
    await writeFile(
      path.join(dir, "prove.json"),
      JSON.stringify({ vkHash: createHash("sha256").update(vkContents).digest("hex") })
    );

    const [status] = await collectZkStatus({ config, cwd });

    expect(status?.vkChanged).toBeUndefined();
  });

  it("should_detect_circuit_drift_on_an_mpc_ceremony", async () => {
    const dir = await artifactsDir();
    await writeMpcCeremonyManifest(dir, {
      circuitHash: "a".repeat(64),
      publicSignals: 0,
    });
    await writeFile(path.join(cwd, "circuits", "main.circom"), "template Main() {} // changed");

    const [status] = await collectZkStatus({ config, cwd });

    expect(status?.circuitChanged).toBe(true);
    expect(status?.status).toBe("circuit-changed");
    expect(status?.ceremonyType).toBe("mpc-multi-party");
  });

  it("should_report_up_to_date_when_the_mpc_circuit_hash_matches", async () => {
    const dir = await artifactsDir();
    const hash = await hashCircuitSources(path.join(cwd, "circuits"));
    await writeMpcCeremonyManifest(dir, { circuitHash: hash, publicSignals: 0 });

    const [status] = await collectZkStatus({ config, cwd });

    expect(status?.status).toBe("up-to-date");
    expect(status?.circuitChanged).toBeUndefined();
  });

  it("should_note_a_missing_input_file", async () => {
    const dir = await artifactsDir();
    await writeDevCeremonyManifest(dir);
    await rm(path.join(cwd, "circuits", "input.json"));

    const [status] = await collectZkStatus({ config, cwd });

    expect(status?.inputExists).toBe(false);
    expect(status?.advisories.join(" ")).toContain("No input.json");
  });

  it("should_return_nothing_for_a_project_without_zk_circuits", async () => {
    await expect(collectZkStatus({ config: { ...config, zk: undefined }, cwd })).resolves.toEqual(
      []
    );
  });
});
