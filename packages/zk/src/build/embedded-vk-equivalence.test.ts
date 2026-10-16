import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { concatG1Bytes, concatG2Bytes } from "../serialization/curve-bytes.js";
import { serializeProof, type SnarkjsProof } from "../serialization/serialize-proof.js";
import { serializeVk, type SnarkjsVk } from "../serialization/serialize-vk.js";
import { generateVkRust } from "./build-circuit.js";

/**
 * Proves the embedded-VK entrypoint is equivalent to the dynamic one (#299):
 * the same proof is accepted by `verify_proof` and `verify_proof_embedded` when
 * `vk.rs` is generated from the matching key, and rejected by the embedded path
 * when `vk.rs` comes from a different key.
 *
 * Runs the real verifier scaffold under `cargo test`, with `vk.rs` produced by
 * `generateVkRust` — the code `ctg zk build --embed-vk` runs — so a serialization
 * mismatch between the two paths cannot hide behind mocks. Opt-in because the
 * first cargo build takes minutes: set CAATINGA_CARGO_TESTS=1.
 */

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const scaffoldDir = path.resolve(here, "../../../core/scaffolds/zk-verifier");
const fixturesDir = path.resolve(here, "../../test/fixtures");
// Real `snarkjs` output for the zk-starter multiplier circuit (a * b = 33).
const multiplierDir = path.join(fixturesDir, "multiplier");

const runCargoTests = process.env.CAATINGA_CARGO_TESTS === "1";

function rustBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => `0x${b.toString(16).padStart(2, "0")}`).join(", ");
}

function g1(bytes: Uint8Array): string {
  return `G1Affine::from_array(env, &[${rustBytes(bytes)}])`;
}

function g2(bytes: Uint8Array): string {
  return `G2Affine::from_array(env, &[${rustBytes(bytes)}])`;
}

/**
 * Rust test module comparing both entrypoints. The dynamic VK and the proof are
 * built from the same serialized bytes `ctg zk invoke` sends on-chain.
 */
function equivalenceTestRust(options: {
  proof: SnarkjsProof;
  vk: SnarkjsVk;
  publicSignal: number;
  expectEmbeddedMatch: boolean;
}): string {
  const proof = serializeProof(options.proof);
  const vk = serializeVk(options.vk);

  return `#![cfg(test)]
extern crate std;

use soroban_sdk::{
    crypto::bls12_381::{
        Bls12381Fr as Fr, Bls12381G1Affine as G1Affine, Bls12381G2Affine as G2Affine,
    },
    Env, Vec, U256,
};

use crate::{Groth16Verifier, Groth16VerifierClient, Proof, VerificationKey};

fn proof(env: &Env) -> Proof {
    Proof {
        a: ${g1(concatG1Bytes(proof.a))},
        b: ${g2(concatG2Bytes(proof.b))},
        c: ${g1(concatG1Bytes(proof.c))},
    }
}

fn dynamic_vk(env: &Env) -> VerificationKey {
    VerificationKey {
        alpha: ${g1(concatG1Bytes(vk.alpha))},
        beta: ${g2(concatG2Bytes(vk.beta))},
        gamma: ${g2(concatG2Bytes(vk.gamma))},
        delta: ${g2(concatG2Bytes(vk.delta))},
        ic: Vec::from_array(env, [${vk.ic.map((point) => g1(concatG1Bytes(point))).join(", ")}]),
    }
}

fn signals(env: &Env, value: u32) -> Vec<Fr> {
    Vec::from_array(env, [Fr::from_u256(U256::from_u32(env, value))])
}

#[test]
fn embedded_and_dynamic_vk_agree() {
    let env = Env::default();
    let client = Groth16VerifierClient::new(&env, &env.register(Groth16Verifier {}, ()));
    let proof = proof(&env);
    let vk = dynamic_vk(&env);
    let good = signals(&env, ${options.publicSignal});
    let bad = signals(&env, ${options.publicSignal + 1});

    assert!(client.verify_proof(&vk, &proof, &good));
    assert!(!client.verify_proof(&vk, &proof, &bad));
    assert_eq!(client.verify_proof_embedded(&proof, &good), ${options.expectEmbeddedMatch});
    assert!(!client.verify_proof_embedded(&proof, &bad));
}
`;
}

describe.skipIf(!runCargoTests)("embedded VK equivalence (cargo)", () => {
  let crateDir: string;
  let proof: SnarkjsProof;
  let matchingVkJson: string;
  let otherVkJson: string;
  let publicSignal: number;

  beforeAll(async () => {
    crateDir = await mkdtemp(path.join(tmpdir(), "caatinga-zk-verifier-"));
    await cp(scaffoldDir, crateDir, {
      recursive: true,
      filter: (source) => !source.includes(`${path.sep}target`),
    });

    proof = JSON.parse(await readFile(path.join(multiplierDir, "proof.json"), "utf8"));
    matchingVkJson = await readFile(path.join(multiplierDir, "verification_key.json"), "utf8");
    // A valid key for a different circuit with the same public-signal count, so the
    // embedded path reaches the pairing check instead of failing on the IC length.
    otherVkJson = await readFile(
      path.join(fixturesDir, "verification_key_snarkjs_export.json"),
      "utf8"
    );
    const publicSignals = JSON.parse(
      await readFile(path.join(multiplierDir, "public.json"), "utf8")
    ) as string[];
    publicSignal = Number.parseInt(publicSignals[0]!, 10);
  });

  afterAll(async () => {
    if (crateDir) {
      await rm(crateDir, { recursive: true, force: true });
    }
  });

  async function cargoTest(embeddedVkJson: string, expectEmbeddedMatch: boolean): Promise<void> {
    await writeFile(path.join(crateDir, "src", "vk.rs"), generateVkRust("vk.json", embeddedVkJson));
    await writeFile(
      path.join(crateDir, "src", "test.rs"),
      equivalenceTestRust({
        proof,
        vk: JSON.parse(matchingVkJson) as SnarkjsVk,
        publicSignal,
        expectEmbeddedMatch,
      })
    );

    await execFileAsync("cargo", ["test", "--quiet"], {
      cwd: crateDir,
      env: {
        ...process.env,
        // Shared across runs so only the first one pays for compiling soroban-sdk.
        CARGO_TARGET_DIR:
          process.env.CARGO_TARGET_DIR ?? path.join(tmpdir(), "caatinga-zk-verifier-target"),
      },
      maxBuffer: 16 * 1024 * 1024,
    });
  }

  it("accepts the same proof through verify_proof and verify_proof_embedded", async () => {
    await expect(cargoTest(matchingVkJson, true)).resolves.toBeUndefined();
  }, 900_000);

  it("rejects the proof through verify_proof_embedded when vk.rs holds a different key", async () => {
    await expect(cargoTest(otherVkJson, false)).resolves.toBeUndefined();
  }, 900_000);

  it("fails the cargo run when embedded verification is expected but the key differs", async () => {
    // Guards the guard: if the assertions above could never fail, a broken
    // embedded path would still look green.
    await expect(cargoTest(otherVkJson, true)).rejects.toThrow();
  }, 900_000);
});
