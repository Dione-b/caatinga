import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schemaFiles = [
  "src/artifacts/artifact.schema.ts",
  "src/config/config.schema.ts",
  "src/templates/template-manifest.schema.ts",
];

describe("schema type exports", () => {
  it("exports inferred Zod types with typeof schema references", async () => {
    const bareInferExports: string[] = [];

    for (const schemaFile of schemaFiles) {
      const filePath = path.resolve(process.cwd(), schemaFile);
      const source = await readFile(filePath, "utf8");
      const matches = source.matchAll(/export\s+type\s+\w+\s*=\s*z\.infer<(?!(?:typeof\s))[^>]+>/g);

      for (const match of matches) {
        bareInferExports.push(`${schemaFile}: ${match[0]}`);
      }
    }

    expect(bareInferExports).toEqual([]);
  });
});
