import type { SnarkjsProof, SnarkjsVk } from "@caatinga/zk/browser";

const ARTIFACTS_BASE = "/zk-artifacts";

export class ZkArtifactsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZkArtifactsError";
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${ARTIFACTS_BASE}/${path}`);
  if (!response.ok) {
    throw new ZkArtifactsError(
      `Missing ${path}. Run \`npx ctg zk build main\` and \`npx ctg zk prove main\` after saving circuits/input.json.`
    );
  }

  return (await response.json()) as T;
}

export async function fetchZkProofBundle(): Promise<{
  proof: SnarkjsProof;
  vk: SnarkjsVk;
  publicSignals: string[];
}> {
  const [proof, vk, publicSignals] = await Promise.all([
    fetchJson<SnarkjsProof>("proof.json"),
    fetchJson<SnarkjsVk>("verification_key.json"),
    fetchJson<string[]>("public.json"),
  ]);

  return { proof, vk, publicSignals };
}

export async function zkArtifactsAvailable(): Promise<boolean> {
  try {
    await fetchZkProofBundle();
    return true;
  } catch {
    return false;
  }
}
