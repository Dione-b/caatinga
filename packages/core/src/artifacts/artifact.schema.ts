import { z } from "zod";

export const ContractArtifactSchema = z.object({
  contractId: z.string().min(1),
  wasmHash: z.string().min(1),
  deployedAt: z.string().datetime(),
  sourcePath: z.string().min(1),
  wasmPath: z.string().min(1),
  dependencies: z.array(z.string().min(1)).default([]),
  resolvedDeployArgs: z
    .record(z.string().min(1), z.union([z.string(), z.number(), z.boolean()]))
    .default({}),
});

const NetworkArtifactsSchema = z.object({
  contracts: z.record(z.string().min(1), ContractArtifactSchema).default({}),
  dependencyGraph: z.record(z.string().min(1), z.array(z.string().min(1))).default({}),
});

export const CaatingaArtifactsSchema = z.object({
  project: z.string().min(1),
  version: z.literal(1),
  networks: z.record(z.string().min(1), NetworkArtifactsSchema).default({}),
});

export type ContractArtifact = z.infer<typeof ContractArtifactSchema>;
export type CaatingaArtifacts = z.infer<typeof CaatingaArtifactsSchema>;
