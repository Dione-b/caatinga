import { type Command } from "commander";
import { createProjectFromTemplate, loadConfig } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { resolveTemplateDir } from "../utils/template-path.js";
import path from "node:path";
import { getOrCreateZkCommand } from "./zk.command.js";

const ZK_TEMPLATE = "zk-starter";

export function registerZkInitCommand(program: Command): void {
  getOrCreateZkCommand(program)
    .command("init [projectName]")
    .description("Scaffold a new ZK-enabled project or add ZK files to the current project")
    .option("-t, --template <template>", "Template name", ZK_TEMPLATE)
    .action(async (projectName: string | undefined, options: { template: string }) => {
      await runCliAction(async () => {
        const templateDir = await resolveTemplateDir(options.template);

        if (projectName) {
          const targetDir = path.resolve(projectName);
          await createProjectFromTemplate({
            projectName: path.basename(targetDir),
            targetDir,
            templateDir,
          });
          logger.success(`Created ZK project at ${targetDir}`);
          return;
        }

        const cwd = process.cwd();
        let config;
        try {
          config = await loadConfig({ cwd });
        } catch {
          throw new Error(
            "No caatinga.config.ts found in the current directory. Run `caatinga zk init <projectName>` to create a new project."
          );
        }

        await createProjectFromTemplate({
          projectName: config.project,
          targetDir: cwd,
          templateDir,
          filter: (relativePath: string) =>
            relativePath === "circuits" ||
            relativePath.startsWith("circuits/") ||
            relativePath === "contracts/verifier" ||
            relativePath.startsWith("contracts/verifier/"),
        });

        logger.success("Added ZK circuit and verifier scaffold to the current project");
      });
    });
}
