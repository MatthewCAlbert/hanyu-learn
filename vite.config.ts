import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { contentSecurityPolicy } from "./app/lib/csp.ts";

const ssl = process.env.DEV_SSL === "1";

const WEB = path.resolve("app/data/generated/web");

function datasetVersion(): string {
  try {
    const manifest = JSON.parse(readFileSync(path.join(WEB, "manifest.json"), "utf8")) as {
      version: string;
    };
    return manifest.version;
  } catch {
    return "";
  }
}

/** Same policy as the HTML meta tag, plus frame-ancestors (meta cannot set that). */
function contentSecurityPolicyHeader(): Plugin {
  function apply(mode: string) {
    const env = loadEnv(mode, process.cwd(), ["VITE_", "CDN_"]);
    const value = contentSecurityPolicy(env.CDN_AUDIO_URL);
    return (_req: IncomingMessage, res: ServerResponse, next: () => void) => {
      res.setHeader("Content-Security-Policy", value);
      next();
    };
  }
  return {
    name: "content-security-policy",
    configureServer(server) {
      server.middlewares.use(apply(server.config.mode));
    },
    configurePreviewServer(server) {
      server.middlewares.use(apply("production"));
    },
  };
}

/**
 * Debugger auto-attach (VS Code / Cursor JS debug terminals, devtools clients)
 * probes `/json/version` on every listening port looking for a Chrome DevTools
 * Protocol target list. This is a Vite server, not a CDP endpoint, so the
 * request falls through to React Router's catch-all and logs a noisy
 * `No route matches URL "/json/version"`.
 *
 * Answer the CDP discovery paths directly so the probe gets a clean 404 and
 * the dev log stays readable. Dev-only; the built app never sees these.
 */
function ignoreDevtoolsProbe(): Plugin {
  const CDP = /^\/json(\/(version|list|new|close|protocol|activate).*)?$/;
  return {
    name: "ignore-devtools-probe",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0] ?? "";
        if (!CDP.test(url)) return next();
        res.statusCode = 404;
        res.setHeader("content-type", "application/json");
        res.end('{"error":"not a devtools endpoint"}');
      });
    },
  };
}

export default defineConfig({
  appType: "spa",
  plugins: [
    ignoreDevtoolsProbe(),
    contentSecurityPolicyHeader(),
    tailwindcss(),
    reactRouter(),
    ssl && basicSsl(),
  ],
  resolve: { tsconfigPaths: true },
  envPrefix: ["VITE_", "CDN_"],
  define: {
    __DATASET_VERSION__: JSON.stringify(datasetVersion()),
  },
  server: {
    watch: {
      ignored: [
        "**/public/data/**",
        "**/app/data/generated/**",
        "**/data/sources/audio-cmn/**",
        "**/data/sources/.raw/**",
      ],
    },
  },
});
