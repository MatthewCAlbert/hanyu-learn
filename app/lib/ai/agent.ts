import { OpenRouter } from "@openrouter/agent";
import type { BeforeCreateRequestHook, BeforeRequestHook, Item } from "@openrouter/agent";
import { maxCost, maxTokensUsed, stepCountIs } from "@openrouter/agent/stop-conditions";
import { formatUserTurn } from "./context";
import { isAbortError, normalizeAgentError } from "./errors";
import { SYSTEM_INSTRUCTIONS } from "./instructions";
import { agentTools } from "./tools";
import type { ChatMessage, Citation, OpenRouterConfig, ToolActivity, TurnUsage } from "./types";
import { emptyUsage, finalizeUsage } from "./usage";

const APP_TITLE = "Hanyu Learn";

/** The Agent SDK tags browser fetches with this header; OpenRouter CORS rejects it. */
export const CALL_MODEL_HEADER = "x-openrouter-callmodel";

export const dropCallModelHeader: BeforeCreateRequestHook & BeforeRequestHook = {
  beforeCreateRequest(_ctx, input) {
    const headers = new Headers(input.options?.headers);
    if (!headers.has(CALL_MODEL_HEADER)) return input;
    headers.delete(CALL_MODEL_HEADER);
    return { ...input, options: { ...input.options, headers } };
  },
  beforeRequest(_ctx, request) {
    if (!request.headers.has(CALL_MODEL_HEADER)) return request;
    const headers = new Headers(request.headers);
    headers.delete(CALL_MODEL_HEADER);
    return new Request(request, { headers });
  },
};

export const AGENT_LIMITS = {
  maxSteps: 6,
  maxCostUsd: 0.75,
  maxTokens: 48_000,
} as const;

export interface AgentRunInput {
  config: OpenRouterConfig;
  sessionId: string;
  messages: ChatMessage[];
  signal: AbortSignal;
  onText: (full: string) => void;
  onTools: (tools: ToolActivity[]) => void;
  onCitations: (citations: Citation[]) => void;
}

export interface AgentRunResult {
  content: string;
  tools: ToolActivity[];
  citations: Citation[];
  usage: TurnUsage;
}

function siteUrl(): string {
  if (typeof location !== "undefined" && location.origin) return location.origin;
  return "http://localhost:5173";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function collectUrls(value: unknown, into: Citation[], seen: Set<string>): void {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, into, seen);
    return;
  }
  const rec = asRecord(value);
  if (!rec) return;
  const url = typeof rec.url === "string" ? rec.url : null;
  if (url?.startsWith("http") && !seen.has(url)) {
    seen.add(url);
    into.push({
      url,
      title: typeof rec.title === "string" ? rec.title : typeof rec.query === "string" ? rec.query : undefined,
    });
  }
  for (const nested of [rec.action, rec.sources, rec.results, rec.citations, rec.output]) {
    collectUrls(nested, into, seen);
  }
}

function toolNameOf(item: Record<string, unknown>): string {
  if (typeof item.name === "string") return item.name;
  if (typeof item.type === "string") return item.type;
  return "tool";
}

function toolIdOf(item: Record<string, unknown>, fallback: string): string {
  if (typeof item.id === "string") return item.id;
  if (typeof item.callId === "string") return item.callId;
  if (typeof item.toolCallId === "string") return item.toolCallId;
  return fallback;
}

function previewOf(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 280);
  try {
    return JSON.stringify(value).slice(0, 280);
  } catch {
    return "";
  }
}

function upsertTool(list: ToolActivity[], next: ToolActivity): ToolActivity[] {
  const i = list.findIndex((t) => t.id === next.id);
  if (i < 0) return [...list, next];
  const copy = list.slice();
  copy[i] = { ...copy[i], ...next };
  return copy;
}

export function historyToInput(messages: ChatMessage[]): Item[] {
  const out: Item[] = [];
  for (const m of messages) {
    if (m.error && !m.content) continue;
    const content =
      m.role === "user" && m.pageContextText
        ? formatUserTurn(m.content, {
            key: m.pageContextKey ?? "",
            route: "",
            title: "",
            kind: "hanzi",
            text: m.pageContextText,
          })
        : m.content;
    if (!content) continue;
    if (m.role === "user") {
      out.push({ role: "user", content });
    } else {
      out.push({
        type: "message",
        role: "assistant",
        id: m.id,
        status: "completed",
        phase: "final_answer",
        content: [{ type: "output_text", text: content }],
      });
    }
  }
  return out;
}

