import { describe, expect, it } from "vitest";
import { emptyUsage, finalizeUsage, uncachedPromptTokens, usageExplanation } from "~/lib/ai/usage";

describe("cache accounting", () => {
  it("does not double-count cached and cache-write tokens", () => {
    expect(
      uncachedPromptTokens({ promptTokens: 1000, cachedTokens: 800, cacheWriteTokens: 50 }),
    ).toBe(150);
  });

  it("floors uncached at zero", () => {
    expect(uncachedPromptTokens({ promptTokens: 10, cachedTokens: 8, cacheWriteTokens: 8 })).toBe(0);
  });

  it("explains reads vs writes", () => {
    const usage = finalizeUsage({
      ...emptyUsage(),
      promptTokens: 1000,
      cachedTokens: 800,
      cacheWriteTokens: 50,
      completionTokens: 20,
      totalTokens: 1020,
      cost: 0.002,
    });
    expect(usage.uncachedTokens).toBe(150);
    expect(usageExplanation(usage)).toMatch(/cache reads/);
    expect(usageExplanation(usage)).toMatch(/cache writes/);
    expect(usageExplanation(usage)).toMatch(/\$0\.002/);
  });
});
