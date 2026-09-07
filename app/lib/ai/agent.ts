import { OpenRouter } from "@openrouter/agent";
import type { BeforeCreateRequestHook, BeforeRequestHook, Item } from "@openrouter/agent";
import { maxCost, maxTokensUsed, stepCountIs } from "@openrouter/agent/stop-conditions";
import { formatUserTurn } from "./context";
import { samplingFromConfig } from "./config";
import { isAbortError, normalizeAgentError } from "./errors";
import { SYSTEM_INSTRUCTIONS } from "./instructions";
import { agentTools } from "./tools";
import type { ChatMessage, Citation, OpenRouterConfig, ToolActivity, TurnUsage } from "./types";
import { emptyUsage, finalizeUsage } from "./usage";

const APP_TITLE = "Hanyu Learn";

/** The Agent SDK tags browser fetches with this header; OpenRouter CORS rejects it. */
export const CALL_MODEL_HEADER = "x-openrouter-callmodel";

const STREAM_ACCEPT = "text/event-stream";

function isResponsesUrl(url: URL | string): boolean {
  const path = typeof url === "string" ? url : url.pathname;
  return path.includes("/responses");
}

/** Force SSE on the Responses API body. CallModelInput omits `stream`. */
export function withStreamFlag(body: string): string {
  try {
    const json = JSON.parse(body) as unknown;
    if (!json || typeof json !== "object" || Array.isArray(json)) return body;
    const rec = json as Record<string, unknown>;
    if (rec.stream === true) return body;
    return JSON.stringify({ ...rec, stream: true });
  } catch {
    return body;
  }
}

function patchHeaders(headers: Headers, streaming: boolean): Headers {
  const next = new Headers(headers);
  next.delete(CALL_MODEL_HEADER);
  if (streaming) next.set("Accept", STREAM_ACCEPT);
  return next;
}

function headersChanged(before: Headers, after: Headers): boolean {
  if (before.has(CALL_MODEL_HEADER) !== after.has(CALL_MODEL_HEADER)) return true;
  return before.get("Accept") !== after.get("Accept");
}

export const dropCallModelHeader: BeforeCreateRequestHook & BeforeRequestHook = {
  beforeCreateRequest(_ctx, input) {
    const streaming = isResponsesUrl(input.url);
    const headers = patchHeaders(new Headers(input.options?.headers), streaming);
    const body = input.options?.body;
    const nextBody = streaming && typeof body === "string" ? withStreamFlag(body) : body;
    const bodyChanged = nextBody !== body;
    if (!bodyChanged && !headersChanged(new Headers(input.options?.headers), headers)) {
      return input;
    }
    return { ...input, options: { ...input.options, headers, body: nextBody } };
  },
  async beforeRequest(_ctx, request) {
    const streaming = isResponsesUrl(request.url);
    const headers = patchHeaders(request.headers, streaming);
    const rawHeaders = request.headers;
    let body: BodyInit | null | undefined;
    let bodyChanged = false;
    if (streaming && request.method !== "GET" && request.method !== "HEAD") {
      const text = await request.clone().text();
      const next = withStreamFlag(text);
      if (next !== text) {
        body = next;
        bodyChanged = true;
      }
    }
    if (!bodyChanged && !headersChanged(rawHeaders, headers)) return request;
    return new Request(request, { headers, ...(bodyChanged ? { body } : {}) });
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

export function textFromItem(item: Record<string, unknown>): string {
  const content = item.content;
  if (typeof content === "string") return content;
  if (typeof item.text === "string") return item.text;
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const part of content) {
    const rec = asRecord(part);
    if (!rec) continue;
    if (typeof rec.text === "string") out += rec.text;
  }
  return out;
}

/** Prefer the longer prefix-consistent snapshot; otherwise take the new turn. */
export function mergeLiveText(current: string, next: string): string {
  if (!next) return current;
  if (!current || next === current) return next;
  if (next.startsWith(current) || current.startsWith(next)) {
    return next.length >= current.length ? next : current;
  }
  return next;
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
  const sampling = samplingFromConfig(input.config);
  const result = client.callModel({
    model: input.config.modelName,
    instructions: SYSTEM_INSTRUCTIONS,
    input: history,
    tools: agentTools,
    sessionId: input.sessionId,
    promptCacheKey: input.sessionId,
    cacheControl: { type: "ephemeral" },
    reasoning: sampling.reasoning,
    text: sampling.text,
    stopWhen: [
      stepCountIs(AGENT_LIMITS.maxSteps),
      maxCost(AGENT_LIMITS.maxCostUsd),
      maxTokensUsed(AGENT_LIMITS.maxTokens),
    ],
    allowFinalResponse: true,
    signal: input.signal,
  });

  let content = "";
  let streamed = "";
  let tools: ToolActivity[] = [];
  let citations: Citation[] = [];
  const seenUrls = new Set<string>();

  const publishText = (next: string) => {
    const merged = mergeLiveText(content, next);
    if (merged === content) return;
    content = merged;
    input.onText(content);
  };

  const pumpText = (async () => {
    for await (const delta of result.getTextStream()) {
      if (!delta) continue;
      streamed += delta;
      publishText(streamed);
    }
  })();

  const pumpItems = (async () => {
    for await (const item of result.getItemsStream()) {
      const rec = asRecord(item);
      if (!rec) continue;
      const type = typeof rec.type === "string" ? rec.type : "";
      collectUrls(rec, citations, seenUrls);
      if (citations.length) input.onCitations(citations);

      if (type === "message") {
        const text = textFromItem(rec);
        if (text) {
          streamed = mergeLiveText(streamed, text);
          publishText(text);
        }
      } else if (type === "function_call" || type.endsWith("_call") || type === "openrouter:web_search") {
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

  if (!input.signal.aborted) {
    try {
      const finalText = await result.getText();
      if (finalText) publishText(finalText);
    } catch {
      /* ignore */
    }
  }

  return { content, tools, citations, usage };
}
