/**
 * Invariants over the browser shards. They must cover the same corpus as the
 * full JSON, and the hash function used at build time must match the client.
 */
import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import hanzi from "~/data/generated/hanzi.json";
import words from "~/data/generated/words.json";
import type {
  DatasetManifest,
  DatasetMeta,
  Hanzi,
  HanziIndex,
  HanziPage,
  PhoneticAnchor,
  Word,
  WordIndex,
  WordPage,
} from "~/lib/types";
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
    expect(names).toEqual(
      expect.arrayContaining([
        "meta.json",
        "h1.json",
        "w7.json",
        "w-extra.json",
        "phonetics.json",
        "hd",
        "wd",
        "st",
        "gd",
        "g1.json",
      ]),
    );
  });

  it("indexes cover every hanzi and word once, by level", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const indexedHanzi: HanziIndex[] = [];
    const indexedWords: WordIndex[] = [];
    for (const level of [1, 2, 3, 4, 5, 6, 7] as const) {
      const h = await readJson<HanziIndex[]>(`${version}/h${level}.json`);
      const w = await readJson<WordIndex[]>(`${version}/w${level}.json`);
      expect(h.every((row) => row.level === level)).toBe(true);
      expect(w.every((row) => row.level === level && !row.extra)).toBe(true);
      indexedHanzi.push(...h);
      indexedWords.push(...w);
    }
    const extra = await readJson<WordIndex[]>(`${version}/w-extra.json`);
    expect(extra.every((row) => row.extra)).toBe(true);
    indexedWords.push(...extra);
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
      expect(Array.isArray(wordBuckets[shardBucket(w.word)]![w.word]?.relations)).toBe(true);
    }
    const shenme = wordBuckets[shardBucket("什么")]!["什么"];
    expect(shenme?.relations.some((r) => r.uiLabel === "Real-life alternatives")).toBe(true);
    expect(shenme?.chars.some((c) => c.link?.role === "phonetic")).toBe(true);
    const sha = shenme?.relations
      .find((r) => r.id === "what-question")
      ?.members.find((m) => m.form === "啥");
    expect(sha).toMatchObject({ kind: "lexeme", inCorpus: false, href: "/lexemes/%E5%95%A5" });
  });

  it("meta lists the same radicals and topics as the full JSON", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const meta = await readJson<DatasetMeta>(`${version}/meta.json`);
    expect(meta.radicals).toHaveLength(205);
    expect(meta.topics.length).toBeGreaterThan(0);
    expect(meta.relations.length).toBeGreaterThan(0);
    expect(meta.lexemes.length).toBeGreaterThan(0);
    expect(meta.counts[1].hanzi).toBe(300);
    expect(meta.extraWords).toBe(229);
  });

  it("phonetics.json covers every visible series key and does not add a bucket dir", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const phonetics = await readJson<Record<string, PhoneticAnchor>>(`${version}/phonetics.json`);
    const names = await readdir(`${WEB}/${version}`);
    expect(names).not.toContain("pd");

    const keys = new Set(
      H.map((h) => {
        const p = h.authored?.phonetic ?? h.etymology?.phonetic;
        if (h.authored?.phonetic) return h.authored.phonetic;
        if (!p || h.etymology?.phoneticVisible === false) return null;
        return p;
      }).filter((p): p is string => Boolean(p)),
    );
    expect(Object.keys(phonetics).sort()).toEqual([...keys].sort());
    expect(phonetics["礻"]?.anchor).toBe("示");
    expect(phonetics["礻"]?.pinyin).toContain("shì");
    expect(phonetics["马"]?.component).toBe("马");
  });

  it("hanzi detail pages never link a non-corpus leaf to /hanzi/", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const chars = new Set(H.map((h) => h.char));
    const hanziBuckets = await Promise.all(
      Array.from({ length: SHARD_BUCKETS }, (_, i) =>
        readJson<Record<string, HanziPage>>(`${version}/hd/${i}.json`),
      ),
    );
    const shi = hanziBuckets[shardBucket("视")]!["视"]!;
    expect(shi.componentHrefs["礻"]).toBe(`/phonetic/${encodeURIComponent("礻")}`);
    expect(shi.semanticRole?.form).toBe("见");
    expect(shi.phoneticRole?.form).toBe("礻");
    expect(shi.componentHrefs["礻"]).not.toContain("/hanzi/");
    for (const h of H) {
      const hrefs = hanziBuckets[shardBucket(h.char)]![h.char]?.componentHrefs ?? {};
      for (const [form, href] of Object.entries(hrefs)) {
        if (href?.startsWith("/hanzi/")) {
          const target = decodeURIComponent(href.slice("/hanzi/".length));
          expect(chars.has(target), `${h.char} links ${form} to missing ${target}`).toBe(true);
        }
      }
    }
  });

  it("uses a bounded number of bucket files", async () => {
    const { version } = await readJson<DatasetManifest>("manifest.json");
    const [hd, wd, st, gd] = await Promise.all([
      readdir(`${WEB}/${version}/hd`),
      readdir(`${WEB}/${version}/wd`),
      readdir(`${WEB}/${version}/st`),
      readdir(`${WEB}/${version}/gd`),
    ]);
    expect(hd).toHaveLength(SHARD_BUCKETS);
    expect(wd).toHaveLength(SHARD_BUCKETS);
    expect(st).toHaveLength(SHARD_BUCKETS);
    expect(gd).toHaveLength(SHARD_BUCKETS);
  });
});
