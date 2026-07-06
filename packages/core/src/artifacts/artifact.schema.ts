import { z } from "zod";

export const ArtifactSupersedeReasonSchema = z.enum(["upgrade", "rollback", "force-redeploy"]);

export type ArtifactSupersedeReason = z.infer<typeof ArtifactSupersedeReasonSchema>;

export const ArtifactUpgradeTypeSchema = z.enum(["in-place", "new-contract"]);

export type ArtifactUpgradeType = z.infer<typeof ArtifactUpgradeTypeSchema>;

export const ArtifactUpgradeStrategySchema = z.enum(["in-place", "redeploy"]);

export type ArtifactUpgradeStrategy = z.infer<typeof ArtifactUpgradeStrategySchema>;

export const ContractMetadataSchema = z.object({
  gitCommit: z.string().optional(),
  rustcVersion: z.string().optional(),
  caatingaVersion: z.string().optional(),
  network: z.string().optional(),
  timestamp: z.string().optional(),
  checksum: z.string().optional(),
});

export type ContractMetadata = z.infer<typeof ContractMetadataSchema>;

export const ContractArtifactHistoryEntrySchema = z.object({
  contractId: z.string().min(1),
  wasmHash: z.string().min(1),
  deployedAt: z.string().datetime(),
  supersededAt: z.string().datetime(),
  reason: ArtifactSupersedeReasonSchema.optional(),
  upgradeType: ArtifactUpgradeTypeSchema.optional(),
  metadata: ContractMetadataSchema.optional(),
});

export type ContractArtifactHistoryEntry = z.infer<typeof ContractArtifactHistoryEntrySchema>;

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
  history: z.array(ContractArtifactHistoryEntrySchema).optional(),
  upgradeStrategy: ArtifactUpgradeStrategySchema.optional(),
  metadata: ContractMetadataSchema.optional(),
});

const NetworkArtifactsSchema = z.object({
  contracts: z.record(z.string().min(1), ContractArtifactSchema).default({}),
  dependencyGraph: z.record(z.string().min(1), z.array(z.string().min(1))).default({}),
});

const CaatingaArtifactsBaseSchema = z.object({
  project: z.string().min(1),
  networks: z.record(z.string().min(1), NetworkArtifactsSchema).default({}),
});

export const CaatingaArtifactsV1Schema = CaatingaArtifactsBaseSchema.extend({
  version: z.literal(1),
});

export const CaatingaArtifactsV2Schema = CaatingaArtifactsBaseSchema.extend({
  version: z.literal(2),
});

export const CaatingaArtifactsSchema = z.union([
  CaatingaArtifactsV1Schema,
  CaatingaArtifactsV2Schema,
]);

export type ContractArtifact = z.infer<typeof ContractArtifactSchema>;
export type CaatingaArtifacts = z.infer<typeof CaatingaArtifactsSchema>;
export type CaatingaArtifactsV1 = z.infer<typeof CaatingaArtifactsV1Schema>;
export type CaatingaArtifactsV2 = z.infer<typeof CaatingaArtifactsV2Schema>;

export const CURRENT_ARTIFACTS_SCHEMA_VERSION = 2 as const;
