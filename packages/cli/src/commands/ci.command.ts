import { Command } from "commander";
import { execa } from "execa";
import { formatNetworkOrigin, loadConfig, resolveNetwork } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

/**
 * Re-runs this same ctg binary (whatever node + entry script launched us), so the
 * recipe works in any user project, not only inside the Caatinga monorepo.
 * Returns the child's exit code; the child prints its own diagnostics.
 */
async function runCtgStep(args: string[]): Promise<number> {
  const entry = process.argv[1];
  if (!entry) {
    throw new Error("Cannot determine the ctg entry script to re-run.");
  }
  const result = await execa(process.execPath, [entry, ...args], {
    stdio: "inherit",
    reject: false,
  });
  return result.exitCode ?? 1;
}

export function registerCiCommand(program: Command): void {
  const ci = program.command("ci").description("CI helper: doctor → smoke → optional checks");

  ci.command("run")
    .description("Run the default CI recipe for the current project")
    .option("-n, --network <network>", "Configured network name")
    .option("-s, --source <source>", "Stellar CLI identity alias")
    .option("--skip-smoke", "Skip smoke reads")
    .option("--strict", "Pass --strict to doctor and status-equivalent checks")
    .action(
      (options: { network?: string; source?: string; skipSmoke?: boolean; strict?: boolean }) =>
        runCliAction(async () => {
          const config = await loadConfig();
          const network = resolveNetwork(config, options.network);
          // ci run delegates to `ctg doctor` / `ctg smoke` with an explicit
          // --network, so those children log `Network: <name> (flag)`. Logging
          // here too would print the Network line twice (#244).
          logger.info(`CI target network: ${formatNetworkOrigin(network)}`);
          const strictFlags = options.strict ? ["--strict"] : [];

          logger.info("CI: doctor");
          const doctorExit = await runCtgStep([
            "doctor",
            "--network",
            network.name,
            ...strictFlags,
          ]);
          if (doctorExit !== 0) {
            logger.error(`CI failed at doctor (exit ${doctorExit})`);
            process.exitCode = doctorExit;
            return;
          }

          if (!options.skipSmoke) {
            logger.info("");
            logger.info("CI: smoke");
            const smokeArgs = ["smoke", "--network", network.name];
            if (options.source) {
              smokeArgs.push("--source", options.source);
            }
            const smokeExit = await runCtgStep(smokeArgs);
            if (smokeExit !== 0) {
              logger.error(`CI failed at smoke (exit ${smokeExit})`);
              process.exitCode = smokeExit;
              return;
            }
          }

          logger.success("CI recipe complete");
        })
    );
}
