import type { Connect, Plugin, PreviewServer, ViteDevServer } from "vite";
import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

const DOCS_BASE = "/caatinga/";

/** Vite serves a bare <a> when `base` is hit without a trailing slash; force a real redirect. */
function redirectBaseWithoutSlash(): Plugin {
  const baseNoSlash = DOCS_BASE.replace(/\/$/, "");

  const redirect: Connect.NextHandleFunction = (req, res, next) => {
    const path = req.url?.split("?", 1)[0];
    if (path !== baseNoSlash) {
      next();
      return;
    }
    const query = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.statusCode = 302;
    res.setHeader("Location", `${DOCS_BASE}${query}`);
    res.end();
  };

  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(redirect);
  };

  return {
    name: "redirect-base-without-slash",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

/**
 * VitePress `docs:dev` ships an empty `#app` and hydrates via ESM.
 * Brave Shields often block those module requests → blank white page.
 * Show a dark fallback with the fix when the app never mounts.
 */
function emptyAppFallback(): Plugin {
  return {
    name: "docs-empty-app-fallback",
    apply: "serve",
    transformIndexHtml(html) {
      const injected = `
<style>html,body{background:#000;color:#fff;margin:0}</style>
<script>
(() => {
  const started = Date.now();
  const tick = () => {
    const app = document.getElementById("app");
    if (!app) return;
    if (app.childElementCount > 0) return;
    if (Date.now() - started < 3500) {
      requestAnimationFrame(tick);
      return;
    }
    app.innerHTML = '<div style="max-width:42rem;margin:4rem auto;padding:0 1.5rem;font:500 15px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace">'
      + '<p style="color:#ffde00;letter-spacing:.04em;text-transform:uppercase">Docs did not load</p>'
      + '<p>Brave Shields often block VitePress module scripts on localhost, which leaves a blank page.</p>'
      + '<ol style="padding-left:1.25rem">'
      + '<li>Click the Brave lion icon in the address bar</li>'
      + '<li>Turn <strong>Shields off</strong> for this site</li>'
      + '<li>Reload the page</li>'
      + '</ol>'
      + '<p>URL must be <code style="color:#ffde00">http://localhost:5173/caatinga/</code> (trailing slash).</p>'
      + '<p>Alternative: <code style="color:#ffde00">pnpm docs:build && pnpm docs:preview</code></p>'
      + '</div>';
  };
  requestAnimationFrame(tick);
})();
</script>`;

      if (html.includes('<div id="app"></div>')) {
        return html.replace('<div id="app"></div>', `<div id="app"></div>${injected}`);
      }
      return html.replace("</head>", `${injected}</head>`);
    },
  };
}

export default withMermaid(
  defineConfig({
    base: DOCS_BASE,
    title: "Caatinga",
    description: "Soroban deploy artifacts + TypeScript-native CLI",
    appearance: "force-dark",
    srcExclude: ["**/internal/**"],

    vite: {
      server: {
        host: "localhost",
        hmr: { host: "localhost" },
      },
      plugins: [redirectBaseWithoutSlash(), emptyAppFallback()],
    },

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
        { text: "Agents", link: "/tutorials/integration-guide" },
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
            { text: "FAQ", link: "/faq" },
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
              text: "Workshop (60–75 min)",
              link: "/tutorials/workshop",
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
