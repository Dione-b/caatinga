// PLACEHOLDER verification key shipped with the scaffold.
//
// `ctg zk build <circuit> --embed-vk` overwrites this file with the real
// BLS12-381 coordinates from verification_key.json. Until then this entrypoint
// traps on purpose: verifying against an empty or wrong key would produce a
// confidently wrong answer, which is worse than a clear failure.
use soroban_sdk::crypto::bls12_381::{Bls12381G1Affine as G1Affine, Bls12381G2Affine as G2Affine};
use soroban_sdk::{Env, Vec};

pub fn embedded_vk(_env: &Env) -> (G1Affine, G2Affine, G2Affine, G2Affine, Vec<G1Affine>) {
    panic!(
        "embedded_vk() is the scaffold placeholder. Run `ctg zk build <circuit> --embed-vk` to generate the real verification key."
    );
}
