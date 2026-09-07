import type { TurnUsage } from "./types";

/**
 * OpenRouter reports `prompt` as the full input. Cached and cache-write
 * tokens are subsets of that total, not extra. Uncached is what remains
 * billed at the ordinary input rate.
 */
export function uncachedPromptTokens(usage: {
  promptTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
}): number {
  return Math.max(0, usage.promptTokens - usage.cachedTokens - usage.cacheWriteTokens);
}

export function emptyUsage(): TurnUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    uncachedTokens: 0,
    reasoningTokens: 0,
    cost: null,
    webSearchRequests: 0,
    modelCalls: 0,
  };
}

export function finalizeUsage(partial: Omit<TurnUsage, "uncachedTokens">): TurnUsage {
  return {
    ...partial,
    uncachedTokens: uncachedPromptTokens(partial),
  };
}

export function formatUsd(cost: number | null): string {
  if (cost == null) return "—";
  if (cost === 0) return "$0";
  if (cost < 0.0001) return `$${cost.toExponential(1)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

/** Human explanation of cache read/write vs ordinary input. */
export function usageExplanation(usage: TurnUsage): string {
  const cost = usage.cost != null ? ` Billed ${formatUsd(usage.cost)}.` : "";
  const search =
    usage.webSearchRequests > 0
      ? ` ${usage.webSearchRequests} web search${usage.webSearchRequests === 1 ? "" : "es"}.`
      : "";
  if (usage.cachedTokens === 0 && usage.cacheWriteTokens === 0) {
    return `${usage.promptTokens} input + ${usage.completionTokens} output tokens.${cost}${search}`;
  }
  return (
    `${usage.promptTokens} input tokens: ${usage.uncachedTokens} uncached, ` +
    `${usage.cachedTokens} cache reads (cheaper reuse of a stored prefix), ` +
    `${usage.cacheWriteTokens} cache writes (creating/refreshing that prefix, sometimes above the ordinary input rate). ` +
    `${usage.completionTokens} output tokens.${cost}${search}`
  );
}

export function mergeUsage(a: TurnUsage, b: TurnUsage): TurnUsage {
  return finalizeUsage({
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    cachedTokens: a.cachedTokens + b.cachedTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens,
    cost: a.cost == null && b.cost == null ? null : (a.cost ?? 0) + (b.cost ?? 0),
    webSearchRequests: a.webSearchRequests + b.webSearchRequests,
    modelCalls: a.modelCalls + b.modelCalls,
  });
}
