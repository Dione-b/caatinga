import { z } from "zod";
import { validateContractGraph } from "./validate-contract-graph.js";

const DeployArgValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const ContractConfigSchema = z.object({
  path: z.string().min(1),
  wasm: z.string().min(1),
  dependsOn: z.array(z.string().min(1)).default([]),
  deployArgs: z.record(z.string().min(1), DeployArgValueSchema).default({}),
  buildFeatures: z.array(z.string().min(1)).optional(),
});

export const NetworkConfigSchema = z.object({
  rpcUrl: z.string().url(),
  networkPassphrase: z.string().min(1),
  requireConfirmation: z.boolean().optional(),
});

const ZkCircuitSchema = z.object({
  path: z.string().min(1),
  protocol: z.literal("groth16"),
  curve: z.literal("bls12381"),
  verifierContract: z.string().optional(),
});

const ZkConfigSchema = z
  .object({
    circuits: z.record(z.string().min(1), ZkCircuitSchema),
  })
  .optional();

export const ExpectMatcherSchema = z.enum([
  "equals",
  "reachable",
  "isNull",
  "isArray",
  "minLength",
  "maxLength",
  "contains",
  "matches",
  "jsonEquals",
]);

export const ExpectObjectSchema = z.object({
  matcher: ExpectMatcherSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const ExpectSpecSchema = z.union([z.string(), ExpectObjectSchema]);

const PostDeployHookKindSchema = z.enum(["invoke", "read"]);

const PostDeployHookSchema = z.object({
  contract: z.string().min(1),
  method: z.string().min(1),
  args: z.record(z.string().min(1), DeployArgValueSchema).default({}),
  source: z.string().min(1).optional(),
  expect: ExpectSpecSchema.optional(),
  kind: PostDeployHookKindSchema.default("invoke"),
});

const SmokeReadSchema = z.object({
  contract: z.string().min(1),
  method: z.string().min(1),
  args: z.record(z.string().min(1), DeployArgValueSchema).default({}),
  source: z.string().min(1).optional(),
  expect: ExpectSpecSchema.optional(),
});

export const CaatingaConfigSchema = z
  .object({
    project: z.string().min(1),
    defaultNetwork: z.string().min(1).default("testnet"),
    buildRoot: z.string().min(1).optional(),
    contracts: z
      .record(z.string().min(1), ContractConfigSchema)
      .refine(
        (contracts) => Object.keys(contracts).length > 0,
        "At least one contract must be configured."
      ),
    networks: z
      .record(z.string().min(1), NetworkConfigSchema)
      .refine(
        (networks) => Object.keys(networks).length > 0,
        "At least one network must be configured."
      ),
    frontend: z
      .object({
        framework: z.literal("vite-react").default("vite-react"),
        bindingsOutput: z.string().min(1),
        envFile: z.string().min(1).optional(),
        env: z.record(z.string().min(1), z.string().min(1)).optional(),
      })
      .optional(),
    postDeploy: z.array(PostDeployHookSchema).optional(),
    postDeployRead: z.array(PostDeployHookSchema).optional(),
    smoke: z
      .object({
        reads: z.array(SmokeReadSchema).optional(),
        useFreshSymbol: z.boolean().optional(),
      })
      .optional(),
    zk: ZkConfigSchema,
  })
  .superRefine((config) => {
    validateContractGraph(config.contracts);
  });

export type ExpectMatcher = z.infer<typeof ExpectMatcherSchema>;
export type ExpectSpec = z.infer<typeof ExpectSpecSchema>;
export type PostDeployHook = z.infer<typeof PostDeployHookSchema>;
export type SmokeRead = z.infer<typeof SmokeReadSchema>;

export type CaatingaConfig = z.infer<typeof CaatingaConfigSchema>;
export type ContractConfig = z.infer<typeof ContractConfigSchema>;
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;
