import { Buffer } from "buffer";
import type { VerifyProofBindingArgs } from "@caatinga/zk/browser";

export function toBindingVerifyProofArgs(args: VerifyProofBindingArgs) {
  return {
    vk: {
      alpha: Buffer.from(args.vk.alpha),
      beta: Buffer.from(args.vk.beta),
      gamma: Buffer.from(args.vk.gamma),
      delta: Buffer.from(args.vk.delta),
      ic: args.vk.ic.map((point: Uint8Array) => Buffer.from(point)),
    },
    proof: {
      a: Buffer.from(args.proof.a),
      b: Buffer.from(args.proof.b),
      c: Buffer.from(args.proof.c),
    },
    pub_signals: args.pub_signals,
  };
}
