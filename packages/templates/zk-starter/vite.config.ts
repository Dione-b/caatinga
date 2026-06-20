import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { walletStubViteAliases } from "@caatinga/client/vite";
import { fileURLToPath } from "node:url";

const stubsDir = fileURLToPath(new URL("./src/stubs", import.meta.url));

function zkArtifactsPlugin(): Plugin {
  const artifactsDir = path.resolve(process.cwd(), ".artifacts/zk/main");

  const serveArtifacts = (
    req: { url?: string },
    res: {
      statusCode: number;
      setHeader(name: string, value: string): void;
      end(chunk?: string): void;
    },
    next: () => void
  ) => {
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    const relativePath = urlPath.replace(/^\/+/, "");
    if (!relativePath || relativePath.includes("..")) {
      next();
      return;
    }

    const filePath = path.join(artifactsDir, relativePath);
    if (!filePath.startsWith(artifactsDir)) {
      res.statusCode = 403;
      res.end();
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.statusCode = 404;
        res.end();
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(data.toString("utf8"));
    });
  };

  return {
    name: "caatinga-zk-artifacts",
    configureServer(server) {
      server.middlewares.use("/zk-artifacts", serveArtifacts);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/zk-artifacts", serveArtifacts);
    },
  };
}

export default defineConfig({
  plugins: [react(), zkArtifactsPlugin()],
  server: {
    fs: {
      allow: ["..", ".artifacts"],
    },
  },
  resolve: {
    alias: walletStubViteAliases(stubsDir),
  },
});
