#!/usr/bin/env node
// Measures on-chain Groth16 verification cost on a live network (#301).
//
// For each requested public-signal count N it generates a circuit with N public
// outputs, runs a dev trusted setup, proves it, and simulates `verify_proof`
// against an already-deployed verifier with the same arguments `ctg zk invoke`
// sends. Simulation only: nothing is submitted and no XLM is spent, but the
// numbers are the network's own resource accounting, not a local estimate.
//
// The verifier takes the VK as an argument (dynamic VK), so one deployed
// contract measures every circuit size.
//
//   node scripts/zk-verify-benchmark.mjs --contract-id C... --source alice \
//     --network testnet --sizes 1,2,4,8,16,32 --out smoke-ci-out/zk-benchmark
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { buildStellarVerifyProofArgs } = await import(
  path.join(ROOT_DIR, "packages/zk/dist/index.js")
);
const { estimateZkVerifyCost } = await import(path.join(ROOT_DIR, "packages/core/dist/index.js"));

const zkTools = path.join(homedir(), ".caatinga", "zk-tools");
const { values } = parseArgs({
  options: {
    "contract-id": { type: "string" },
    source: { type: "string" },
    network: { type: "string", default: "testnet" },
    sizes: { type: "string", default: "1,2,4,8,16,32" },
    out: { type: "string", default: path.join(ROOT_DIR, "smoke-ci-out", "zk-benchmark") },
    circom: {
      type: "string",
      default: path.join(zkTools, "circom", "2.1.9", "circom-linux-amd64"),
    },
    snarkjs: {
      type: "string",
      default: path.join(zkTools, "snarkjs-0.7.5", "node_modules", ".bin", "snarkjs"),
    },
    // Power 8 covers circuits up to 2^8 constraints, far beyond the sizes here.
    ptau: { type: "string", default: path.join(zkTools, "ptau", "bls12-381", "pot8_final.ptau") },
  },
});

const contractId = values["contract-id"];
if (!contractId || !values.source) {
  console.error(
    "Usage: zk-verify-benchmark.mjs --contract-id <C...> --source <identity> [--network testnet] [--sizes 1,2,4]"
  );
  process.exit(64);
}

const sizes = values.sizes.split(",").map((size) => Number.parseInt(size, 10));
const run = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });

function circuitSource(n) {
  return `pragma circom 2.1.6;

template Products(n) {
    signal input a[n];
    signal input b[n];
    signal output c[n];
    for (var i = 0; i < n; i++) {
        c[i] <== a[i] * b[i];
    }
}

component main = Products(${n});
`;
}

/** Compiles, sets up and proves the N-output circuit; returns its artifacts dir. */
function proveCircuit(n, workDir) {
  const dir = path.join(workDir, `n${n}`);
  mkdirSync(dir, { recursive: true });
  const p = (file) => path.join(dir, file);

  writeFileSync(p("main.circom"), circuitSource(n));
  run(values.circom, [p("main.circom"), "--r1cs", "--wasm", "-p", "bls12381", "-o", dir]);
  run(values.snarkjs, ["groth16", "setup", p("main.r1cs"), values.ptau, p("circuit_final.zkey")]);
  run(values.snarkjs, [
    "zkey",
    "export",
    "verificationkey",
    p("circuit_final.zkey"),
    p("verification_key.json"),
  ]);

  const input = {
    a: Array.from({ length: n }, (_, i) => String(i + 2)),
    b: Array.from({ length: n }, (_, i) => String(i + 3)),
  };
  writeFileSync(p("input.json"), JSON.stringify(input));
  run(values.snarkjs, [
    "wtns",
    "calculate",
    p("main_js/main.wasm"),
    p("input.json"),
    p("witness.wtns"),
  ]);
  run(values.snarkjs, [
    "groth16",
    "prove",
    p("circuit_final.zkey"),
    p("witness.wtns"),
    p("proof.json"),
    p("public.json"),
  ]);
  return dir;
}

function invokeArgs(dir) {
  const read = (file) => JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  return buildStellarVerifyProofArgs({
    proof: read("proof.json"),
    vk: read("verification_key.json"),
    publicSignals: read("public.json"),
    embedVk: false,
  });
}

function measure(n, dir) {
  const target = [
    "contract",
    "invoke",
    "--id",
    contractId,
    "--source",
    values.source,
    "--network",
    values.network,
  ];
  const args = invokeArgs(dir);

  // The value the verifier returns, from a read-only simulation.
  const verified = run("stellar", [...target, "--send=no", "--", "verify_proof", ...args]).trim();

  // The network's resource accounting for the same call.
  const built = run("stellar", [...target, "--build-only", "--", "verify_proof", ...args]).trim();
  const simulated = run(
    "stellar",
    ["tx", "simulate", "--source", values.source, "--network", values.network],
    {
      input: built,
    }
  ).trim();
  const decoded = JSON.parse(run("stellar", ["tx", "decode"], { input: simulated }));
  const tx = decoded.tx.tx;
  const soroban = tx.ext?.v1;
  if (!soroban) {
    throw new Error("Simulated transaction carries no Soroban resource data");
  }

  const estimate = estimateZkVerifyCost({ circuitName: `n${n}`, publicSignals: n });
  return {
    publicSignals: n,
    verified: verified === "true",
    instructions: soroban.resources.instructions,
    estimatedInstructions: estimate.cpuInstructions,
    diskReadBytes: soroban.resources.disk_read_bytes,
    writeBytes: soroban.resources.write_bytes,
    resourceFeeStroops: Number(soroban.resource_fee),
    totalFeeStroops: Number(tx.fee),
    txSizeBytes: Buffer.from(simulated, "base64").length,
  };
}

function toMarkdown(rows) {
  const lines = [
    "| Public signals | Verified | CPU instructions | Estimate | Resource fee (stroops) | Tx size (bytes) |",
    "| -------------: | :------: | ---------------: | -------: | ---------------------: | --------------: |",
  ];
  for (const row of rows) {
    if (row.error) {
      lines.push(
        `| ${row.publicSignals} | error | ${row.error.replace(/\|/g, "/").slice(0, 120)} | | | |`
      );
      continue;
    }
    lines.push(
      `| ${row.publicSignals} | ${row.verified ? "yes" : "NO"} | ${row.instructions.toLocaleString("en-US")} | ${row.estimatedInstructions.toLocaleString("en-US")} | ${row.resourceFeeStroops.toLocaleString("en-US")} | ${row.txSizeBytes.toLocaleString("en-US")} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

const workDir = path.join(tmpdir(), `caatinga-zk-benchmark-${process.pid}`);
const rows = [];
try {
  for (const n of sizes) {
    console.error(`[zk-benchmark] public signals: ${n}`);
    try {
      rows.push(measure(n, proveCircuit(n, workDir)));
    } catch (error) {
      // A size past the network limits fails simulation; record it as the limit
      // and stop, since every larger size would fail the same way.
      const message = (error.stderr || error.message || String(error))
        .toString()
        .trim()
        .split("\n")
        .pop();
      rows.push({ publicSignals: n, error: message });
      break;
    }
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

const result = {
  network: values.network,
  contractId,
  measuredAt: new Date().toISOString(),
  method: "verify_proof (dynamic VK), simulated via stellar tx simulate",
  rows,
};

mkdirSync(path.dirname(values.out), { recursive: true });
writeFileSync(`${values.out}.json`, `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(`${values.out}.md`, toMarkdown(rows));
process.stdout.write(toMarkdown(rows));

if (rows.some((row) => !row.error && !row.verified)) {
  console.error("[zk-benchmark] a valid proof was rejected by the verifier");
  process.exit(1);
}