export function usageFromUnknown(raw: unknown): TurnUsage {
  const rec = asRecord(raw);
  if (!rec) return emptyUsage();
  const details = asRecord(rec.inputTokensDetails) ?? asRecord(rec.prompt_tokens_details);
  const outDetails = asRecord(rec.outputTokensDetails) ?? asRecord(rec.completion_tokens_details);
  const server = asRecord(rec.serverToolUseDetails) ?? asRecord(rec.server_tool_use);
  const promptTokens =
    num(rec.inputTokens) ?? num(rec.prompt_tokens) ?? num(rec.promptTokens) ?? 0;
  const completionTokens =
    num(rec.outputTokens) ?? num(rec.completion_tokens) ?? num(rec.completionTokens) ?? 0;
  const cachedTokens =
    num(details?.cachedTokens) ?? num(details?.cached_tokens) ?? num(rec.cachedTokens) ?? 0;
  const cacheWriteTokens =
    num(details?.cacheWriteTokens) ?? num(details?.cache_write_tokens) ?? num(rec.cacheWriteTokens) ?? 0;
  const reasoningTokens =
    num(outDetails?.reasoningTokens) ?? num(outDetails?.reasoning_tokens) ?? num(rec.reasoningTokens) ?? 0;
  const cost = num(rec.cost);
  const webSearchRequests =
    num(server?.webSearchRequests) ?? num(server?.web_search_requests) ?? 0;
  const modelCalls = num(rec.modelCalls) ?? 1;
  return finalizeUsage({
    promptTokens,
    completionTokens,
    totalTokens: num(rec.totalTokens) ?? num(rec.total_tokens) ?? promptTokens + completionTokens,
    cachedTokens,
    cacheWriteTokens,
    reasoningTokens,
    cost,
    webSearchRequests,
    modelCalls,
  });
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const client = new OpenRouter({
    apiKey: input.config.apiKey,
    httpReferer: siteUrl(),
    appTitle: APP_TITLE,
    hooks: dropCallModelHeader,
  });

  const history = historyToInput(input.messages);
  const result = client.callModel({
    model: input.config.modelName,
    instructions: SYSTEM_INSTRUCTIONS,
    input: history,
    tools: agentTools,
    sessionId: input.sessionId,
    promptCacheKey: input.sessionId,
    cacheControl: { type: "ephemeral" },
    stopWhen: [
      stepCountIs(AGENT_LIMITS.maxSteps),
      maxCost(AGENT_LIMITS.maxCostUsd),
      maxTokensUsed(AGENT_LIMITS.maxTokens),
    ],
    allowFinalResponse: true,
    signal: input.signal,
  });

  let content = "";
  let tools: ToolActivity[] = [];
  let citations: Citation[] = [];
  const seenUrls = new Set<string>();

  const pumpText = (async () => {
    for await (const delta of result.getTextStream()) {
      if (!delta) continue;
      content += delta;
      input.onText(content);
    }
  })();

  const pumpItems = (async () => {
    for await (const item of result.getItemsStream()) {
      const rec = asRecord(item);
      if (!rec) continue;
      const type = typeof rec.type === "string" ? rec.type : "";
      collectUrls(rec, citations, seenUrls);
      if (citations.length) input.onCitations(citations);

      if (type === "function_call" || type.endsWith("_call") || type === "openrouter:web_search") {
        const id = toolIdOf(rec, `${type}-${tools.length}`);
        const args = rec.arguments ?? rec.action ?? rec.params;
        tools = upsertTool(tools, {
          id,
          name: toolNameOf(rec),
          status: rec.status === "completed" || rec.status === "complete" ? "done" : "running",
          args,
          resultPreview: previewOf(args),
        });
        input.onTools(tools);
      } else if (type === "function_call_output") {
        const id = toolIdOf(rec, `${tools.length}`);
        tools = upsertTool(tools, {
          id,
          name: toolNameOf(rec),
          status: "done",
          resultPreview: previewOf(rec.output ?? rec.result ?? rec.content),
        });
        input.onTools(tools);
      }
    }
  })();

  try {
    await Promise.all([pumpText, pumpItems, result.getText()]);
  } catch (err) {
    if (isAbortError(err) || input.signal.aborted) {
      return { content, tools, citations, usage: emptyUsage() };
    }
    throw new Error(normalizeAgentError(err));
  }

  let usage = emptyUsage();
  try {
    const totals = await result.getUsage();
    usage = usageFromUnknown(totals);
  } catch {
    /* still try the final response */
  }
  try {
    const response = await result.getResponse();
    const fromResponse = usageFromUnknown(
      (response as { usage?: unknown }).usage ?? response,
    );
    usage = finalizeUsage({
      promptTokens: Math.max(usage.promptTokens, fromResponse.promptTokens),
      completionTokens: Math.max(usage.completionTokens, fromResponse.completionTokens),
      totalTokens: Math.max(usage.totalTokens, fromResponse.totalTokens),
      cachedTokens: Math.max(usage.cachedTokens, fromResponse.cachedTokens),
      cacheWriteTokens: Math.max(usage.cacheWriteTokens, fromResponse.cacheWriteTokens),
      reasoningTokens: Math.max(usage.reasoningTokens, fromResponse.reasoningTokens),
      cost: usage.cost ?? fromResponse.cost,
      webSearchRequests: Math.max(usage.webSearchRequests, fromResponse.webSearchRequests),
      modelCalls: Math.max(usage.modelCalls, fromResponse.modelCalls, 1),
    });
    collectUrls(response, citations, seenUrls);
  } catch {
    /* usage is optional */
  }

  if (!content && !input.signal.aborted) {
    try {
      content = (await result.getText()) || content;
      input.onText(content);
    } catch {
      /* ignore */
    }
  }

  return { content, tools, citations, usage };
}
