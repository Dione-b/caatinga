import type { CaatingaConfig } from "@caatinga/core";

/** True when `postDeploy` or `postDeployRead` declares at least one hook for `ctg wire` to run. */
export function hasPostDeployHooks(config: CaatingaConfig): boolean {
  return (config.postDeploy?.length ?? 0) > 0 || (config.postDeployRead?.length ?? 0) > 0;
}
