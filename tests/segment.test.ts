import { describe, expect, it } from "vitest";
import { analyzeText, buildLexicon, translatableBlocks, type SegmentCatalog } from "~/lib/segment";

function catalog(partial?: Partial<SegmentCatalog>): SegmentCatalog {
  return {
    hanzi: [
      hanzi("大", "dà", "big"),
      hanzi("学", "xué", "study"),
      hanzi("生", "shēng", "life"),
      hanzi("我", "wǒ", "I"),
      hanzi("喜", "xǐ", "like"),
      hanzi("欢", "huān", "joy"),
      hanzi("习", "xí", "practice"),
      hanzi("中", "zhōng", "middle"),
      hanzi("文", "wén", "language"),
      hanzi("你", "nǐ", "you"),
      hanzi("好", "hǎo", "good"),
    ],
    words: [
      word("大学", "dàxué", "university"),
      word("学生", "xuésheng", "student"),
      word("大学生", "dàxuéshēng", "university student"),
      word("喜欢", "xǐhuan", "to like"),
      word("学习", "xuéxí", "to study"),
      word("中文", "zhōngwén", "Chinese"),
      word("你好", "nǐhǎo", "hello"),
      word("我", "wǒ", "I"),
    ],
    ...partial,
  };
}

function hanzi(char: string, pinyin: string, meaning: string) {
  return { char, pinyin: [pinyin], meanings: [meaning], level: 1 as const };
}

function word(text: string, pinyin: string, meaning: string, extra = false) {
  return { word: text, pinyin, meanings: [meaning], level: 1 as const, extra };
}

function texts(analysis: ReturnType<typeof analyzeText>): string[] {
  return analysis.blocks.flatMap((b) => b.spans.map((s) => s.text));
}

describe("analyzeText", () => {
  const lexicon = buildLexicon(catalog());

  it("uses the longest corpus word as the primary token", () => {
    const analysis = analyzeText("大学生", lexicon);
    expect(texts(analysis)).toEqual(["大学生"]);
    const span = analysis.blocks[0]?.spans[0];
    expect(span?.kind).toBe("word");
    expect(span?.ref).toEqual({ kind: "word", id: "大学生" });
    expect(span?.candidates.map((c) => c.text).sort()).toEqual(
      ["大", "大学", "大学生", "学", "学生", "生"].sort(),
    );
  });

  it("falls back to shorter words and keeps cross-boundary overlaps", () => {
    const short = buildLexicon(
      catalog({
        words: [word("大学", "dàxué", "university"), word("学生", "xuésheng", "student")],
      }),
    );
    const analysis = analyzeText("大学生", short);
    expect(texts(analysis)).toEqual(["大学", "生"]);
    const first = analysis.blocks[0]?.spans[0];
    expect(first?.candidates.some((c) => c.text === "学生")).toBe(true);
  });

  it("keeps individual hanzi when no word matches", () => {
    const analysis = analyzeText("好", lexicon);
    expect(analysis.blocks[0]?.spans[0]).toMatchObject({
      kind: "hanzi",
      ref: { kind: "hanzi", id: "好" },
    });
  });

  it("prefers a single-character word over hanzi when both exist", () => {
    const analysis = analyzeText("我", lexicon);
    expect(analysis.blocks[0]?.spans[0]).toMatchObject({
      kind: "word",
      ref: { kind: "word", id: "我" },
    });
    expect(analysis.blocks[0]?.spans[0]?.candidates.some((c) => c.kind === "hanzi" && c.text === "我")).toBe(
      true,
    );
  });

  it("marks unknown hanzi without linking them", () => {
    const analysis = analyzeText("龘", lexicon);
    const span = analysis.blocks[0]?.spans[0];
    expect(span).toMatchObject({ text: "龘", kind: "unknown" });
    expect(span?.ref).toBeUndefined();
    expect(span?.candidates).toEqual([]);
  });

  it("preserves punctuation, latin, and spaces as non-linked spans", () => {
    const analysis = analyzeText("Hello, 你好！", lexicon);
    expect(texts(analysis)).toEqual(["Hello", ",", " ", "你好", "！"]);
    expect(analysis.blocks[0]?.spans.map((s) => s.kind)).toEqual([
      "other",
      "punct",
      "other",
      "word",
      "punct",
    ]);
  });

  it("keeps line boundaries, including blank lines", () => {
    const analysis = analyzeText("你好\n\n我喜欢学习中文", lexicon);
    expect(analysis.blocks.map((b) => b.id)).toEqual(["p0", "p1", "p2"]);
    expect(analysis.blocks[0]?.text).toBe("你好");
    expect(analysis.blocks[1]?.text).toBe("");
    expect(analysis.blocks[2]?.spans.map((s) => s.text)).toEqual(["我", "喜欢", "学习", "中文"]);
    expect(translatableBlocks(analysis).map((b) => b.id)).toEqual(["p0", "p2"]);
  });

  it("assigns stable span ids and source metadata", () => {
    const analysis = analyzeText("你好", lexicon);
    expect(analysis.blocks[0]?.source).toEqual({ kind: "line", index: 0 });
    expect(analysis.blocks[0]?.spans[0]?.id).toBe("p0.s0");
  });
});
