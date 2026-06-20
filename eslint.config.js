import js from "@eslint/js";
import tsEslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tsEslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/packed/**",
      "**/.pnpm-store/**",
      "**/coverage/**",
      "**/contracts/generated/**",
      "**/bindings/**",
      "pnpm-lock.yaml",
      "**/*.d.ts",
    ],
  },
  js.configs.recommended,
  ...tsEslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  prettierConfig,
  {
    files: ["**/*.cjs", "scripts/**/*.js", "scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        exports: "readonly",
        global: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);
