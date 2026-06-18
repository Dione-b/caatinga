import { cp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";
import { CAATINGA_CORE_VERSION } from "../version.js";

export type CreateZkProjectOptions = {
  projectName: string;
  targetDir: string;
  force?: boolean;
  projectFiles?: boolean;
};

const moduleDir =
  typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

function scaffoldRoot(): string {
  const candidates = [
    path.resolve(moduleDir, "../../scaffolds"),
    path.resolve(moduleDir, "../scaffolds")
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found ?? candidates[0];
}

function configSource(projectName: string): string {
  return `import { defineConfig } from "@caatinga/core";

export default defineConfig({
  project: "${projectName}",
  defaultNetwork: "testnet",
  contracts: {
    verifier: {
      path: "./contracts/verifier",
      wasm: "./contracts/verifier/target/wasm32v1-none/release/verifier.wasm"
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    }
  },
  zk: {
    circuits: {
      main: {
        path: "./circuits",
        protocol: "groth16",
        curve: "bls12381",
        verifierContract: "verifier"
      }
    }
  }
});
`;
}

function packageJsonSource(projectName: string): string {
  return `${JSON.stringify({
    name: projectName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      "zk:build": "caatinga zk build main",
      "zk:prove": "caatinga zk prove main",
      build: "caatinga build verifier",
      deploy: "caatinga deploy verifier --network testnet --source ${CAATINGA_SOURCE:-alice}",
      doctor: "caatinga doctor --network testnet"
    },
    devDependencies: {
      "@caatinga/cli": `^${CAATINGA_CORE_VERSION}`,
      "@caatinga/core": `^${CAATINGA_CORE_VERSION}`
    }
  }, null, 2)}\n`;
}

function readmeSource(projectName: string): string {
  return `# ${projectName}

Minimal Caatinga ZK project.

## Workflow

\`\`\`bash
npm install
npx caatinga zk build main
npx caatinga build verifier
npx caatinga deploy verifier --network testnet --source <identity>
npx caatinga zk prove main
\`\`\`

Replace \`circuits/main.circom\` with your circuit. Keep the entry point named \`main\`.
`;
}

export async function createZkProject(options: CreateZkProjectOptions) {
  const targetDir = path.resolve(options.targetDir);
  const force = options.force ?? false;
  const projectFiles = options.projectFiles ?? true;

  await mkdir(targetDir, { recursive: true });
  if (projectFiles) {
    await Promise.all([
      writeFile(path.join(targetDir, "caatinga.config.ts"), configSource(options.projectName), { encoding: "utf8", flag: force ? "w" : "wx" }),
      writeFile(path.join(targetDir, "package.json"), packageJsonSource(options.projectName), { encoding: "utf8", flag: force ? "w" : "wx" }),
      writeFile(path.join(targetDir, ".gitignore"), "node_modules\n.artifacts\ntarget\n", { encoding: "utf8", flag: force ? "w" : "wx" }),
      writeFile(path.join(targetDir, "README.md"), readmeSource(options.projectName), { encoding: "utf8", flag: force ? "w" : "wx" })
    ]);
  }

  await mkdir(path.join(targetDir, "contracts"), { recursive: true });
  await cp(path.join(scaffoldRoot(), "zk-circuit-stub"), path.join(targetDir, "circuits"), {
    recursive: true,
    force,
    errorOnExist: !force
  });
  await cp(path.join(scaffoldRoot(), "zk-verifier"), path.join(targetDir, "contracts", "verifier"), {
    recursive: true,
    force,
    errorOnExist: !force
  });
  if (projectFiles) {
    await writeArtifacts(createInitialArtifacts(options.projectName, { networks: ["testnet"] }), targetDir);
  }

  return { targetDir };
}
