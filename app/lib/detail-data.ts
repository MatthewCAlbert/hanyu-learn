/**
 * Shared loaders for the five detail kinds. Canonical routes 404 on a miss;
 * the compare workspace keeps the other pane usable instead.
 */
import {
  getHanziIndexes,
  getHanziPage,
  getMeta,
  getPhonetics,
  getPhoneticSeries,
  getRadical,
  getStrokes,
  getTopic,
  getWordIndexes,
  getWordPage,
} from "./data.client";
import { LEVELS } from "./levels";
import { parseEntryRef, type EntryRef } from "./compare";
import type {
  HanziIndex,
  HanziPage,
  Level,
  PhoneticAnchor,
  Radical,
  Status,
  Topic,
  WordIndex,
  WordPage,
} from "./types";

export type HanziDetailData = HanziPage & { strokes: unknown };

export type WordDetailData = WordPage;

export interface RadicalMember {
  char: string;
  written: string;
  pinyin: string;
  meaning: string;
  level: Level;
  status: Status;
  phonetic: string | null;
  semantic: string | null;
}

export interface RadicalDetailData {
  radical: Radical;
  byLevel: { level: Level; members: RadicalMember[] }[];
  total: number;
}

export interface PhoneticDetailData {
  meta: PhoneticAnchor;
  byLevel: { level: Level; members: HanziIndex[] }[];
  total: number;
}

export interface TopicMember {
  kind: "hanzi" | "word";
  text: string;
  pinyin: string;
  meaning: string;
  level: Level;
  status: Status;
  also: string[];
}

export interface TopicDetailData {
  topic: Topic;
  byLevel: { level: Level; members: TopicMember[] }[];
  total: number;
}

export type CompareEntry =
  | { kind: "hanzi"; ref: EntryRef; data: HanziDetailData }
  | { kind: "word"; ref: EntryRef; data: WordDetailData }
  | { kind: "radical"; ref: EntryRef; data: RadicalDetailData }
  | { kind: "phonetic"; ref: EntryRef; data: PhoneticDetailData }
  | { kind: "topic"; ref: EntryRef; data: TopicDetailData };

export type ComparePane =
  | { status: "empty" }
  | { status: "invalid"; raw: string }
  | { status: "missing"; ref: EntryRef }
  | { status: "ready"; entry: CompareEntry };

export async function loadHanziDetail(char: string): Promise<HanziDetailData | undefined> {
  const [page, strokes] = await Promise.all([getHanziPage(char), getStrokes(char)]);
  if (!page) return undefined;
  return { ...page, strokes };
}

export async function loadWordDetail(word: string): Promise<WordDetailData | undefined> {
  return getWordPage(word);
}

export async function loadRadicalDetail(char: string): Promise<RadicalDetailData | undefined> {
  const radical = await getRadical(char);
  if (!radical) return undefined;

  const HANZI = await getHanziIndexes(LEVELS);
  const members = HANZI.filter((h) => h.radicalCanonical === radical.char).map((h) => ({
    char: h.char,
    written: h.radical,
    pinyin: h.pinyin[0] ?? "",
    meaning: h.meanings[0] ?? "",
    level: h.level,
    status: h.status,
    phonetic: h.phonetic,
    semantic: h.semantic,
  }));

  const byLevel = LEVELS.map((level) => ({
    level,
    members: members.filter((m) => m.level === level),
  })).filter((g) => g.members.length > 0);

  return { radical, byLevel, total: members.length };
}

export async function loadPhoneticDetail(
  component: string,
): Promise<PhoneticDetailData | undefined> {
  const series = await getPhoneticSeries(component);
  if (!series || series.members.length === 0) return undefined;

  const members = [...series.members].sort(
    (a, b) => a.level - b.level || a.char.localeCompare(b.char),
  );
  const byLevel = LEVELS.map((level) => ({
    level,
    members: members.filter((m) => m.level === level),
  })).filter((g) => g.members.length > 0);

  return { meta: series.meta, byLevel, total: members.length };
}

