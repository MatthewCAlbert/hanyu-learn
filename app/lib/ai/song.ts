import { OpenRouter } from "@openrouter/agent";
import { serverTool, tool } from "@openrouter/agent/tool";
import { maxCost, maxTokensUsed, stepCountIs } from "@openrouter/agent/stop-conditions";
import {
  AGENT_LIMITS,
  dropCallModelHeader,
  mergeLiveText,
  textFromItem,
  usageFromUnknown,
} from "./agent";
import { samplingFromConfig } from "./config";
import { isAbortError, normalizeAgentError } from "./errors";
import { lookupHanzi, lookupWord, searchCorpus, SONG_WEB_SEARCH_PARAMS } from "./tools";
import { emptyUsage, finalizeUsage } from "./usage";
import type { Citation, OpenRouterConfig, ToolActivity, TurnUsage } from "./types";
import {
  bindSongImport,
  submitSongCandidatesInput,
  submitSongImportInput,
  type BoundSong,
  type SongCandidate,
  type SubmitSongCandidatesInput,
  type SubmitSongImportInput,
} from "~/lib/song";
import type { Lexicon } from "~/lib/segment";

const APP_TITLE = "Hanyu Learn";

export { SONG_WEB_SEARCH_PARAMS };

export const SONG_RATE_LIMIT_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 750,
  maxDelayMs: 3_000,
} as const;

export function isProviderRateLimitError(err: unknown): boolean {
  const seen = new Set<object>();

  const visit = (value: unknown, depth: number): boolean => {
    if (depth > 5 || value == null) return false;
    if (typeof value === "string") return /(?:^|\D)429(?:\D|$)|rate.?limit/i.test(value);
    if (typeof value !== "object") return false;
    if (seen.has(value)) return false;
    seen.add(value);

    const rec = value as Record<string, unknown>;
    if (rec.code === 429 || rec.code === "429" || rec.status === 429 || rec.statusCode === 429) {
      return true;
    }
    if (typeof rec.message === "string" && visit(rec.message, depth + 1)) return true;
    return [rec.cause, rec.error, rec.metadata, rec.response, rec.body].some((nested) =>
      visit(nested, depth + 1),
    );
  };

  return visit(err, 0);
}

export function songRetryDelayMs(retryIndex: number, random = Math.random): number {
  const exponential = Math.min(
    SONG_RATE_LIMIT_RETRY.maxDelayMs,
    SONG_RATE_LIMIT_RETRY.baseDelayMs * 2 ** Math.max(0, retryIndex),
  );
  const jitter = 0.75 + random() * 0.5;
  return Math.round(exponential * jitter);
}

