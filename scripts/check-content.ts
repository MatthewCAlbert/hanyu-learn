/**
 * Validates authored content in content/ against the generated dataset.
 *
 * This is the guard that stops a plausible-sounding but wrong write-up from
 * landing: a declared semantic/phonetic component that the character does not
 * actually contain, a file for a character outside the corpus, a "reviewed"
 * entry with no sources.
 */
import { readFile, readdir } from "node:fs/promises";
import matter from "gray-matter";
import {
  hanziFrontmatter,
  topicFrontmatter,
  wordFrontmatter,
  sections,
} from "../app/lib/content-schema.ts";
import { idsLeaves, isAtomic, parseIds } from "../app/lib/ids.ts";
import { kRSUnicodeCitationError } from "../app/lib/unihan.ts";
import type { Hanzi, Word } from "../app/lib/types.ts";

const problems: string[] = [];
const fail = (file: string, msg: string) => problems.push(`${file}: ${msg}`);

async function main() {
  const hanzi: Hanzi[] = JSON.parse(await readFile("app/data/generated/hanzi.json", "utf8"));
  const words: Word[] = JSON.parse(await readFile("app/data/generated/words.json", "utf8"));
  const radicalIndex: {
    kRSUnicode: Record<string, { radical: number; extra: number }>;
  } = JSON.parse(await readFile("data/sources/radical-index.json", "utf8"));
  const byChar = new Map(hanzi.map((h) => [h.char, h]));
  const byWord = new Map(words.map((w) => [w.word, w]));

  let checked = 0;

  for (const file of await readdir("content/hanzi")) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const path = `content/hanzi/${file}`;
    const { data, content } = matter(await readFile(path, "utf8"));

    const parsed = hanziFrontmatter.safeParse(data);
    if (!parsed.success) {
      fail(path, parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
      continue;
    }
    const fm = parsed.data;
    checked += 1;

    if (file !== `${fm.char}.md`) fail(path, `filename should be ${fm.char}.md`);

    const entry = byChar.get(fm.char);
    if (!entry) {
      fail(path, `${fm.char} is not in the HSK 1-2 corpus`);
      continue;
    }

    // A declared component must really be in the character.
    const leaves = isAtomic(entry.decomposition)
      ? new Set<string>()
      : new Set(idsLeaves(parseIds(entry.decomposition)!));
    for (const key of ["semantic", "phonetic"] as const) {
      const v = fm[key];
      if (v && !leaves.has(v)) {
        fail(
          path,
          `${key} "${v}" is not a component of ${fm.char} (${entry.decomposition}). ` +
            `If it was lost in simplification, say so in prose and leave the field empty.`,
        );
      }
    }

    for (const source of fm.sources) {
      const err = kRSUnicodeCitationError(source, fm.char, radicalIndex.kRSUnicode);
      if (err) fail(path, err);
    }

    const s = sections(content);
    if (fm.status === "reviewed") {
      if (fm.sources.length === 0) fail(path, `status "reviewed" requires at least one source`);
      if (!s["etymology"]) fail(path, `missing "## Etymology" section`);
    }
    if (s["etymology"] && s["mnemonic"] === undefined && fm.status === "reviewed") {
      // not fatal, just noted
    }
  }

  for (const file of await readdir("content/words")) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const path = `content/words/${file}`;
    const { data, content } = matter(await readFile(path, "utf8"));

    const parsed = wordFrontmatter.safeParse(data);
    if (!parsed.success) {
      fail(path, parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
      continue;
    }
    const fm = parsed.data;
    checked += 1;

    if (file !== `${fm.word}.md`) fail(path, `filename should be ${fm.word}.md`);

    const entry = byWord.get(fm.word);
    if (!entry) {
      fail(path, `${fm.word} is not in the HSK 1-2 corpus`);
      continue;
    }
    // Every character of the word must itself be documented in the corpus.
    for (const c of entry.chars) {
      if (!byChar.has(c)) fail(path, `component character ${c} missing from the hanzi set`);
    }

    const s = sections(content);
    if (fm.status === "reviewed") {
      if (fm.sources.length === 0) fail(path, `status "reviewed" requires at least one source`);
      if (!s["why this combination"]) fail(path, `missing "## Why this combination" section`);
    }
  }

  // ------------------------------------------------------------------ topics
  const topicIds = new Set<string>();
  for (const file of await readdir("content/topics")) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const path = `content/topics/${file}`;
    const { data } = matter(await readFile(path, "utf8"));

    const parsed = topicFrontmatter.safeParse(data);
    if (!parsed.success) {
      fail(path, parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
      continue;
    }
    const fm = parsed.data;
    checked += 1;

    // The filename is the topic id everywhere else, so they must agree.
    if (file !== `${fm.topic}.md`) fail(path, `filename should be ${fm.topic}.md`);
    if (topicIds.has(fm.topic)) fail(path, `duplicate topic id ${fm.topic}`);
    topicIds.add(fm.topic);

    for (const [kind, members, exists] of [
      ["hanzi", fm.hanzi, (m: string) => byChar.has(m)],
      ["words", fm.words, (m: string) => byWord.has(m)],
    ] as const) {
      const seen = new Set<string>();
      for (const m of members) {
        if (seen.has(m)) fail(path, `${kind}: ${m} listed twice`);
        seen.add(m);
        if (!exists(m)) {
          fail(
            path,
            `${kind}: ${m} is not in the corpus — check it is a real HSK entry ` +
              `and that a single character is not listed under "words" (or vice versa)`,
          );
        }
      }
    }
  }

  if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`✓ ${checked} content file(s) valid (${topicIds.size} topics)`);
}

main();
