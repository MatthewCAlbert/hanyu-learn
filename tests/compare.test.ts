import { describe, expect, it } from "vitest";
import {
  compareHref,
  compareSearchHref,
  entryPath,
  parseEntryRef,
  serializeEntryRef,
  setCompareSide,
  swapCompareSearch,
} from "~/lib/compare";

describe("parseEntryRef", () => {
  it("treats null and blank as an empty pane", () => {
    expect(parseEntryRef(null)).toEqual({ status: "empty" });
    expect(parseEntryRef("")).toEqual({ status: "empty" });
    expect(parseEntryRef("  ")).toEqual({ status: "empty" });
  });

  it("parses typed refs, including ids that contain a colon", () => {
    expect(parseEntryRef("hanzi:好")).toEqual({
      status: "ok",
      ref: { kind: "hanzi", id: "好" },
    });
    expect(parseEntryRef("word:爱好")).toEqual({
      status: "ok",
      ref: { kind: "word", id: "爱好" },
    });
    expect(parseEntryRef("topic:food-and-drink")).toEqual({
      status: "ok",
      ref: { kind: "topic", id: "food-and-drink" },
    });
    expect(parseEntryRef("radical:人")).toEqual({
      status: "ok",
      ref: { kind: "radical", id: "人" },
    });
    expect(parseEntryRef("phonetic:礻")).toEqual({
      status: "ok",
      ref: { kind: "phonetic", id: "礻" },
    });
  });

  it("rejects unknown kinds, missing ids, and untyped values", () => {
    expect(parseEntryRef("好")).toEqual({ status: "invalid", raw: "好" });
    expect(parseEntryRef("hanzi:")).toEqual({ status: "invalid", raw: "hanzi:" });
    expect(parseEntryRef("words:爱好")).toEqual({ status: "invalid", raw: "words:爱好" });
    expect(parseEntryRef(":好")).toEqual({ status: "invalid", raw: ":好" });
  });

  it("round-trips through serializeEntryRef", () => {
    const refs = [
      { kind: "hanzi" as const, id: "好" },
      { kind: "word" as const, id: "爱好" },
      { kind: "topic" as const, id: "travel" },
    ];
    for (const ref of refs) {
      expect(parseEntryRef(serializeEntryRef(ref))).toEqual({ status: "ok", ref });
    }
  });
});

describe("compare URLs", () => {
  it("builds a bookmarkable href from one or both sides", () => {
    expect(compareHref({})).toBe("/compare");
    expect(compareHref({ left: { kind: "hanzi", id: "好" } })).toBe(
      `/compare?${new URLSearchParams({ left: "hanzi:好" })}`,
    );
    expect(
      compareHref({
        left: { kind: "hanzi", id: "好" },
        right: { kind: "word", id: "爱好" },
      }),
    ).toBe(`/compare?${new URLSearchParams({ left: "hanzi:好", right: "word:爱好" })}`);
  });

  it("maps a ref to its canonical detail path", () => {
    expect(entryPath({ kind: "hanzi", id: "好" })).toBe("/hanzi/%E5%A5%BD");
    expect(entryPath({ kind: "word", id: "爱好" })).toBe("/words/%E7%88%B1%E5%A5%BD");
    expect(entryPath({ kind: "radical", id: "人" })).toBe("/radicals/%E4%BA%BA");
    expect(entryPath({ kind: "phonetic", id: "马" })).toBe("/phonetic/%E9%A9%AC");
    expect(entryPath({ kind: "topic", id: "travel" })).toBe("/topics/travel");
  });

  it("swaps and clears sides without dropping unrelated params", () => {
    const params = new URLSearchParams("left=hanzi:好&right=word:爱好&x=1");
    const swapped = swapCompareSearch(params);
    expect(swapped.get("left")).toBe("word:爱好");
    expect(swapped.get("right")).toBe("hanzi:好");
    expect(swapped.get("x")).toBe("1");

    const cleared = setCompareSide(params, "right", null);
    expect(cleared.get("left")).toBe("hanzi:好");
    expect(cleared.get("right")).toBeNull();
    expect(cleared.get("x")).toBe("1");
    expect(compareSearchHref(cleared)).toBe(`/compare?${cleared.toString()}`);

    const bothGone = setCompareSide(setCompareSide(params, "left", null), "right", null);
    expect(compareSearchHref(bothGone)).toBe(`/compare?${bothGone.toString()}`);
  });
});
