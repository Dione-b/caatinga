import { describe, expect, it } from "vitest";
import proofFixture from "../../test/fixtures/proof.json" with { type: "json" };
import vkFixture from "../../test/fixtures/verification_key.json" with { type: "json" };
import publicFixture from "../../test/fixtures/public.json" with { type: "json" };
import { type SnarkjsProof } from "../serialization/serialize-proof.js";
import { type SnarkjsVk } from "../serialization/serialize-vk.js";
import { buildStellarVerifyProofArgs } from "./invoke-verifier.js";

const proof = proofFixture as SnarkjsProof;
const vk = vkFixture as SnarkjsVk;
const publicSignals = publicFixture as string[];

describe("buildStellarVerifyProofArgs", () => {
  it("should_build_named_stellar_cli_flags_with_concatenated_curve_points", () => {
    const args = buildStellarVerifyProofArgs({
      proof,
      vk,
      publicSignals,
      embedVk: false,
    });

    expect(args).toEqual([
      "--vk",
      expect.any(String),
      "--proof",
      expect.any(String),
      "--pub_signals",
      '["33"]',
    ]);

    const vkArg = JSON.parse(args[1]!) as {
      alpha: string;
      beta: string;
      gamma: string;
      delta: string;
      ic: string[];
    };
    expect(vkArg.alpha).toHaveLength(192);
    expect(vkArg.beta).toHaveLength(384);
    expect(vkArg.ic).toHaveLength(2);
    expect(vkArg.ic[0]).toHaveLength(192);

    const proofArg = JSON.parse(args[3]!) as { a: string; b: string; c: string };
    expect(proofArg.a).toHaveLength(192);
    expect(proofArg.b).toHaveLength(384);
    expect(proofArg.c).toHaveLength(192);
  });

  it("should_omit_vk_flag_when_embedVk_is_true", () => {
    const args = buildStellarVerifyProofArgs({
      proof,
      publicSignals,
      embedVk: true,
    });

    expect(args).not.toContain("--vk");
    expect(args).toEqual(["--proof", expect.any(String), "--pub_signals", '["33"]']);
  });

  it("should_fail_when_vk_is_missing_for_dynamic_mode", () => {
    expect(() =>
      buildStellarVerifyProofArgs({
        proof,
        publicSignals,
        embedVk: false,
      })
    ).toThrow(/Verification key is required/);
  });
});
