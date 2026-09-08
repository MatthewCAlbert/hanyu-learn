import { describe, expect, it } from "vitest";
import { usageFromUnknown } from "~/lib/ai/agent";
import { isAbortError, normalizeAgentError } from "~/lib/ai/errors";
import {
  lookupEntryInput,
  lookupHanziInput,
  lookupRelationsInput,
  lookupWordInput,
  searchCorpusInput,
  SONG_WEB_SEARCH_PARAMS,
  WEB_SEARCH_PARAMS,
  RELATION_LOOKUP_LIMIT,
  agentTools,
} from "~/lib/ai/tools";

describe("streamed error normalization", () => {
  it("maps abort, auth, billing, rate limit, and network failures", () => {
    expect(normalizeAgentError(new DOMException("The user aborted a request.", "AbortError"))).toBe(
      "Stopped.",
    );
    expect(normalizeAgentError(new Error("401 Unauthorized: invalid api key"))).toBe(
      "OpenRouter rejected the API key. Check it in Settings.",
    );
    expect(normalizeAgentError("402 Payment Required, no credits")).toBe(
      "OpenRouter reports insufficient credits on this key.",
    );
    expect(normalizeAgentError(new Error("429 rate limit exceeded"))).toBe(
      "OpenRouter is rate-limiting this key. Try again shortly.",
    );
    expect(normalizeAgentError(new Error("Failed to fetch"))).toBe(
      "Could not reach OpenRouter. Check the network connection.",
    );
    expect(normalizeAgentError(new Error("model overloaded"))).toBe("model overloaded");
  });

  it("detects abort errors for stop handling", () => {
    expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("The operation was aborted."))).toBe(true);
    expect(isAbortError(new Error("401"))).toBe(false);
  });
});

describe("tool argument validation", () => {
  it("rejects empty lookup ids and unknown kinds", () => {
    expect(searchCorpusInput.safeParse({ query: "" }).success).toBe(false);
    expect(searchCorpusInput.safeParse({ query: "好", kind: "hanzi" }).success).toBe(true);
    expect(lookupHanziInput.safeParse({ char: "" }).success).toBe(false);
    expect(lookupWordInput.safeParse({ word: "爱好" }).success).toBe(true);
    expect(lookupRelationsInput.safeParse({ form: "什么" }).success).toBe(true);
    expect(
      lookupRelationsInput.safeParse({ id: "what-question", kind: "register-set" }).success,
    ).toBe(true);
    expect(lookupRelationsInput.safeParse({}).success).toBe(true);
    expect(RELATION_LOOKUP_LIMIT).toBe(8);
    expect(JSON.stringify(agentTools)).toContain("lookup_relations");
    expect(lookupEntryInput.safeParse({ kind: "glyph", id: "好" }).success).toBe(false);
    expect(lookupEntryInput.safeParse({ kind: "radical", id: "女" }).success).toBe(true);
  });

  it("caps OpenRouter web search", () => {
    expect(WEB_SEARCH_PARAMS).toEqual({
      engine: "auto",
      maxResults: 5,
      maxTotalResults: 8,
      searchContextSize: "low",
    });
    expect(SONG_WEB_SEARCH_PARAMS.searchContextSize).toBe("medium");
    expect(SONG_WEB_SEARCH_PARAMS.maxResults).toBeGreaterThan(WEB_SEARCH_PARAMS.maxResults);
  });
});

describe("provider usage parsing", () => {
  it("reads OpenRouter cache and web-search fields without double-counting", () => {
    const usage = usageFromUnknown({
      prompt_tokens: 1000,
      completion_tokens: 20,
      total_tokens: 1020,
      prompt_tokens_details: { cached_tokens: 800, cache_write_tokens: 50 },
      completion_tokens_details: { reasoning_tokens: 12 },
      server_tool_use: { web_search_requests: 2 },
      cost: 0.003,
    });
    expect(usage.uncachedTokens).toBe(150);
    expect(usage.cachedTokens).toBe(800);
    expect(usage.cacheWriteTokens).toBe(50);
    expect(usage.reasoningTokens).toBe(12);
    expect(usage.webSearchRequests).toBe(2);
    expect(usage.cost).toBe(0.003);
  });
});
