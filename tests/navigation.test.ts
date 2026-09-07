import { describe, expect, it } from "vitest";
import { DEFAULT_BANDS_PATH, defaultBrowsePath } from "~/lib/levels";
import {
  browseLabel,
  canHistoryBack,
  defaultBrowseFallback,
  parseBrowseHref,
  readBrowseOrigin,
  resolveBrowseOrigin,
} from "~/lib/navigation";

describe("browse origin", () => {
  it("accepts a real /hsk/:bands/:tab URL including filters", () => {
    const parsed = parseBrowseHref("/hsk/1,2,extra/hanzi?q=好&topic=people");
    expect(parsed).toMatchObject({
      pathname: "/hsk/1,2,extra/hanzi",
      search: "?q=%E5%A5%BD&topic=people",
      tab: "hanzi",
      bands: { levels: [1, 2], extra: true },
    });
  });

  it("rejects open redirects and non-browse paths", () => {
    for (const bad of [
      "https://evil.example/hsk/1/hanzi",
      "//evil.example/hsk/1/hanzi",
      "javascript:alert(1)",
      "/settings",
      "/hanzi/好",
      "/hsk/8/hanzi",
      "/hsk/extra,1/hanzi",
      "/hsk/1/hanzi/extra",
      "/hsk/1",
    ]) {
      expect(parseBrowseHref(bad)).toBeNull();
      expect(readBrowseOrigin({ from: bad })).toBeUndefined();
    }
  });

  it("ignores non-object or extra state keys", () => {
    expect(readBrowseOrigin(null)).toBeUndefined();
    expect(readBrowseOrigin(" /hsk/1/hanzi")).toBeUndefined();
    expect(readBrowseOrigin({ from: 1 })).toBeUndefined();
    expect(readBrowseOrigin({ from: "/hsk/1/hanzi", extra: "https://evil.example" })?.from).toBe(
      "/hsk/1/hanzi",
    );
  });

  it("resolves validated origin over the route fallback", () => {
    const fallback = { to: "/hsk/1/hanzi", label: "HSK 1 Hanzi" };
    expect(resolveBrowseOrigin(undefined, fallback)).toEqual(fallback);
    expect(resolveBrowseOrigin({ from: "/hsk/3/words?q=hao" }, fallback)).toEqual({
      to: "/hsk/3/words?q=hao",
      label: "HSK 3 · Words (filtered)",
    });
  });

  it("labels the default browse destination", () => {
    expect(browseLabel(defaultBrowsePath())).toBe("All levels + Extra · Hanzi");
    expect(defaultBrowseFallback("radicals")).toEqual({
      to: `/hsk/${DEFAULT_BANDS_PATH}/radicals`,
      label: "All levels + Extra · Radicals",
    });
  });

  it("only uses history Back after an in-app navigation", () => {
    expect(canHistoryBack("default")).toBe(false);
    expect(canHistoryBack("abc123")).toBe(true);
  });
});
