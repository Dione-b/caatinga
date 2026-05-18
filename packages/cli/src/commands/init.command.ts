import path from "node:path";
import { Command } from "commander";
import { createProjectFromTemplate } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { resolveTemplateDir } from "../utils/template-path.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a new Caatinga dApp from a template")
    .argument("<projectName>", "Project directory to create")
    .option("-t, --template <template>", "Template name", "react-vite-counter")
    .action((projectName: string, options: { template: string }) => runCliAction(async () => {
      const templateDir = await resolveTemplateDir(options.template);
      const targetDir = path.resolve(process.cwd(), projectName);
      const normalizedProjectName = path.basename(targetDir);
      const projectDirectory = path.isAbsolute(projectName) ? targetDir : projectName;

      const result = await createProjectFromTemplate({
        projectName: normalizedProjectName,
        targetDir,
        templateDir
      });

      logger.success("Project created");
      logger.info("");
      logger.info(`Project: ${normalizedProjectName}`);
      logger.info(`Template: ${result.template.name}@${result.template.version}`);
      logger.info(`Path: ${targetDir}`);
      logger.info("");
      logger.info("Next steps:");
      logger.info(`  cd ${projectDirectory}`);
      logger.info("  npm install");
      const defaultContract = result.template.contracts.default;
      logger.info(
        defaultContract
          ? `  npx caatinga build ${defaultContract}`
          : "  npx caatinga build"
      );
    }));
}
