import { serverTool, tool } from "@openrouter/agent/tool";
import { z } from "zod";
import { searchCompare } from "~/lib/compare-search";
import { loadCompareEntry, loadHanziDetail, loadLexemeDetail, loadWordDetail } from "~/lib/detail-data";
import { getMeta } from "~/lib/data.client";
import {
  serializeCompareEntry,
  serializeHanziContext,
  serializeLexemeContext,
  serializeWordContext,
} from "./context";
import { RELATION_UI_LABEL } from "~/lib/lexical";
import { loadAiCatalog } from "./catalog";
import type { EntryKind } from "~/lib/compare";
import { isEntryKind } from "~/lib/compare";

const SEARCH_CAP = 8;
export const RELATION_LOOKUP_LIMIT = 8;

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

export const lookupRelationsInput = z.object({
  form: z.string().min(1).optional().describe("Word, hanzi, or lexeme form, e.g. 什么 or 啥"),
  id: z.string().min(1).optional().describe("Relation id, e.g. what-question"),
  kind: z
    .enum(["synonym-set", "antonym-pair", "register-set"])
    .optional()
    .describe("Restrict by relation kind"),
});

export const lookupEntryInput = z.object({
  kind: z.enum(["hanzi", "word", "radical", "phonetic", "topic"]).describe("Entry kind"),
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
  description:
    "Load the full authored word page, or a spoken/chat lexeme that is not an HSK/Extra country word.",
  inputSchema: lookupWordInput,
  execute: async ({ word }) => {
    const data = await loadWordDetail(word);
    if (data) return { found: true as const, text: preview(serializeWordContext(data).text, 4000) };
    const lexeme = await loadLexemeDetail(word);
    if (lexeme) {
      return { found: true as const, text: preview(serializeLexemeContext(lexeme).text, 4000) };
    }
    return { found: false as const, word };
  },
});

const lookupRelations = tool({
  name: "lookup_relations",
  description:
    "Load reviewed synonym, antonym, or real-life-alternative sets for a form or relation id. Missing data means unknown — do not invent pairs.",
  inputSchema: lookupRelationsInput,
  execute: async ({ form, id, kind }) => {
    const meta = await getMeta();
    const lexemeByForm = new Map(meta.lexemes.map((l) => [l.form, l]));
    let hits = meta.relations;
    if (id) hits = hits.filter((r) => r.id === id);
    if (form) hits = hits.filter((r) => r.members.some((m) => m.form === form));
    if (kind) hits = hits.filter((r) => r.kind === kind);
    if (hits.length === 0) {
      return { found: false as const, form: form ?? null, id: id ?? null, kind: kind ?? null };
    }
    return {
      found: true as const,
      relations: hits.slice(0, RELATION_LOOKUP_LIMIT).map((r) => ({
        id: r.id,
        uiLabel: RELATION_UI_LABEL[r.kind],
        kind: r.kind,
        label: r.label,
        axis: r.axis,
        distinctions: r.distinctions,
        members: r.members.map((m) => {
          const lex = lexemeByForm.get(m.form);
          return {
            form: m.form,
            memberKind: m.kind,
            role: m.role ?? null,
            pinyin: lex?.pinyin ?? "",
            meaning: lex?.meanings[0] ?? m.sense ?? "",
            inCorpus: m.kind !== "lexeme",
          };
        }),
      })),
    };
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

export const agentTools = [
  searchCorpus,
  lookupHanzi,
  lookupWord,
  lookupRelations,
  lookupEntry,
  webSearch,
] as const;

export type AgentTools = typeof agentTools;
