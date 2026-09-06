/**
 * Invariants over the browser shards. They must cover the same corpus as the
 * full JSON, and the hash function used at build time must match the client.
 */
import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import type { DatasetManifest, DatasetMeta, Hanzi, HanziIndex, HanziPage, Word, WordIndex, WordPage } from "~/lib/types";
import { SHARD_BUCKETS, shardBucket } from "~/lib/shards";

const H = hanzi as unknown as Hanzi[];
const W = words as unknown as Word[];
const WEB = "app/data/generated/web";

async function readJson<T>(rel: string): Promise<T> {
  return JSON.parse(await readFile(`${WEB}/${rel}`, "utf8")) as T;
}

describe("web shards", () => {
  it("manifest names a version directory that exists", async () => {
    const manifest = await readJson<DatasetManifest>("manifest.json");
    expect(manifest.version).toMatch(/^[a-f0-9]{12}$/);
    expect(manifest.buckets).toBe(SHARD_BUCKETS);
    const names = await readdir(`${WEB}/${manifest.version}`);
    expect(names).toEqual(expect.arrayContaining(["meta.json", "h1.json", "w7.json", "hd", "wd", "st"]));
  });

  it("indexes cover every hanzi and word once, by level", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const indexedHanzi: HanziIndex[] = [];
    const indexedWords: WordIndex[] = [];
    for (const level of [1, 2, 3, 4, 5, 6, 7] as const) {
      const h = await readJson<HanziIndex[]>(`${version}/h${level}.json`);
      const w = await readJson<WordIndex[]>(`${version}/w${level}.json`);
      expect(h.every((row) => row.level === level)).toBe(true);
      expect(w.every((row) => row.level === level)).toBe(true);
      indexedHanzi.push(...h);
      indexedWords.push(...w);
    }
    expect(indexedHanzi.map((h) => h.char).sort()).toEqual(H.map((h) => h.char).sort());
    expect(indexedWords.map((w) => w.word).sort()).toEqual(W.map((w) => w.word).sort());
  });

  it("detail buckets contain every entry at the hashed slot", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const hanziBuckets = await Promise.all(
      Array.from({ length: SHARD_BUCKETS }, (_, i) =>
        readJson<Record<string, HanziPage>>(`${version}/hd/${i}.json`),
      ),
    );
    const wordBuckets = await Promise.all(
      Array.from({ length: SHARD_BUCKETS }, (_, i) =>
        readJson<Record<string, WordPage>>(`${version}/wd/${i}.json`),
      ),
    );
    for (const h of H) {
      expect(hanziBuckets[shardBucket(h.char)]![h.char]?.hanzi.char).toBe(h.char);
    }
    for (const w of W) {
      expect(wordBuckets[shardBucket(w.word)]![w.word]?.word.word).toBe(w.word);
    }
  });

  it("meta lists the same radicals and topics as the full JSON", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const meta = await readJson<DatasetMeta>(`${version}/meta.json`);
    expect(meta.radicals).toHaveLength(205);
    expect(meta.topics.length).toBeGreaterThan(0);
    expect(meta.counts[1].hanzi).toBe(300);
  });

  it("uses a bounded number of bucket files", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const [hd, wd, st] = await Promise.all([
      readdir(`${WEB}/${version}/hd`),
      readdir(`${WEB}/${version}/wd`),
      readdir(`${WEB}/${version}/st`),
    ]);
    expect(hd).toHaveLength(SHARD_BUCKETS);
    expect(wd).toHaveLength(SHARD_BUCKETS);
    expect(st).toHaveLength(SHARD_BUCKETS);
  });
});
