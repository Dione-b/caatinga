import path from "node:path";
import { Command } from "commander";
import { createMinimalProject, createProjectFromTemplate } from "@caatinga/core";
import { runCliAction } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { resolveTemplateDir } from "../utils/template-path.js";

type InitOptions = {
  template: string;
  minimal?: boolean;
  empty?: boolean;
};

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a new Caatinga dApp from a template or minimal scaffold")
    .argument("<projectName>", "Project directory to create")
    .option("-t, --template <template>", "Template name", "react-vite-counter")
    .option("--minimal", "Scaffold a minimal CLI + Soroban contract project (no frontend template)")
    .option("--empty", "Alias for --minimal")
    .action((projectName: string, options: InitOptions) =>
      runCliAction(async () => {
        const targetDir = path.resolve(process.cwd(), projectName);
        const normalizedProjectName = path.basename(targetDir);
        const projectDirectory = path.isAbsolute(projectName) ? targetDir : projectName;
        const useMinimal = options.minimal === true || options.empty === true;

        if (useMinimal) {
          await createMinimalProject({
            projectName: normalizedProjectName,
            targetDir,
          });

          logger.success("Minimal project created");
          logger.info("");
          logger.info(`Project: ${normalizedProjectName}`);
          logger.info("Scaffold: minimal (CLI + Soroban contract)");
          logger.info(`Path: ${targetDir}`);
          logger.info("");
          logger.info("Next steps:");
          logger.info(`  cd ${projectDirectory}`);
          logger.info("  npm install");
          logger.info("  npx caatinga build app");
          logger.info("  npx caatinga deploy app --network testnet --source <identity>");
          logger.info("  npx caatinga read app.version --network testnet --source <identity>");
          logger.info("  npx caatinga read app.hello --network testnet --source <identity>");
          return;
        }

        const templateDir = await resolveTemplateDir(options.template);

        const result = await createProjectFromTemplate({
          projectName: normalizedProjectName,
          targetDir,
          templateDir,
        });

        logger.success("Project created");
        logger.info("");
        logger.info(`Project: ${normalizedProjectName}`);
        logger.info(`Template: ${result.template.name}@${result.template.version}`);
        logger.info(`Path: ${targetDir}`);
        logger.info("");
        const defaultContract = result.template.contracts.default;
        logger.info("Next steps:");
        logger.info(`  cd ${projectDirectory}`);
        logger.info("  npm install");
        if (defaultContract) {
          logger.info(`  npx caatinga build    ${defaultContract}`);
          logger.info(
            `  npx caatinga deploy   ${defaultContract} --network testnet --source <identity>`
          );
        } else {
          logger.info("  npx caatinga build");
          logger.info("  npx caatinga deploy   --network testnet --source <identity>");
        }
        logger.info("  npm run dev");
        logger.info("");
        logger.info(
          "Note: deploy generates TypeScript bindings automatically (--no-generate to skip) —"
        );
        logger.info("the dApp reads the contract ID from caatinga.artifacts.json.");
        logger.info("If generation fails, recover with: npx caatinga generate --network testnet");
      })
    );
}
