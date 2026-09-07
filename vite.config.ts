import { readFileSync } from "node:fs";
import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig, type Plugin } from "vite";

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
  plugins: [ignoreDevtoolsProbe(), tailwindcss(), reactRouter(), ssl && basicSsl()],
  resolve: { tsconfigPaths: true },
  define: {
    __DATASET_VERSION__: JSON.stringify(datasetVersion()),
  },
});
