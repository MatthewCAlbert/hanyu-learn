import { serverTool, tool } from "@openrouter/agent/tool";
import { z } from "zod";
import { searchCompare } from "~/lib/compare-search";
import { loadCompareEntry, loadHanziDetail, loadWordDetail } from "~/lib/detail-data";
import { serializeCompareEntry, serializeHanziContext, serializeWordContext } from "./context";
import { loadAiCatalog } from "./catalog";
import type { EntryKind } from "~/lib/compare";
import { isEntryKind } from "~/lib/compare";

const SEARCH_CAP = 8;

export const searchCorpusInput = z.object({
  query: z.string().min(1).describe("Character, pinyin, or English gloss"),
  kind: z
    .enum(["hanzi", "word", "any"])
    .optional()
    .describe("Restrict to hanzi or words. Default any."),
});

export const lookupHanziInput = z.object({
  char: z.string().min(1).describe("A single HSK character, e.g. 好"),
});

export const lookupWordInput = z.object({
  word: z.string().min(1).describe("The word, e.g. 爱好"),
});

export const lookupEntryInput = z.object({
  kind: z
    .enum(["hanzi", "word", "radical", "phonetic", "topic"])
    .describe("Entry kind"),
  id: z.string().min(1).describe("Character, word, radical, phonetic component, or topic id"),
});

export const WEB_SEARCH_PARAMS = {
  engine: "auto" as const,
  maxResults: 5,
  maxTotalResults: 8,
  searchContextSize: "low" as const,
};

/** Deeper budget for song identity and lyric-source retrieval. Study chat stays on WEB_SEARCH_PARAMS. */
export const SONG_WEB_SEARCH_PARAMS = {
  engine: "auto" as const,
  maxResults: 8,
  maxTotalResults: 12,
  searchContextSize: "medium" as const,
};

function preview(text: string, max = 1600): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export const searchCorpus = tool({
  name: "search_corpus",
  description:
    "Search this app's HSK hanzi and word indexes by character, pinyin, or English gloss. Use before guessing an id.",
  inputSchema: searchCorpusInput,
  execute: async ({ query, kind }) => {
    const catalog = await loadAiCatalog();
    const groups = searchCompare(catalog, query).filter((g) => {
      if (!kind || kind === "any") return g.kind === "hanzi" || g.kind === "word";
      return g.kind === kind;
    });
    const hits = groups.flatMap((g) =>
      g.hits.slice(0, SEARCH_CAP).map((h) => ({
        kind: h.kind,
        id: h.ref.id,
        title: h.title,
        reading: h.reading,
        gloss: h.gloss,
        mention: h.kind === "hanzi" || h.kind === "word" ? `@/${h.kind}/${h.ref.id}` : undefined,
      })),
    );
    return { query, hits };
  },
});

export const lookupHanzi = tool({
  name: "lookup_hanzi",
  description: "Load the full authored hanzi page for one character in this corpus.",
  inputSchema: lookupHanziInput,
  execute: async ({ char }) => {
    const data = await loadHanziDetail(char);
    if (!data) return { found: false as const, char };
    return { found: true as const, text: preview(serializeHanziContext(data).text, 4000) };
  },
});

export const lookupWord = tool({
  name: "lookup_word",
  description: "Load the full authored word page for one vocabulary item in this corpus.",
  inputSchema: lookupWordInput,
  execute: async ({ word }) => {
    const data = await loadWordDetail(word);
    if (!data) return { found: false as const, word };
    return { found: true as const, text: preview(serializeWordContext(data).text, 4000) };
  },
});

const lookupEntry = tool({
  name: "lookup_entry",
  description:
    "Load a radical, phonetic series, topic, hanzi, or word page by kind and id (the compare-ref form).",
  inputSchema: lookupEntryInput,
  execute: async ({ kind, id }) => {
    if (!isEntryKind(kind)) return { found: false as const, kind, id };
    const entry = await loadCompareEntry({ kind: kind as EntryKind, id });
    if (!entry) return { found: false as const, kind, id };
    return { found: true as const, kind, id, text: preview(serializeCompareEntry(entry), 4000) };
  },
});

const webSearch = serverTool({
  type: "openrouter:web_search",
  parameters: WEB_SEARCH_PARAMS,
});

export const agentTools = [searchCorpus, lookupHanzi, lookupWord, lookupEntry, webSearch] as const;

export type AgentTools = typeof agentTools;
