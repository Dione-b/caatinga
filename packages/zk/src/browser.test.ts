import { describe, expect, it } from "vitest";
import proofFixture from "../test/fixtures/proof.json" with { type: "json" };
import vkFixture from "../test/fixtures/verification_key.json" with { type: "json" };
import publicFixture from "../test/fixtures/public.json" with { type: "json" };
import { buildVerifyProofBindingArgs } from "./browser/build-verify-proof-binding-args.js";
import { type SnarkjsProof } from "./serialization/serialize-proof.js";
import { type SnarkjsVk } from "./serialization/serialize-vk.js";

const proof = proofFixture as SnarkjsProof;
const vk = vkFixture as SnarkjsVk;
const publicSignals = publicFixture as string[];

describe("buildVerifyProofBindingArgs", () => {
  it("should_build_binding_shapes_matching_stellar_contract_bindings", () => {
    const args = buildVerifyProofBindingArgs({
      proof,
      vk,
      publicSignals,
    });

    expect(args.proof.a).toHaveLength(96);
    expect(args.proof.b).toHaveLength(192);
    expect(args.proof.c).toHaveLength(96);
    expect(args.vk.alpha).toHaveLength(96);
    expect(args.vk.beta).toHaveLength(192);
    expect(args.vk.ic).toHaveLength(2);
    expect(args.vk.ic[0]).toHaveLength(96);
    expect(args.pub_signals).toEqual([33n]);
  });

  it("should_fail_when_vk_is_missing", () => {
    expect(() =>
      buildVerifyProofBindingArgs({
        proof,
        vk: undefined as unknown as SnarkjsVk,
        publicSignals,
      })
    ).toThrow(/Verification key is required/);
  });
});
