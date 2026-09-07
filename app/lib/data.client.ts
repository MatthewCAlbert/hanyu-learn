/**
 * Browser access to the sharded dataset. Fetches only the compact files a
 * route needs, dedupes in-flight requests, and relies on immutable URLs plus
 * the HTTP cache for repeat visits.
 */
import { shardBucket, SHARD_BUCKETS } from "./shards";
import { LEVELS } from "./levels";
import { matchRadical } from "./radicals";
import type {
  DatasetManifest,
  DatasetMeta,
  HanziIndex,
  HanziPage,
  Level,
  PhoneticAnchor,
  Radical,
  Topic,
  WordIndex,
  WordPage,
} from "./types";

const inflight = new Map<string, Promise<unknown>>();

function loadJson<T>(path: string): Promise<T> {
  const cached = inflight.get(path);
  if (cached) return cached as Promise<T>;
  const req = fetch(path).then(async (res) => {
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return (await res.json()) as T;
  });
  inflight.set(path, req);
  return req;
}

let manifestPromise: Promise<string> | undefined;

async function datasetVersion(): Promise<string> {
  if (typeof __DATASET_VERSION__ === "string" && __DATASET_VERSION__) {
    return __DATASET_VERSION__;
  }
  manifestPromise ??= loadJson<DatasetManifest>("/data/manifest.json").then((m) => m.version);
  return manifestPromise;
}

async function asset<T>(rel: string): Promise<T> {
  const version = await datasetVersion();
  return loadJson<T>(`/data/${version}/${rel}`);
}

export async function getMeta(): Promise<DatasetMeta> {
  return asset<DatasetMeta>("meta.json");
}

export async function getHanziIndex(level: Level): Promise<HanziIndex[]> {
  return asset<HanziIndex[]>(`h${level}.json`);
}

export async function getWordIndex(level: Level): Promise<WordIndex[]> {
  return asset<WordIndex[]>(`w${level}.json`);
}

export async function getHanziIndexes(levels: Level[]): Promise<HanziIndex[]> {
  const parts = await Promise.all(levels.map(getHanziIndex));
  return parts.flat();
}

export async function getWordIndexes(levels: Level[]): Promise<WordIndex[]> {
  const parts = await Promise.all(levels.map(getWordIndex));
  return parts.flat();
}

export async function getHanziPage(char: string): Promise<HanziPage | undefined> {
  const bucket = await asset<Record<string, HanziPage>>(`hd/${shardBucket(char)}.json`);
  return bucket[char];
}

export async function getWordPage(word: string): Promise<WordPage | undefined> {
  const bucket = await asset<Record<string, WordPage>>(`wd/${shardBucket(word)}.json`);
  return bucket[word];
}

export async function getStrokes(char: string): Promise<unknown | null> {
  const bucket = await asset<Record<string, unknown>>(`st/${shardBucket(char)}.json`);
  return bucket[char] ?? null;
}

export async function getRadical(char: string): Promise<Radical | undefined> {
  const { radicals } = await getMeta();
  return matchRadical(char, radicals);
}

export async function getTopic(id: string): Promise<Topic | undefined> {
  const { topics } = await getMeta();
  return topics.find((t) => t.id === id);
}

export async function getPhonetics(): Promise<Record<string, PhoneticAnchor>> {
  return asset<Record<string, PhoneticAnchor>>("phonetics.json");
}

export async function getPhoneticSeries(component: string): Promise<
  | {
      meta: PhoneticAnchor;
      members: HanziIndex[];
    }
  | undefined
> {
  const [phonetics, hanzi] = await Promise.all([getPhonetics(), getHanziIndexes(LEVELS)]);
  const meta = phonetics[component];
  if (!meta) return undefined;
  return {
    meta,
    members: hanzi.filter((h) => h.phonetic === component),
  };
}

export { SHARD_BUCKETS };