export function waitForSongRetry(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("The user aborted a request.", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("The user aborted a request.", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export const SONG_CANDIDATE_INSTRUCTIONS = `You find Chinese songs for Hanyu Learn, a personal Mandarin reference.

The user will give a title, artist, pinyin, Hanzi, or lyric fragment. Use web_search to identify matching recordings. Call submit_song_candidates exactly once.

Rules:
- Return at most three distinct title + artist matches that the search evidence supports. Prefer official Chinese titles (Hanzi).
- Include titlePinyin for every candidate, using lowercase Hanyu Pinyin with tone marks.
- Include album and year only when search results state them.
- Include youtubeUrl only when search found a YouTube watch, youtu.be, Shorts, or embed URL for that recording. Do not invent URLs.
- reason is a short evidence note (who/what matched).
- If nothing matches, return an empty candidates array. Do not invent songs.
- Do not return lyrics. This run is identity only.
- You may call search_corpus, lookup_hanzi, or lookup_word if a title is also an HSK word. Prefer the corpus when it fits.
- The submit_song_candidates payload is the result; do not rely on a prose answer.`;

export const SONG_IMPORT_INSTRUCTIONS = `You import Chinese song lyrics for Hanyu Learn, a personal Mandarin reference.

The user has already chosen one title and artist. Use web_search to find a cited lyrics page for that recording, plus a YouTube URL if available. Call submit_song_import exactly once.

Rules:
- chinese must be the exact lyric line from the cited source. Preserve repeated choruses and visual line order. Do not collapse a repeating chorus into a comment.
- translation is natural English for that line.
- sections use verse, chorus, bridge, intro, outro, or other. Repeat chorus sections rather than writing "chorus repeats".
- lyricsSourceUrl must be the http(s) page you used. Do not invent URLs.
- youtubeUrl only if search found a YouTube watch, youtu.be, Shorts, or embed URL for this recording.
- If the source is incomplete, paywalled, or missing, set complete=false, explain in warning, and include only lines the source actually contains. Do not fabricate lyrics.
- If no lyrics are available, set complete=false, put the reason in warning, and use sections=[]. Still cite the page you checked as lyricsSourceUrl.
- You may call search_corpus, lookup_hanzi, or lookup_word for sense checks. Prefer this app's corpus senses when they fit.
- The submit_song_import payload is the result; do not rely on a prose answer.`;

const songWebSearch = serverTool({
  type: "openrouter:web_search",
  parameters: SONG_WEB_SEARCH_PARAMS,
});

const submitSongCandidates = tool({
  name: "submit_song_candidates",
  description:
    "Submit up to three evidence-backed title, tone-marked title pinyin, and artist matches. Call once. Do not include lyrics.",
  inputSchema: submitSongCandidatesInput,
  execute: async (input) => ({ ok: true as const, ...input }),
});

const submitSongImport = tool({
  name: "submit_song_import",
  description:
    "Submit cited lyrics and metadata for the selected song. Call once. Do not invent lines the source does not contain.",
  inputSchema: submitSongImportInput,
  execute: async (input) => ({ ok: true as const, ...input }),
});

const candidateTools = [searchCorpus, lookupHanzi, lookupWord, songWebSearch, submitSongCandidates] as const;
const importTools = [searchCorpus, lookupHanzi, lookupWord, songWebSearch, submitSongImport] as const;

function siteUrl(): string {
  if (typeof location !== "undefined" && location.origin) return location.origin;
  return "http://localhost:5173";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
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
      title: typeof rec.title === "string" ? rec.title : undefined,
    });
  }
  for (const nested of [rec.action, rec.sources, rec.results, rec.citations, rec.output]) {
    collectUrls(nested, into, seen);
  }
}

function unwrapPayload(raw: unknown): unknown {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return raw;
    }
  }
  const rec = asRecord(value);
  if (!rec) return value;
  if ("candidates" in rec || "sections" in rec || "lyricsSourceUrl" in rec) return rec;
  if ("output" in rec) return unwrapPayload(rec.output);
  if ("result" in rec) return unwrapPayload(rec.result);
  if (typeof rec.text === "string") return unwrapPayload(rec.text);
  return value;
}

export function parseSubmitSongCandidates(raw: unknown): SubmitSongCandidatesInput | null {
  const parsed = submitSongCandidatesInput.safeParse(unwrapPayload(raw));
  return parsed.success ? parsed.data : null;
}

export function parseSubmitSongImport(raw: unknown): SubmitSongImportInput | null {
  const parsed = submitSongImportInput.safeParse(unwrapPayload(raw));
  return parsed.success ? parsed.data : null;
}

function extractNamedPayload<T>(
  events: { name: string; args?: unknown; resultPreview?: string }[],
  name: string,
  parse: (raw: unknown) => T | null,
): T | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (!event || event.name !== name) continue;
    const fromArgs = parse(event.args);
    if (fromArgs) return fromArgs;
    if (event.resultPreview) {
      const fromPreview = parse(event.resultPreview);
      if (fromPreview) return fromPreview;
    }
  }
  return null;
}

export function extractSongCandidatesPayload(
  events: { name: string; args?: unknown; resultPreview?: string }[],
): SubmitSongCandidatesInput | null {
  return extractNamedPayload(events, "submit_song_candidates", parseSubmitSongCandidates);
}

export function extractSongImportPayload(
  events: { name: string; args?: unknown; resultPreview?: string }[],
): SubmitSongImportInput | null {
  return extractNamedPayload(events, "submit_song_import", parseSubmitSongImport);
}

export function failSong(err: unknown): { reason: "stopped" | "error"; message: string } {
  if (isAbortError(err)) return { reason: "stopped", message: "Stopped." };
  return { reason: "error", message: normalizeAgentError(err) };
}

function candidatePrompt(query: string): string {
  return [
    "Find Chinese songs matching this query. Call submit_song_candidates once with at most three evidence-backed matches. Do not include lyrics.",
    "",
    `Query: ${query}`,
  ].join("\n");
}

