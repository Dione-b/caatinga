import { cp, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInitialArtifacts, writeArtifacts } from "../artifacts/write-artifacts.js";
import { frontendBindingsConfigSnippet } from "../frontend/bindings-config-hint.js";
import { CAATINGA_CORE_VERSION } from "../version.js";

export type CreateMinimalProjectOptions = {
  projectName: string;
  targetDir: string;
  force?: boolean;
};

const moduleDir =
  typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

function scaffoldRoot(): string {
  const candidates = [
    path.resolve(moduleDir, "../../scaffolds"),
    path.resolve(moduleDir, "../scaffolds"),
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
    app: {
      path: "./contracts/app",
      wasm: "./contracts/app/target/wasm32v1-none/release/app.wasm"
    }
  },
  networks: {
    testnet: {
      rpcUrl: "https://soroban-testnet.stellar.org",
      networkPassphrase: "Test SDF Network ; September 2015"
    },
    mainnet: {
      rpcUrl: "https://mainnet.sorobanrpc.com",
      networkPassphrase: "Public Global Stellar Network ; September 2015"
    }
  }
});
`;
}

function packageJsonSource(projectName: string): string {
  return `${JSON.stringify(
    {
      name: projectName,
      version: "0.1.0",
      private: true,
      type: "module",
      scripts: {
        build: "ctg build app",
        deploy: "ctg deploy app --network testnet --source ${CAATINGA_SOURCE:-alice}",
        doctor: "ctg doctor --network testnet",
        test: "cargo test --manifest-path contracts/app/Cargo.toml",
        "read:hello": "ctg read app.hello --network testnet --source ${CAATINGA_SOURCE:-alice}",
        "read:version": "ctg read app.version --network testnet --source ${CAATINGA_SOURCE:-alice}",
      },
      devDependencies: {
        "@caatinga/cli": `^${CAATINGA_CORE_VERSION}`,
        "@caatinga/core": `^${CAATINGA_CORE_VERSION}`,
      },
    },
    null,
    2
  )}\n`;
}

function readmeSource(projectName: string): string {
  return `# ${projectName}

Minimal Caatinga project with a Soroban contract stub (no frontend template).

## Workflow

\`\`\`bash
npm install
npm test
npx ctg doctor
npx ctg build app
npx ctg deploy app --network testnet --source <identity>
npx ctg read app.version --network testnet
npx ctg read app.hello --network testnet
\`\`\`

## Tests

Run the Rust contract tests from the project root:

\`\`\`bash
npm test
# or directly:
cargo test --manifest-path contracts/app/Cargo.toml
\`\`\`

## Contract

- \`hello()\` — read-only; returns Soroban Symbol \`hello\`
- \`version()\` — read-only; returns \`1\`

Use \`ctg read\` for read-only methods. Use \`ctg invoke\` only after you add state-changing methods to the contract.

## TypeScript bindings (optional)

This scaffold has no frontend, so \`ctg generate\` is not configured. To generate a typed
client for the contract, add a \`frontend\` section to \`caatinga.config.ts\`:

\`\`\`ts
${frontendBindingsConfigSnippet()}
\`\`\`

Then run \`npx ctg generate app --network testnet\`.

Soroban \`Symbol\` parameters are generated as TypeScript \`string\` values with host-specific restrictions — see the Caatinga docs on [Soroban types](https://github.com/caatinga/caatinga/blob/main/docs/soroban-types.md).

Edit \`contracts/app/src/lib.rs\` to customize the contract. Add a frontend later with \`@caatinga/client\` and your chosen UI stack.
`;
}

export async function createMinimalProject(options: CreateMinimalProjectOptions) {
  const targetDir = path.resolve(options.targetDir);
  const force = options.force ?? false;

  await mkdir(targetDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(targetDir, "caatinga.config.ts"), configSource(options.projectName), {
      encoding: "utf8",
      flag: force ? "w" : "wx",
    }),
    writeFile(path.join(targetDir, "package.json"), packageJsonSource(options.projectName), {
      encoding: "utf8",
      flag: force ? "w" : "wx",
    }),
    writeFile(path.join(targetDir, ".gitignore"), "node_modules\n.artifacts\ntarget\n", {
      encoding: "utf8",
      flag: force ? "w" : "wx",
    }),
    writeFile(path.join(targetDir, "README.md"), readmeSource(options.projectName), {
      encoding: "utf8",
      flag: force ? "w" : "wx",
    }),
  ]);

  await mkdir(path.join(targetDir, "contracts"), { recursive: true });
  await cp(
    path.join(scaffoldRoot(), "soroban-contract-stub"),
    path.join(targetDir, "contracts", "app"),
    {
      recursive: true,
      force,
      errorOnExist: !force,
    }
  );

  await writeArtifacts(
    createInitialArtifacts(options.projectName, { networks: ["testnet"] }),
    targetDir
  );

  return { targetDir };
}
