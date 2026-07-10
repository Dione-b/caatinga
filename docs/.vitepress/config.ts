import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

export default withMermaid(
  defineConfig({
    base: "/caatinga/",
    title: "Caatinga",
    description: "Soroban deploy artifacts + TypeScript-native CLI",
    appearance: "force-dark",
    srcExclude: ["**/internal/**"],

    head: [
      ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
      [
        "link",
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
      ],
      [
        "link",
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
        },
      ],
    ],

    ignoreDeadLinks: [/\.\.\//, /internal/],

    themeConfig: {
      nav: [
        { text: "Guide", link: "/getting-started" },
        { text: "Reference", link: "/cli" },
        { text: "AI agents", link: "/tutorials/integration-guide" },
        { text: "LLM reference", link: "/for-llms" },
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
            { text: "Cheatsheet", link: "/cheatsheet" },
          ],
        },
        {
          text: "Guides",
          collapsed: true,
          items: [
            {
              text: "From Zero to Testnet",
              link: "/tutorials/from-zero-to-testnet",
            },
            {
              text: "Integration guide (stellar-build)",
              link: "/tutorials/integration-guide",
            },
            {
              text: "Contract upgrade",
              link: "/tutorials/contract-upgrade",
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
            { text: "Troubleshooting", link: "/troubleshooting" },
            { text: "Public API", link: "/public-api" },
            { text: "ZK module", link: "/zk" },
            { text: "Soroban types", link: "/soroban-types" },
            { text: "LLM reference (for-llms)", link: "/for-llms" },
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
            { text: "Recovery scenarios", link: "/recovery-scenarios" },
            { text: "ADRs", link: "/adr/" },
            {
              text: "stellar-album case study",
              link: "/case-studies/stellar-album",
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
  })
);
