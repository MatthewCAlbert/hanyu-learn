import { describe, expect, it } from "vitest";
import {
  extractMentions,
  highlightComposer,
  insertMention,
  matchingKinds,
  mentionAtCaret,
  parseMentionRaw,
  segmentMentions,
} from "~/lib/ai/mentions";
import { searchMentions } from "~/lib/ai/mention-search";
import type { CompareCatalog } from "~/lib/detail-data";

describe("mention parsing", () => {
  it("treats a bare @ as choosing a kind", () => {
    expect(parseMentionRaw("@")).toMatchObject({ choosingKind: true, q: "", kind: null });
  });

  it("filters kinds after @/", () => {
    expect(parseMentionRaw("@/han")).toMatchObject({ choosingKind: true, kindPrefix: "han" });
    expect(matchingKinds("han")).toEqual(["hanzi"]);
    expect(matchingKinds("")).toEqual(["hanzi", "word"]);
  });

  it("scopes search after @/hanzi/ or @/word/", () => {
    expect(parseMentionRaw("@/hanzi/我")).toEqual({
      start: 0,
      end: 9,
      raw: "@/hanzi/我",
      kind: "hanzi",
      q: "我",
      choosingKind: false,
      kindPrefix: "hanzi",
    });
    expect(parseMentionRaw("@/word/爱好")).toMatchObject({ kind: "word", q: "爱好" });
  });

  it("searches both kinds when typing @我", () => {
    expect(parseMentionRaw("@我")).toMatchObject({ kind: null, q: "我", choosingKind: false });
  });

  it("finds the mention at the caret, not an earlier email-like token", () => {
    const text = "see 好 then @我";
    expect(mentionAtCaret(text, text.length)).toMatchObject({ q: "我", start: text.lastIndexOf("@") });
    expect(mentionAtCaret("a@b", 3)).toBeNull();
  });

  it("inserts a canonical token over the active mention", () => {
    const text = "compare @我";
    const next = insertMention(text, text.length, { kind: "hanzi", id: "我" });
    expect(next.text).toBe("compare @/hanzi/我 ");
  });

  it("extracts canonical mentions from a message", () => {
    expect(extractMentions("see @/hanzi/好 and @/word/爱好 twice @/hanzi/好")).toEqual([
      { kind: "hanzi", id: "好" },
      { kind: "word", id: "爱好" },
    ]);
    expect(extractMentions("for @/hanzi/好?")).toEqual([{ kind: "hanzi", id: "好" }]);
  });
});

describe("mention ranking", () => {
  const catalog: CompareCatalog = {
    hanzi: [
      {
        char: "我",
        level: 1,
        pinyin: ["wǒ"],
        meanings: ["I; me"],
        frequency: 1,
        radical: "戈",
        radicalCanonical: "戈",
        components: [],
        standards: [],
        topics: [],
        status: "stub",
        phonetic: null,
        semantic: null,
      },
      {
        char: "好",
        level: 1,
        pinyin: ["hǎo"],
        meanings: ["good"],
        frequency: 2,
        radical: "女",
        radicalCanonical: "女",
        components: ["女", "子"],
        standards: [],
        topics: [],
        status: "stub",
        phonetic: null,
        semantic: "女",
      },
    ],
    words: [
      {
        word: "爱好",
        level: 1,
        extra: false,
        pinyin: "àihào",
        meanings: ["hobby"],
        frequency: 1,
        standards: [],
        topics: [],
        status: "stub",
        literal: null,
        transparency: null,
      },
      {
        word: "我们",
        level: 1,
        extra: false,
        pinyin: "wǒmen",
        meanings: ["we"],
        frequency: 2,
        standards: [],
        topics: [],
        status: "stub",
        literal: null,
        transparency: null,
      },
    ],
    radicals: [],
    topics: [],
    phonetics: [],
  };

  it("ranks an exact hanzi first when @ searches both kinds", () => {
    const query = parseMentionRaw("@我");
    expect(query).toBeTruthy();
    const hits = searchMentions(catalog, query!);
    expect(hits[0]).toMatchObject({ kind: "hanzi", ref: { id: "我" } });
  });

  it("prefilters by @/word/ and inserts the canonical token", () => {
    const text = "see @/word/爱";
    const query = mentionAtCaret(text, text.length);
    expect(query).toMatchObject({ kind: "word", q: "爱" });
    const hits = searchMentions(catalog, query!);
    expect(hits.every((h) => h.kind === "word")).toBe(true);
    expect(hits[0]?.ref.id).toBe("爱好");
    const next = insertMention(text, text.length, {
      kind: "word",
      id: "爱好",
    });
    expect(next.text).toBe("see @/word/爱好 ");
  });
});