function importPrompt(candidate: SongCandidate, query: string): string {
  const lines = [
    "Import the selected Chinese song. Search for a cited lyrics source and a YouTube URL. Call submit_song_import once.",
    "",
    `Title: ${candidate.title}`,
    `Artist: ${candidate.artist}`,
  ];
  if (candidate.album) lines.push(`Album: ${candidate.album}`);
  if (candidate.year) lines.push(`Year: ${candidate.year}`);
  if (candidate.youtubeUrl) lines.push(`YouTube candidate: ${candidate.youtubeUrl}`);
  if (query) lines.push(`Original query: ${query}`);
  return lines.join("\n");
}

interface SongCallSpec {
  config: OpenRouterConfig;
  sessionId: string;
  signal: AbortSignal;
  onTools?: (tools: ToolActivity[]) => void;
  onText?: (full: string) => void;
  instructions: string;
  input: string;
  tools: typeof candidateTools | typeof importTools;
  payloadName: string;
  parsePayload: (raw: unknown) => unknown;
  missingMessage: string;
}

async function executeSongCallOnce(spec: SongCallSpec): Promise<{
  payload: unknown;
  tools: ToolActivity[];
  citations: Citation[];
  usage: TurnUsage;
}> {
  const client = new OpenRouter({
    apiKey: spec.config.apiKey,
    httpReferer: siteUrl(),
    appTitle: APP_TITLE,
    hooks: dropCallModelHeader,
  });
  const sampling = samplingFromConfig(spec.config);
  const result = client.callModel({
    model: spec.config.modelName,
    instructions: spec.instructions,
    input: spec.input,
    tools: spec.tools,
    sessionId: spec.sessionId,
    promptCacheKey: spec.sessionId,
    cacheControl: { type: "ephemeral" },
    reasoning: sampling.reasoning,
    text: sampling.text,
    stopWhen: [
      stepCountIs(AGENT_LIMITS.maxSteps),
      maxCost(AGENT_LIMITS.maxCostUsd),
      maxTokensUsed(AGENT_LIMITS.maxTokens),
    ],
    allowFinalResponse: true,
    signal: spec.signal,
  });

  let tools: ToolActivity[] = [];
  const citations: Citation[] = [];
  const seenUrls = new Set<string>();
  let streamed = "";
  const nameById = new Map<string, string>();
  let parsed: unknown = null;

  const publishTools = (next: ToolActivity[]) => {
    tools = next;
    spec.onTools?.(tools);
  };

  const pumpText = (async () => {
    for await (const delta of result.getTextStream()) {
      if (!delta) continue;
      streamed = mergeLiveText(streamed, delta);
      spec.onText?.(streamed);
    }
  })();

  const pumpItems = (async () => {
    for await (const item of result.getItemsStream()) {
      const rec = asRecord(item);
      if (!rec) continue;
      const type = typeof rec.type === "string" ? rec.type : "";
      collectUrls(rec, citations, seenUrls);

      if (type === "message") {
        const text = textFromItem(rec);
        if (text) {
          streamed = mergeLiveText(streamed, text);
          spec.onText?.(streamed);
        }
      } else if (
        type === "function_call" ||
        type.endsWith("_call") ||
        type === "openrouter:web_search"
      ) {
        const id = toolIdOf(rec, `${type}-${tools.length}`);
        const name = toolNameOf(rec);
        nameById.set(id, name);
        const args = rec.arguments ?? rec.action ?? rec.params;
        if (name === spec.payloadName) {
          parsed = spec.parsePayload(args) ?? parsed;
        }
        publishTools(
          upsertTool(tools, {
            id,
            name,
            status: rec.status === "completed" || rec.status === "complete" ? "done" : "running",
            args,
            resultPreview: previewOf(args),
          }),
        );
      } else if (type === "function_call_output") {
        const id = toolIdOf(rec, `${tools.length}`);
        const name = nameById.get(id) ?? toolNameOf(rec);
        const output = rec.output ?? rec.result ?? rec.content;
        if (name === spec.payloadName) {
          parsed = spec.parsePayload(output) ?? parsed;
        }
        publishTools(
          upsertTool(tools, {
            id,
            name,
            status: "done",
            resultPreview: previewOf(output),
          }),
        );
      }
    }
  })();

  try {
    await Promise.all([pumpText, pumpItems, result.getText()]);
  } catch (err) {
    if (isAbortError(err) || spec.signal.aborted) {
      throw new DOMException("The user aborted a request.", "AbortError");
    }
    throw err;
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
    const fromResponse = usageFromUnknown((response as { usage?: unknown }).usage ?? response);
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

  const fromTools = extractNamedPayload(tools, spec.payloadName, spec.parsePayload);
  const payload = parsed ?? fromTools;
  if (!payload) {
    throw new Error(spec.missingMessage);
  }
  return { payload, tools, citations, usage };
}

async function executeSongCall(spec: SongCallSpec): Promise<{
  payload: unknown;
  tools: ToolActivity[];
  citations: Citation[];
  usage: TurnUsage;
}> {
  for (let attempt = 0; attempt < SONG_RATE_LIMIT_RETRY.maxAttempts; attempt++) {
    try {
      return await executeSongCallOnce(spec);
    } catch (err) {
      if (isAbortError(err) || spec.signal.aborted) {
        throw new DOMException("The user aborted a request.", "AbortError");
      }
      const finalAttempt = attempt + 1 >= SONG_RATE_LIMIT_RETRY.maxAttempts;
      if (!isProviderRateLimitError(err) || finalAttempt) {
        throw new Error(normalizeAgentError(err));
      }

      const delayMs = songRetryDelayMs(attempt);
      spec.onTools?.([
        {
          id: `provider-retry-${attempt + 1}`,
          name: "provider_retry",
          status: "running",
          resultPreview: `Rate limited · retrying in ${(delayMs / 1_000).toFixed(1)}s`,
        },
      ]);
      spec.onText?.("");
      await waitForSongRetry(delayMs, spec.signal);
    }
  }
  throw new Error("Song request failed after retrying.");
}

export interface SongCandidateRunInput {
  config: OpenRouterConfig;
  sessionId: string;
  query: string;
  signal: AbortSignal;
  onTools?: (tools: ToolActivity[]) => void;
  onText?: (full: string) => void;
}

export interface SongCandidateRunResult {
  payload: SubmitSongCandidatesInput;
  candidates: SongCandidate[];
  tools: ToolActivity[];
  citations: Citation[];
  usage: TurnUsage;
}

export async function runSongCandidateAgent(
  input: SongCandidateRunInput,
): Promise<SongCandidateRunResult> {
  const call = await executeSongCall({
    config: input.config,
    sessionId: input.sessionId,
    signal: input.signal,
    onTools: input.onTools,
    onText: input.onText,
    instructions: SONG_CANDIDATE_INSTRUCTIONS,
    input: candidatePrompt(input.query),
    tools: candidateTools,
    payloadName: "submit_song_candidates",
    parsePayload: parseSubmitSongCandidates,
    missingMessage: "The model did not submit song matches. Try again.",
  });
  const payload = call.payload as SubmitSongCandidatesInput;
  return {
    payload,
    candidates: payload.candidates,
    tools: call.tools,
    citations: call.citations,
    usage: call.usage,
  };
}

export interface SongImportRunInput {
  config: OpenRouterConfig;
  sessionId: string;
  query: string;
  candidate: SongCandidate;
  lexicon: Lexicon;
  signal: AbortSignal;
  onTools?: (tools: ToolActivity[]) => void;
  onText?: (full: string) => void;
}

export interface SongImportRunResult {
  payload: SubmitSongImportInput;
  song: BoundSong;
  tools: ToolActivity[];
  citations: Citation[];
  usage: TurnUsage;
}

export async function runSongImportAgent(input: SongImportRunInput): Promise<SongImportRunResult> {
  const call = await executeSongCall({
    config: input.config,
    sessionId: input.sessionId,
    signal: input.signal,
    onTools: input.onTools,
    onText: input.onText,
    instructions: SONG_IMPORT_INSTRUCTIONS,
    input: importPrompt(input.candidate, input.query),
    tools: importTools,
    payloadName: "submit_song_import",
    parsePayload: parseSubmitSongImport,
    missingMessage: "The model did not submit a song import. Try again.",
  });
  const payload = call.payload as SubmitSongImportInput;
  const bound = bindSongImport(payload, input.lexicon, call.citations);
  if (!bound.ok) throw new Error(bound.error);
  return {
    payload,
    song: bound.song,
    tools: call.tools,
    citations: bound.song.citations,
    usage: call.usage,
  };
}
