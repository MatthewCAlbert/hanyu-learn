import { describe, expect, it } from "vitest";
import radicals from "~/data/generated/radicals.json";
import { matchRadical } from "~/lib/radicals";
import type { Radical } from "~/lib/types";

const R = radicals as unknown as Radical[];

describe("exact radical-form resolver", () => {
  it("maps canonical and variant forms, not merely indexed characters", () => {
    expect(matchRadical("示", R)?.number).toBe(113);
    expect(matchRadical("礻", R)?.number).toBe(113);
    expect(matchRadical("礻", R)?.canonical).toBe("示");
    expect(matchRadical("氵", R)?.number).toBe(85);
    expect(matchRadical("氵", R)?.canonical).toBe("水");
  });

  it("does not treat a character indexed under a radical as the radical itself", () => {
    expect(matchRadical("申", R)).toBeUndefined();
  });
});
