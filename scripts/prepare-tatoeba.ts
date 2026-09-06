/**
 * One-off: download Tatoeba exports, join cmn <-> eng, and write a pruned TSV
 * into data/sources/. Run rarely (`pnpm data:tatoeba`); its output is committed
 * so the normal build never touches the network.
 *
 * Source: https://tatoeba.org — sentences are CC-BY 2.0 FR. See docs/DATA-SOURCES.md.
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const RAW = "data/sources/.raw";
const OUT = "data/sources/tatoeba-cmn-eng.tsv";

const FILES = {
  cmn: "https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2",
  eng: "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2",
  links: "https://downloads.tatoeba.org/exports/per_language/cmn/cmn-eng_links.tsv.bz2",
} as const;

/** Only hanzi and CJK punctuation. Rejects sentences carrying latin names/digits. */
const CLEAN = /^[一-鿿，。？！、：；“”‘’…—《》（）]+$/u;
const HANZI = /[一-鿿]/u;

async function fetchAndDecompress(url: string, dest: string) {
  const bz2 = `${dest}.bz2`;
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url} -> HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(bz2));
  await exec("bunzip2", ["-kf", bz2]);
  await rm(bz2);
}

async function* lines(path: string) {
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

async function main() {
  await mkdir(RAW, { recursive: true });

  for (const [name, url] of Object.entries(FILES)) {
    const dest = `${RAW}/${name}.tsv`;
    try {
      await readFile(dest);
      console.log(`· ${name}.tsv cached`);
    } catch {
      console.log(`↓ ${name} …`);
      await fetchAndDecompress(url, dest);
    }
  }

  // English sentences: id -> text
  const eng = new Map<string, string>();
  for await (const line of lines(`${RAW}/eng.tsv`)) {
    const p = line.split("\t");
    if (p.length === 3) eng.set(p[0]!, p[2]!);
  }
  console.log(`  ${eng.size.toLocaleString()} english sentences`);

  // cmn id -> [eng ids]
  const links = new Map<string, string[]>();
  for await (const line of lines(`${RAW}/links.tsv`)) {
    const [a, b] = line.split(/\s+/);
    if (!a || !b) continue;
    const cur = links.get(a);
    if (cur) cur.push(b);
    else links.set(a, [b]);
  }

  const rows: string[] = [];
  for await (const line of lines(`${RAW}/cmn.tsv`)) {
    const p = line.split("\t");
    if (p.length !== 3) continue;
    const [id, , text] = p as [string, string, string];
    if (!CLEAN.test(text)) continue;
    const n = [...text].filter((c) => HANZI.test(c)).length;
    if (n < 3 || n > 12) continue;
    const translation = (links.get(id) ?? []).map((t) => eng.get(t)).find(Boolean);
    if (!translation) continue;
    rows.push(`${id}\t${text}\t${translation.replace(/\s+/g, " ").trim()}`);
  }

  await writeFile(OUT, `# id\tcmn\teng — from Tatoeba (CC-BY 2.0 FR)\n${rows.join("\n")}\n`);
  console.log(`✓ ${OUT} — ${rows.length.toLocaleString()} sentence pairs`);
}

main();