export async function loadTopicDetail(id: string): Promise<TopicDetailData | undefined> {
  const topic = await getTopic(id);
  if (!topic) return undefined;

  const [HANZI, WORDS] = await Promise.all([getHanziIndexes(LEVELS), getWordIndexes(LEVELS)]);

  const members: TopicMember[] = [
    ...HANZI.filter((h) => h.topics.includes(topic.id)).map((h) => ({
      kind: "hanzi" as const,
      text: h.char,
      pinyin: h.pinyin[0] ?? "",
      meaning: h.meanings[0] ?? "",
      level: h.level,
      status: h.status,
      also: h.topics.filter((t) => t !== topic.id),
    })),
    ...WORDS.filter((w) => w.topics.includes(topic.id)).map((w) => ({
      kind: "word" as const,
      text: w.word,
      pinyin: w.pinyin,
      meaning: w.meanings[0] ?? "",
      level: w.level,
      status: w.status,
      also: w.topics.filter((t) => t !== topic.id),
    })),
  ];

  const byLevel = LEVELS.map((level) => ({
    level,
    members: members.filter((m) => m.level === level),
  })).filter((g) => g.members.length > 0);

  return { topic, byLevel, total: members.length };
}

export async function resolveComparePane(raw: string | null): Promise<ComparePane> {
  const parsed = parseEntryRef(raw);
  if (parsed.status === "empty") return { status: "empty" };
  if (parsed.status === "invalid") return { status: "invalid", raw: parsed.raw };
  const { ref } = parsed;
  const entry = await loadCompareEntry(ref);
  if (!entry) return { status: "missing", ref };
  return { status: "ready", entry };
}

export async function loadCompareEntry(ref: EntryRef): Promise<CompareEntry | undefined> {
  switch (ref.kind) {
    case "hanzi": {
      const data = await loadHanziDetail(ref.id);
      return data ? { kind: "hanzi", ref, data } : undefined;
    }
    case "word": {
      const data = await loadWordDetail(ref.id);
      return data ? { kind: "word", ref, data } : undefined;
    }
    case "radical": {
      const data = await loadRadicalDetail(ref.id);
      return data ? { kind: "radical", ref, data } : undefined;
    }
    case "phonetic": {
      const data = await loadPhoneticDetail(ref.id);
      return data ? { kind: "phonetic", ref, data } : undefined;
    }
    case "topic": {
      const data = await loadTopicDetail(ref.id);
      return data ? { kind: "topic", ref, data } : undefined;
    }
  }
}

export function compareEntryTitle(entry: CompareEntry): string {
  switch (entry.kind) {
    case "hanzi":
      return entry.data.hanzi.char;
    case "word":
      return entry.data.word.word;
    case "radical":
      return entry.data.radical.display;
    case "phonetic":
      return entry.data.meta.component;
    case "topic":
      return entry.data.topic.label;
  }
}

export function compareEntrySubtitle(entry: CompareEntry): string {
  switch (entry.kind) {
    case "hanzi":
      return entry.data.hanzi.pinyin[0] ?? "";
    case "word":
      return entry.data.word.pinyin;
    case "radical":
      return entry.data.radical.gloss;
    case "phonetic":
      return entry.data.meta.pinyin[0] ?? "Sound component";
    case "topic":
      return entry.data.topic.id;
  }
}

export function paneTitle(pane: ComparePane): string {
  if (pane.status === "ready") return compareEntryTitle(pane.entry);
  if (pane.status === "missing") return pane.ref.id;
  if (pane.status === "invalid") return pane.raw;
  return "Empty";
}

export interface CompareCatalog {
  hanzi: HanziIndex[];
  words: WordIndex[];
  radicals: Radical[];
  topics: Topic[];
  phonetics: PhoneticAnchor[];
}

export async function loadCompareCatalog(): Promise<CompareCatalog> {
  const [hanzi, words, meta, phonetics] = await Promise.all([
    getHanziIndexes(LEVELS),
    getWordIndexes(LEVELS),
    getMeta(),
    getPhonetics(),
  ]);
  return {
    hanzi,
    words,
    radicals: meta.radicals,
    topics: meta.topics,
    phonetics: Object.values(phonetics),
  };
}
