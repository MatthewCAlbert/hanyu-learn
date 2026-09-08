import { describe, expect, it } from "vitest";
import { suggestionsFor } from "~/lib/ai/suggestions";
import type { PageContext } from "~/lib/ai/types";

function ctx(partial: Partial<PageContext> & Pick<PageContext, "kind">): PageContext {
  return {
    key: partial.key ?? `${partial.kind}:x`,
    route: partial.route ?? "/",
    title: partial.title ?? "x",
    kind: partial.kind,
    text: partial.text ?? "",
    hints: partial.hints,
  };
}

describe("suggestionsFor", () => {
  it("returns nothing off a browse page", () => {
    expect(suggestionsFor(null)).toEqual([]);
    expect(suggestionsFor(ctx({ kind: "none" }))).toEqual([]);
  });

  it("offers a usage chip when both compare panes are named", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "compare",
        title: "好 vs 爱好",
        hints: {
          left: { label: "好", mention: { kind: "hanzi", id: "好" } },
          right: { label: "爱好", mention: { kind: "word", id: "爱好" } },
        },
      }),
    );
    expect(chips[0]).toMatchObject({
      id: "usage",
      label: "Usage: 好 vs 爱好",
    });
    expect(chips[0]?.prompt).toContain("@/hanzi/好");
    expect(chips[0]?.prompt).toContain("@/word/爱好");
    expect(chips.some((c) => c.id === "examples")).toBe(true);
  });

  it("hides the usage chip when a compare pane is empty", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "compare",
        title: "好",
        hints: {
          left: { label: "好", mention: { kind: "hanzi", id: "好" } },
        },
      }),
    );
    expect(chips.find((c) => c.id === "usage")).toBeUndefined();
    expect(chips.some((c) => c.id === "examples")).toBe(true);
  });

  it("uses plain labels for radicals that cannot be mentioned", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "compare",
        hints: {
          left: { label: "女" },
          right: { label: "子" },
        },
      }),
    );
    expect(chips[0]?.prompt).toContain("女");
    expect(chips[0]?.prompt).not.toMatch(/@\/(hanzi|word)\//);
  });

  it("offers etymology on a stub hanzi and still includes examples", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "hanzi",
        title: "好",
        hints: {
          left: { label: "好", mention: { kind: "hanzi", id: "好" } },
          contentStatus: "stub",
          missingAuthored: true,
          readings: ["hǎo"],
        },
      }),
    );
    expect(chips.map((c) => c.id)).toEqual(["etymology", "examples"]);
    expect(chips[0]?.label).toBe("Explain the etymology");
    expect(chips[0]?.prompt).toContain("@/hanzi/好");
    expect(chips[0]?.prompt).toMatch(/attested origin/);
  });

  it("skips etymology when hanzi content is already drafted", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "hanzi",
        title: "好",
        hints: {
          left: { label: "好", mention: { kind: "hanzi", id: "好" } },
          contentStatus: "drafted",
          missingAuthored: false,
          readings: ["hǎo"],
        },
      }),
    );
    expect(chips.map((c) => c.id)).toEqual(["examples"]);
  });

  it("offers formation notes on a stub word", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "word",
        title: "爱好",
        hints: {
          left: { label: "爱好", mention: { kind: "word", id: "爱好" } },
          contentStatus: "stub",
          missingAuthored: true,
        },
      }),
    );
    expect(chips[0]).toMatchObject({ id: "formation", label: "How is this word built?" });
    expect(chips[0]?.prompt).toContain("@/word/爱好");
    expect(chips.map((c) => c.id)).toEqual(["formation", "examples"]);
  });

  it("asks about competing readings on a multi-reading hanzi", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "hanzi",
        title: "好",
        hints: {
          left: { label: "好", mention: { kind: "hanzi", id: "好" } },
          contentStatus: "drafted",
          missingAuthored: false,
          readings: ["hǎo", "hào", "hǎo"],
        },
      }),
    );
    expect(chips[0]).toMatchObject({
      id: "readings",
      label: "When do I use hǎo vs hào?",
    });
    expect(chips[0]?.prompt).toContain("@/hanzi/好");
    expect(chips.map((c) => c.id)).toEqual(["readings", "examples"]);
  });

  it("offers a wording chip on the translate workspace", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "translate",
        title: "我喜欢学习中文",
        route: "/translate",
      }),
    );
    expect(chips.map((c) => c.id)).toEqual(["explain"]);
    expect(chips[0]?.label).toBe("Explain the wording");
  });

  it("offers a lyrics chip on a song page", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "song",
        title: "小幸运 — 田馥甄",
        route: "/songs",
      }),
    );
    expect(chips.map((c) => c.id)).toEqual(["explain"]);
    expect(chips[0]?.label).toBe("Explain these lyrics");
  });

  it("offers conversation usage when reviewed relations exist", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "word",
        title: "什么",
        hints: {
          left: { label: "什么", mention: { kind: "word", id: "什么" } },
          contentStatus: "drafted",
          missingAuthored: false,
          hasRelations: true,
          hasUsage: true,
        },
      }),
    );
    expect(chips[0]).toMatchObject({
      id: "conversation",
      label: "How is this used in conversation?",
    });
    expect(chips.map((c) => c.id)).toContain("similar");
  });

  it("caps at three chips", () => {
    const chips = suggestionsFor(
      ctx({
        kind: "hanzi",
        title: "好",
        hints: {
          left: { label: "好", mention: { kind: "hanzi", id: "好" } },
          missingAuthored: true,
          readings: ["hǎo", "hào"],
        },
      }),
    );
    expect(chips).toHaveLength(3);
    expect(chips.map((c) => c.id)).toEqual(["etymology", "readings", "examples"]);
  });
});
