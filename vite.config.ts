import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

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
        const path = (req.url ?? "").split("?")[0] ?? "";
        if (!CDP.test(path)) return next();
        res.statusCode = 404;
        res.setHeader("content-type", "application/json");
        res.end('{"error":"not a devtools endpoint"}');
      });
    },
  };
}

export default defineConfig({
  plugins: [ignoreDevtoolsProbe(), tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
  // Keep the package on disk so the hanzi loader can require one character JSON
  // at request time instead of bundling ~9,000 stroke files.
  ssr: { external: ["hanzi-writer-data"] },
});
