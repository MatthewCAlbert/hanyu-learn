import { describe, expect, it } from "vitest";
import { serializeWordContext, serializeLexemeContext } from "~/lib/ai/context";
import type { WordDetailData } from "~/lib/detail-data";
import type { Word } from "~/lib/types";

function wordData(partial: Partial<WordDetailData> & { word: Word }): WordDetailData {
  return {
    chars: [],
    topics: [],
    relations: [],
    usage: null,
    ...partial,
  };
}

describe("relation snapshots for the study chat", () => {
  it("includes real-life alternatives and character roles", () => {
    const ctx = serializeWordContext(
      wordData({
        word: {
          word: "什么",
          level: 1,
          extra: false,
          readings: [{ pinyin: "shénme", meanings: ["what"] }],
          pinyin: "shénme",
          meanings: ["what"],
          frequency: 1,
          pos: ["r"],
          traditional: null,
          classifiers: [],
          chars: ["什", "么"],
          sentences: [],
          standards: [],
          topics: [],
          relationIds: ["what-question"],
          authored: null,
        },
        chars: [
          {
            char: "什",
            pinyin: "shén",
            meaning: "what",
            level: 1,
            radical: "亻",
            link: {
              char: "什",
              role: "phonetic",
              transparency: "fossilized",
              contribution: "sound shell",
            },
          },
        ],
        usage: {
          assessment: "everyday",
          register: "textbook",
          contexts: ["classroom"],
          regions: ["widespread"],
          currency: "current",
          evidence: [{ kind: "normative", source: "HSK 3.0" }],
        },
        relations: [
          {
            id: "what-question",
            kind: "register-set",
            uiLabel: "Real-life alternatives",
            label: "What",
            axis: null,
            distinctions: "什么 is taught; 啥 is colloquial.",
            members: [
              {
                form: "什么",
                kind: "word",
                role: "textbook",
                contexts: [],
                regions: [],
                pos: [],
                pinyin: "shénme",
                meaning: "what",
                inCorpus: true,
                href: "/words/什么",
              },
              {
                form: "啥",
                kind: "lexeme",
                role: "chat",
                contexts: ["chat"],
                regions: ["northern"],
                pos: [],
                pinyin: "shá",
                meaning: "what",
                inCorpus: false,
                href: null,
              },
            ],
          },
        ],
      }),
    );
    expect(ctx.text).toContain("Real-life alternatives");
    expect(ctx.text).toContain("啥 (chat) [not on HSK]");
    expect(ctx.text).toContain("phonetic/fossilized");
    expect(ctx.hints?.hasRelations).toBe(true);
    expect(ctx.hints?.hasUsage).toBe(true);
  });
});

describe("lexeme page snapshots", () => {
  it("serializes a spoken/chat form without calling it slang", () => {
    const ctx = serializeLexemeContext({
      lexeme: {
        form: "啥",
        pinyin: "shá",
        meanings: ["what"],
        pos: ["r"],
        register: "colloquial",
        contexts: ["speech", "chat"],
        regions: ["northern"],
        currency: "current",
        status: "reviewed",
        confidence: "high",
        sources: ["现代汉语词典 7th ed., 啥"],
        notes: "Colloquial interrogative.",
        relationIds: ["what-question"],
      },
      relations: [],
    });
    expect(ctx.kind).toBe("lexeme");
    expect(ctx.route).toBe("/lexemes/%E5%95%A5");
    expect(ctx.text).toContain("not on HSK");
    expect(ctx.text).toContain("Do not call this slang");
    expect(ctx.hints?.hasUsage).toBe(true);
  });
});