describe("highlightComposer", () => {
  it("marks complete @/hanzi and @/word tokens", () => {
    expect(highlightComposer("see @/hanzi/好 and @/word/爱好")).toEqual([
      { text: "see ", kind: "plain" },
      { text: "@/hanzi/好", kind: "mention", mention: { kind: "hanzi", id: "好" } },
      { text: " and ", kind: "plain" },
      { text: "@/word/爱好", kind: "mention", mention: { kind: "word", id: "爱好" } },
    ]);
    expect(highlightComposer("When do I use hǎo vs hào for @/hanzi/好?")).toEqual([
      { text: "When do I use hǎo vs hào for ", kind: "plain" },
      { text: "@/hanzi/好", kind: "mention", mention: { kind: "hanzi", id: "好" } },
      { text: "?", kind: "plain" },
    ]);
  });

  it("underlines an in-progress @ mention at the caret", () => {
    expect(highlightComposer("ask @我", 6)).toEqual([
      { text: "ask ", kind: "plain" },
      { text: "@我", kind: "pending" },
    ]);
    expect(highlightComposer("@/hanzi/", 8)).toEqual([{ text: "@/hanzi/", kind: "pending" }]);
  });

  it("leaves email-like a@b unhighlighted", () => {
    expect(highlightComposer("a@b")).toEqual([{ text: "a@b", kind: "plain" }]);
  });
});

describe("segmentMentions", () => {
  it("marks complete tokens without pending caret highlights", () => {
    expect(segmentMentions("@/hanzi/")).toEqual([{ text: "@/hanzi/", kind: "plain" }]);
    expect(segmentMentions("see @/hanzi/好 and @/word/爱好")).toEqual([
      { text: "see ", kind: "plain" },
      { text: "@/hanzi/好", kind: "mention", mention: { kind: "hanzi", id: "好" } },
      { text: " and ", kind: "plain" },
      { text: "@/word/爱好", kind: "mention", mention: { kind: "word", id: "爱好" } },
    ]);
  });

  it("keeps trailing punctuation and email-like text plain", () => {
    expect(segmentMentions("for @/hanzi/好?")).toEqual([
      { text: "for ", kind: "plain" },
      { text: "@/hanzi/好", kind: "mention", mention: { kind: "hanzi", id: "好" } },
      { text: "?", kind: "plain" },
    ]);
    expect(segmentMentions("a@b and hello@example.com")).toEqual([
      { text: "a@b and hello@example.com", kind: "plain" },
    ]);
  });

  it("matches extractMentions for every complete token", () => {
    const text = "compare @/hanzi/好 vs @/word/爱好, then @/hanzi/好 again";
    const refs = segmentMentions(text)
      .filter((s) => s.kind === "mention")
      .map((s) => s.mention);
    expect(refs).toEqual([
      { kind: "hanzi", id: "好" },
      { kind: "word", id: "爱好" },
      { kind: "hanzi", id: "好" },
    ]);
    expect(extractMentions(text)).toEqual([
      { kind: "hanzi", id: "好" },
      { kind: "word", id: "爱好" },
    ]);
  });
});
