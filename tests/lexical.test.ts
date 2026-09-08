import { describe, expect, it } from "vitest";
import {
  CHAR_CONTRIBUTION_SECTION,
  MEMBER_UI_LABEL,
  RELATION_UI_LABEL,
  isHanziLexeme,
  lexemeHref,
  rankContainedWords,
  textbookPercentiles,
  toRelationCard,
} from "~/lib/lexical";
import { GLOSSARY_KEYS, GLOSSARY, glossaryAriaLabel, isGlossaryKey } from "~/lib/lexical-glossary";
import { contributionTransparencySchema, charRoleSchema } from "~/lib/content-schema";
import { wikiTargets } from "~/lib/lexical-candidates";

describe("learner-facing labels", () => {
  it("never shows schema names for relation kinds", () => {
    expect(RELATION_UI_LABEL["register-set"]).toBe("Real-life alternatives");
    expect(RELATION_UI_LABEL["synonym-set"]).toBe("Similar words");
    expect(RELATION_UI_LABEL["antonym-pair"]).toBe("Opposites");
    expect(CHAR_CONTRIBUTION_SECTION).toBe("How this character works in words");
    for (const [kind, label] of Object.entries(RELATION_UI_LABEL)) {
      expect(label).not.toBe(kind);
    }
  });

  it("gives compact labels for real-life alternative chips", () => {
    expect(MEMBER_UI_LABEL.textbook).toBe("Textbook/neutral");
    expect(MEMBER_UI_LABEL.chat).toBe("Chat");
  });

  it("treats only a single character as Extra Hanzi", () => {
    expect(isHanziLexeme("啥")).toBe(true);
    expect(isHanziLexeme("搞定")).toBe(false);
    expect(lexemeHref("啥")).toBe("/lexemes/%E5%95%A5");
  });
});

describe("glossary", () => {
  it("defines every label a learner can hover or focus", () => {
    expect(GLOSSARY_KEYS.length).toBeGreaterThan(10);
    for (const key of GLOSSARY_KEYS) {
      expect(GLOSSARY[key].label.length).toBeGreaterThan(0);
      expect(GLOSSARY[key].definition.length).toBeGreaterThan(8);
      expect(glossaryAriaLabel(key)).toContain(GLOSSARY[key].definition);
      expect(isGlossaryKey(key)).toBe(true);
    }
    expect(isGlossaryKey("register-set")).toBe(true);
    expect(isGlossaryKey("opaque")).toBe(true);
    expect(isGlossaryKey("out-of-corpus")).toBe(true);
    expect(isGlossaryKey("not-a-term")).toBe(false);
    expect(GLOSSARY["out-of-corpus"].label).toBe("not on HSK");
    expect(glossaryAriaLabel("chat")).toMatch(/^Chat: /);
    expect(glossaryAriaLabel("chat")).toContain(GLOSSARY.chat.definition);
  });

  it("keeps opaque as word-level, not a character role", () => {
    expect(charRoleSchema.safeParse("opaque").success).toBe(false);
    expect(charRoleSchema.safeParse("semantic").success).toBe(true);
    expect(contributionTransparencySchema.safeParse("opaque").success).toBe(false);
    expect(contributionTransparencySchema.safeParse("fossilized").success).toBe(true);
  });
});

describe("ranking", () => {
  it("ranks primary salience and lower HSK before extra and null frequency", () => {
    const ranked = rankContainedWords([
      { word: "计算机", extra: false, level: 4, frequency: 10, salience: "none" as const },
      { word: "电脑", extra: false, level: 1, frequency: 5, salience: "primary" as const },
      { word: "电脑包", extra: true, level: 3, frequency: null, salience: "primary" as const },
      { word: "电视", extra: false, level: 1, frequency: 20, salience: null },
    ]);
    expect(ranked.map((w) => w.word)).toEqual(["电脑", "电视", "计算机", "电脑包"]);
  });

  it("computes within-level textbook percentiles without mixing levels", () => {
    const pct = textbookPercentiles([
      { word: "什么", extra: false, level: 1, frequency: 100 },
      { word: "东西", extra: false, level: 1, frequency: 50 },
      { word: "咖啡", extra: false, level: 1, frequency: 1 },
      { word: "高兴", extra: false, level: 2, frequency: 90 },
      { word: "法国", extra: true, level: 1, frequency: null },
    ]);
    expect(pct.get("什么")).toBe(100);
    expect(pct.get("咖啡")).toBe(0);
    expect(pct.get("高兴")).toBe(100);
    expect(pct.has("法国")).toBe(false);
  });
});

describe("wikilink harvest", () => {
  it("collects unique wiki targets", () => {
    expect(wikiTargets("Near-synonym [[高兴]]; also [[开心]] and [[高兴]].")).toEqual([
      "高兴",
      "开心",
    ]);
  });
});

describe("relation cards", () => {
  it("marks lexemes as out of corpus and links to the lexeme page", () => {
    const card = toRelationCard(
      {
        id: "what-question",
        kind: "register-set",
        label: "What",
        axis: null,
        status: "reviewed",
        confidence: "high",
        sources: [],
        distinctions: "什么 is taught; 啥 is colloquial.",
        evidence: null,
        members: [
          {
            form: "什么",
            kind: "word",
            role: "textbook",
            sense: "what",
            pos: ["r"],
            contexts: [],
            regions: [],
          },
          {
            form: "啥",
            kind: "lexeme",
            role: "chat",
            sense: "what",
            pos: ["r"],
            contexts: ["chat"],
            regions: ["northern"],
          },
        ],
      },
      new Map([
        [
          "什么",
          {
            word: "什么",
            pinyin: "shénme",
            meanings: ["what"],
          } as never,
        ],
      ]),
      new Map(),
      new Map([
        [
          "啥",
          {
            form: "啥",
            pinyin: "shá",
            meanings: ["what"],
          } as never,
        ],
      ]),
    );
    expect(card.uiLabel).toBe("Real-life alternatives");
    expect(card.members[0]).toMatchObject({
      form: "什么",
      inCorpus: true,
      href: "/words/%E4%BB%80%E4%B9%88",
    });
    expect(card.members[1]).toMatchObject({
      form: "啥",
      inCorpus: false,
      href: "/lexemes/%E5%95%A5",
      pinyin: "shá",
    });
  });
});
