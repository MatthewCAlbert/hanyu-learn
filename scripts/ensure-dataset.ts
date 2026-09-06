/**
 * Builds app/data/generated/ if it is missing or stale.
 *
 * The generated data is not committed — it is derived, 20MB, and stored as
 * single-line JSON that git cannot diff. Instead it is rebuilt on demand: on
 * `pnpm install` (via `prepare`) so a fresh clone works, and before `dev` and
 * `build` in case `content/` changed since.
 *
 * Cheap when nothing changed, so it can sit in front of every dev start.
 */
import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);

/** Stamp written at the very end of a successful build. */
const OUTPUT = "app/data/generated/.built";
const INPUTS = ["data/sources", "content", "scripts/build-dataset.ts", "app/lib"];

/**
 * Newest mtime among *files* below `path`.
 *
 * Directory mtimes are deliberately ignored: they move whenever an entry is
 * added or removed — and on macOS for reasons that have nothing to do with the
 * contents — which made every check report stale.
 */
async function newestMtime(path: string): Promise<number> {
  const info = await stat(path);
  if (!info.isDirectory()) return info.mtimeMs;
  const entries = await readdir(path, { withFileTypes: true });
  const times = await Promise.all(
    entries
      // Skip the gitignored raw downloads: huge, and not an input to this build.
      .filter((e) => e.name !== ".raw")
      .map((e) => newestMtime(`${path}/${e.name}`)),
  );
  return Math.max(...times, 0);
}

async function main() {
  let builtAt = 0;
  try {
    builtAt = (await stat(OUTPUT)).mtimeMs;
  } catch {
    console.log("· dataset missing — building");
  }

  if (builtAt > 0) {
    const newest = Math.max(...(await Promise.all(INPUTS.map(newestMtime))));
    if (newest <= builtAt) return; // up to date, nothing to do
    console.log("· sources or content changed — rebuilding dataset");
  }

  const { stdout } = await exec("pnpm", ["run", "data:build"]);
  process.stdout.write(stdout);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
