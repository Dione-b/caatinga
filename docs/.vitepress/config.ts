import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
  base: "/caatinga/",
  title: "Caatinga",
  description: "Soroban deploy artifacts + TypeScript-native CLI",
  srcExclude: ["**/internal/**"],

  ignoreDeadLinks: [/\.\.\//, /internal/],

  themeConfig: {
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Reference", link: "/cli" },
      { text: "AI agents", link: "/tutorials/integration-guide" },
      {
        text: "GitHub",
        link: "https://github.com/Dione-b/caatinga",
      },
      {
        text: "npm",
        link: "https://www.npmjs.com/package/@caatinga/cli",
      },
    ],

    sidebar: [
      {
        text: "Start here",
        items: [
          { text: "Getting started", link: "/getting-started" },
          {
            text: "Choosing a project scaffold",
            link: "/tutorials/project-scaffolds",
          },
          { text: "Template project", link: "/tutorials/template-project" },
          { text: "Minimal project", link: "/tutorials/minimal-project" },
          { text: "ZK project", link: "/tutorials/zk-project" },
          {
            text: "From Zero to Testnet",
            link: "/tutorials/from-zero-to-testnet",
          },
          { text: "Cheatsheet", link: "/cheatsheet" },
        ],
      },
      {
        text: "stellar-build",
        items: [
          {
            text: "Integration guide",
            link: "/tutorials/integration-guide",
          },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "CLI", link: "/cli" },
          { text: "Config", link: "/config" },
          { text: "Client", link: "/client" },
          { text: "Wallets", link: "/wallets" },
          { text: "Templates", link: "/templates" },
          { text: "Errors", link: "/errors" },
          { text: "ZK module", link: "/zk" },
          { text: "Soroban types", link: "/soroban-types" },
        ],
      },
      {
        text: "Advanced",
        collapsed: true,
        items: [
          { text: "Architecture", link: "/architecture" },
          { text: "Signing strategy", link: "/signing-strategy" },
          {
            text: "Production readiness",
            link: "/production-readiness",
          },
          {
            text: "Contract upgrade",
            link: "/tutorials/contract-upgrade",
          },
        ],
      },
    ],

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/Dione-b/caatinga",
      },
    ],

    search: {
      provider: "local",
    },
  },
  }),
);
