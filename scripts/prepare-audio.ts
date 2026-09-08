/**
 * Optional: prune hugolpz/audio-cmn into data/sources/audio-cmn for uploading
 * to a CDN. MP3s are gitignored. The running app fetches them only when
 * CDN_AUDIO_URL is set.
 *
 * Source: https://github.com/hugolpz/audio-cmn — CC BY-SA. See docs/DATA-SOURCES.md.
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const PIN = "ff9ed3d0c631195bd2c06f39450f3264c7124040";
const REPO = "https://github.com/hugolpz/audio-cmn.git";
const RAW = "data/sources/.raw/audio-cmn";
const OUT = "data/sources/audio-cmn";
const QUALITY = "24k-abr";

interface HskEntry {
  simplified: string;
  level: string[];
}

const HSK3 = new Set(["new-1", "new-2", "new-3", "new-4", "new-5", "new-6", "new-7"]);

interface ExtraEntry {
  word: string;
}

async function corpusForms(): Promise<Set<string>> {
  const hsk = JSON.parse(
    await readFile("data/sources/complete-hsk-vocabulary.json", "utf8"),
  ) as HskEntry[];
  const extra = JSON.parse(
    await readFile("data/sources/extra-vocabulary.json", "utf8"),
  ) as ExtraEntry[];
  const forms = new Set<string>();
  for (const entry of hsk) {
    if (!entry.level.some((tag) => HSK3.has(tag))) continue;
    if ([...entry.simplified].length > 1) forms.add(entry.simplified);
  }
  for (const entry of extra) forms.add(entry.word);
  for (const file of await readdir("content/lexemes")) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    forms.add(file.replace(/\.md$/, ""));
  }
  return forms;
}

async function ensureClone() {
  try {
    const { stdout } = await exec("git", ["-C", RAW, "rev-parse", "HEAD"]);
    if (stdout.trim() === PIN) return;
  } catch {
    /* missing */
  }
  await rm(RAW, { recursive: true, force: true });
  await exec("git", ["clone", "--depth", "1", "--filter=blob:none", "--sparse", REPO, RAW]);
  await exec("git", [
    "-C",
    RAW,
    "sparse-checkout",
    "set",
    "--skip-checks",
    `${QUALITY}/syllabs`,
    `${QUALITY}/hsk`,
    "README.md",
  ]);
  const { stdout } = await exec("git", ["-C", RAW, "rev-parse", "HEAD"]);
  if (stdout.trim() !== PIN) {
    throw new Error(`audio-cmn HEAD ${stdout.trim()} != pinned ${PIN}`);
  }
}

async function copyBatch(files: { from: string; to: string }[]) {
  const size = 32;
  for (let i = 0; i < files.length; i += size) {
    await Promise.all(
      files.slice(i, i + size).map(async ({ from, to }) => {
        await cp(from, to);
      }),
    );
  }
}

async function main() {
  await ensureClone();
  const forms = await corpusForms();
  const syllabSrc = `${RAW}/${QUALITY}/syllabs`;
  const hskSrc = `${RAW}/${QUALITY}/hsk`;

  await rm(OUT, { recursive: true, force: true });
  await mkdir(`${OUT}/syllabs`, { recursive: true });
  await mkdir(`${OUT}/hsk`, { recursive: true });

  const syllabNames = (await readdir(syllabSrc)).filter((n) => n.endsWith(".mp3"));
  await copyBatch(
    syllabNames.map((name) => ({ from: `${syllabSrc}/${name}`, to: `${OUT}/syllabs/${name}` })),
  );

  const wordFiles: { from: string; to: string }[] = [];
  const available = new Set(await readdir(hskSrc));
  for (const form of forms) {
    const name = `cmn-${form}.mp3`;
    if (!available.has(name)) continue;
    wordFiles.push({ from: `${hskSrc}/${name}`, to: `${OUT}/hsk/${name}` });
  }
  await copyBatch(wordFiles);

  await cp(`${RAW}/README.md`, `${OUT}/UPSTREAM.md`);
  const pin = {
    repo: "https://github.com/hugolpz/audio-cmn",
    commit: PIN,
    quality: QUALITY,
    license: "CC-BY-SA",
    speakers: { syllabs: "Chen Wang", hsk: "Yue Tan" },
    curator: "Hugo Lopez",
    words: wordFiles.length,
    syllables: syllabNames.length,
    notes:
      "Pruned to corpus word/lexeme forms plus the full 24k-abr syllable bank. Upstream removed tone-5 files (they were copies of tone 1); this app never substitutes tone 1 for neutral tone.",
  };
  await writeFile(`${OUT}/SOURCE.json`, `${JSON.stringify(pin, null, 2)}\n`);
  await writeFile(
    `${OUT}/README.md`,
    [
      "# audio-cmn (pruned)",
      "",
      "Vendored from https://github.com/hugolpz/audio-cmn at the commit in `SOURCE.json`.",
      "MP3s are gitignored. Regenerate with `pnpm data:audio`, then host `hsk/` and `syllabs/` and set `CDN_AUDIO_URL` to that directory.",
      "",
    ].join("\n"),
  );
  console.log(
    `audio-cmn ${PIN.slice(0, 12)} · ${wordFiles.length} words · ${syllabNames.length} syllables`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
