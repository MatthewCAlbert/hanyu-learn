import { OpenRouter } from "@openrouter/agent";
import type { Item } from "@openrouter/agent";
import { tool } from "@openrouter/agent/tool";
import { maxCost, maxTokensUsed, stepCountIs } from "@openrouter/agent/stop-conditions";
import { z } from "zod";
import {
  AGENT_LIMITS,
  dropCallModelHeader,
  mergeLiveText,
  textFromItem,
  usageFromUnknown,
} from "./agent";
import { samplingFromConfig } from "./config";
import { isAbortError, normalizeAgentError } from "./errors";
import { lookupHanzi, lookupWord, searchCorpus } from "./tools";
import { emptyUsage, finalizeUsage } from "./usage";
import type { Citation, OpenRouterConfig, ToolActivity, TurnUsage } from "./types";
import { containsHanzi } from "~/lib/translate";
import {
  analyzeText,
  blockHasHanzi,
  sourceBlocks,
  type Lexicon,
  type TextAnalysis,
  type TextBlock,
  type TextSpan,
} from "~/lib/segment";

const APP_TITLE = "Hanyu Learn";

export const TRANSLATE_INSTRUCTIONS = `You are the translator for Hanyu Learn, a personal Mandarin reference covering HSK 3.0 hanzi and words.

The user message already contains source paragraphs with stable ids. When the source is Chinese, it also includes a local corpus breakdown and span ids.

Rules:
- Call submit_translation exactly once.
- Include every paragraph id listed in the user message. Do not invent ids.
- If a paragraph already contains Hanzi, translate it. Notes may only reference those span ids. Prefer notes for ambiguous boundaries, idioms, and spans marked unknown.
- If a paragraph has no Hanzi (pinyin, English, or mixed latin), fill \`chinese\` with the Mandarin characters for that line and \`translation\` with the learner's language. Do not put span ids on those notes — the app will segment the Chinese you return.
- Prefer this app's corpus senses when they fit. If a span is unknown, say so in a note rather than inventing a dictionary entry.
- Keep translations natural in the learner's language (usually English). Multiple paragraphs stay separate.
- You may call search_corpus, lookup_hanzi, or lookup_word before submitting. Do not use web search.
- Do not invent URLs or corpus ids. The submit_translation payload is the result; do not rely on a prose answer.`;

export const IMAGE_TRANSLATE_INSTRUCTIONS = `You are the translator for Hanyu Learn, a personal Mandarin reference covering HSK 3.0 hanzi and words.

The user message includes a photograph. Read Chinese writing in visual order: top to bottom, then left to right.

Rules:
- Call submit_image_translation exactly once.
- Return one paragraph per distinct line or block of Chinese, in reading order.
- chinese must be the characters as written. Do not romanize them. Collapse each block to a single line.
- translation is the learner's language (usually English).
- notes are optional short comments. Do not invent span ids — the app will segment the Chinese you return.
- If the image has no Chinese writing, still call the tool with one paragraph whose chinese is empty and whose translation says so.
- Prefer this app's corpus senses when they fit. You may call search_corpus, lookup_hanzi, or lookup_word before submitting. Do not use web search.
- Do not invent URLs or corpus ids. The submit_image_translation payload is the result; do not rely on a prose answer.`;

export const IMAGE_TRANSLATE_PROMPT =
  "Read the Chinese in this image in visual order. Call submit_image_translation with one paragraph per line or block.";

export const translationNoteSchema = z.object({
  spanId: z
    .string()
    .min(1)
    .optional()
    .describe("A span id from the user message, e.g. p0.s1. Omit when returning new chinese from pinyin."),
  text: z.string().min(1).describe("Short note for that span or paragraph"),
});

export const translationParagraphSchema = z.object({
  id: z.string().min(1).describe("Paragraph id from the user message, e.g. p0"),
  chinese: z
    .string()
    .min(1)
    .optional()
    .describe("Mandarin characters for this line when the source was pinyin or another language"),
  translation: z.string().min(1).describe("Natural translation of that paragraph"),
  notes: z.array(translationNoteSchema).optional(),
});

export const submitTranslationInput = z.object({
  paragraphs: z.array(translationParagraphSchema).min(1),
});

export type SubmitTranslationInput = z.infer<typeof submitTranslationInput>;

export const imageTranslationParagraphSchema = z.object({
  chinese: z.string().describe("Mandarin characters for this visual line. Empty only when none are present."),
  translation: z.string().min(1).describe("Natural translation of that line"),
  notes: z.array(z.object({ text: z.string().min(1) })).optional(),
});

export const submitImageTranslationInput = z.object({
  paragraphs: z.array(imageTranslationParagraphSchema).min(1),
});

export type SubmitImageTranslationInput = z.infer<typeof submitImageTranslationInput>;

export interface BoundNote {
  spanId?: string;
  text: string;
  span?: TextSpan;
}

export interface BoundParagraph {
  id: string;
  translation: string;
  notes: BoundNote[];
  block: TextBlock;
}

export interface BoundTranslation {
  paragraphs: BoundParagraph[];
}

export type TranslationBindResult =
  | { ok: true; result: BoundTranslation; analysis: TextAnalysis; sourceText: string }
  | { ok: false; error: string };

function rewriteSource(analysis: TextAnalysis, payload: SubmitTranslationInput): string | null {
  const byId = new Map(payload.paragraphs.map((p) => [p.id, p]));
  if (![...byId.values()].some((p) => p.chinese?.trim())) return null;
  return analysis.blocks
    .map((block) => {
      const chinese = byId.get(block.id)?.chinese?.trim().replace(/\s+/g, " ");
      return chinese || block.text;
    })
    .join("\n");
}

export function bindTranslationResult(
  analysis: TextAnalysis,
  payload: SubmitTranslationInput,
  lexicon?: Lexicon,
): TranslationBindResult {
  const needed = sourceBlocks(analysis);
  const byId = new Map(payload.paragraphs.map((p) => [p.id, p]));
  const unknownIds = payload.paragraphs.filter((p) => !analysis.blocks.some((b) => b.id === p.id));
  if (unknownIds.length > 0) {
    return { ok: false, error: `Unknown paragraph id: ${unknownIds[0]?.id ?? ""}` };
  }
  const missing = needed.filter((b) => !byId.has(b.id));
  if (missing.length > 0) {
    return { ok: false, error: `Missing translation for ${missing[0]?.id ?? "a paragraph"}` };
  }
  for (const block of needed) {
    if (blockHasHanzi(block)) continue;
    const chinese = byId.get(block.id)?.chinese?.trim().replace(/\s+/g, " ");
    if (!chinese) {
      return { ok: false, error: `Missing chinese for ${block.id}` };
    }
  }

  const rewritten = rewriteSource(analysis, payload);
  let working = analysis;
  let sourceText = analysis.blocks.map((b) => b.text).join("\n");
  if (rewritten != null) {
    if (!lexicon) return { ok: false, error: "Cannot apply chinese without a lexicon" };
    working = analyzeText(rewritten, lexicon);
    sourceText = rewritten;
  }

  const workingById = new Map(working.blocks.map((b) => [b.id, b]));
  const paragraphs: BoundParagraph[] = [];
  for (const block of needed) {
    const row = byId.get(block.id);
    if (!row) continue;
    const boundBlock = workingById.get(block.id) ?? block;
    const notes: BoundNote[] = [];
    for (const note of row.notes ?? []) {
      if (!note.spanId) {
        notes.push({ text: note.text });
        continue;
      }
      const span = boundBlock.spans.find((s) => s.id === note.spanId);
      if (!span) {
        if (rewritten != null) {
          notes.push({ text: note.text });
          continue;
        }
        return { ok: false, error: `Unknown span id: ${note.spanId}` };
      }
      notes.push({ spanId: note.spanId, text: note.text, span });
    }
    paragraphs.push({ id: block.id, translation: row.translation, notes, block: boundBlock });
  }
  return { ok: true, result: { paragraphs }, analysis: working, sourceText };
}

export function bindImageTranslation(
  payload: SubmitImageTranslationInput,
  lexicon: Lexicon,
): TranslationBindResult {
  const lines = payload.paragraphs
    .map((row) => ({
      chinese: row.chinese.trim().replace(/\s+/g, " "),
      translation: row.translation,
      notes: row.notes ?? [],
    }))
    .filter((row) => row.chinese.length > 0);
  const sourceText = lines.map((row) => row.chinese).join("\n");
  if (!containsHanzi(sourceText)) {
    return { ok: false, error: "No Chinese was found in this image." };
  }
  const analysis = analyzeText(sourceText, lexicon);
  const needed = sourceBlocks(analysis);
  if (needed.length !== lines.length) {
    return { ok: false, error: "The extracted lines could not be aligned to the translation." };
  }
  const paragraphs: BoundParagraph[] = [];
  for (let i = 0; i < needed.length; i++) {
    const block = needed[i];
    const row = lines[i];
    if (!block || !row) continue;
    paragraphs.push({
      id: block.id,
      translation: row.translation,
      notes: row.notes.map((note) => ({ text: note.text })),
      block,
    });
  }
  return { ok: true, result: { paragraphs }, analysis, sourceText };
}

export function imageTranslationInput(imageUrl: string): Item[] {
  return [
    {
      role: "user",
      content: [
        { type: "input_text", text: IMAGE_TRANSLATE_PROMPT },
        { type: "input_image", imageUrl, detail: "high" },
      ],
    },
  ];
}

export function translationPrompt(analysis: TextAnalysis): string {
  const blocks = sourceBlocks(analysis);
  const parts = [
    "Translate the following. Call submit_translation with one entry per paragraph id listed here.",
    "",
  ];
  for (const block of blocks) {
    parts.push(`Paragraph ${block.id}:`);
    parts.push(block.text);
    if (!blockHasHanzi(block)) {
      parts.push(
        "No Hanzi on this line. Treat it as pinyin or the learner's language. Return chinese (Mandarin characters) and translation.",
      );
      parts.push("");
      continue;
    }
    parts.push("Spans:");
    for (const span of block.spans) {
      if (span.kind === "punct" || span.kind === "other") continue;
      const head = span.summary
        ? `${span.kind} ${span.summary.pinyin} / ${span.summary.meaning}`
        : span.kind;
      const cands = span.candidates
        .filter((c) => !(span.ref && c.kind === span.ref.kind && c.text === span.ref.id))
        .slice(0, 8)
        .map((c) => `${c.text} (${c.kind} ${c.summary.pinyin} / ${c.summary.meaning})`)
        .join("; ");
      parts.push(`- ${span.id} 「${span.text}」 ${head}${cands ? ` · also: ${cands}` : ""}`);
    }
    parts.push("");
  }
  return parts.join("\n").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
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
  if ("paragraphs" in rec) return rec;
  if ("output" in rec) return unwrapPayload(rec.output);
  if ("result" in rec) return unwrapPayload(rec.result);
  if (typeof rec.text === "string") return unwrapPayload(rec.text);
  return value;
}

export function parseSubmitTranslation(raw: unknown): SubmitTranslationInput | null {
  const parsed = submitTranslationInput.safeParse(unwrapPayload(raw));
  return parsed.success ? parsed.data : null;
}

export function parseSubmitImageTranslation(raw: unknown): SubmitImageTranslationInput | null {
  const parsed = submitImageTranslationInput.safeParse(unwrapPayload(raw));
  return parsed.success ? parsed.data : null;
}

export function extractTranslationPayload(
  events: { name: string; args?: unknown; resultPreview?: string }[],
): SubmitTranslationInput | null {
  return extractNamedPayload(events, "submit_translation", parseSubmitTranslation);
}

export function extractImageTranslationPayload(
  events: { name: string; args?: unknown; resultPreview?: string }[],
): SubmitImageTranslationInput | null {
  return extractNamedPayload(events, "submit_image_translation", parseSubmitImageTranslation);
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

export function failTranslate(err: unknown): { reason: "stopped" | "error"; message: string } {
  if (isAbortError(err)) return { reason: "stopped", message: "Stopped." };
  return { reason: "error", message: normalizeAgentError(err) };
}

const submitTranslation = tool({
  name: "submit_translation",
  description:
    "Submit the final translation. Call once with every paragraph id from the user message. When the source has no Hanzi, include chinese for that line.",
  inputSchema: submitTranslationInput,
  execute: async (input) => ({ ok: true as const, ...input }),
});

const submitImageTranslation = tool({
  name: "submit_image_translation",
  description:
    "Submit Chinese extracted from the image plus translations. One paragraph per visual line, in reading order.",
  inputSchema: submitImageTranslationInput,
  execute: async (input) => ({ ok: true as const, ...input }),
});

const translateTools = [searchCorpus, lookupHanzi, lookupWord, submitTranslation] as const;
const imageTranslateTools = [searchCorpus, lookupHanzi, lookupWord, submitImageTranslation] as const;

function siteUrl(): string {
  if (typeof location !== "undefined" && location.origin) return location.origin;
  return "http://localhost:5173";
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

interface TranslateCallSpec {
  config: OpenRouterConfig;
  sessionId: string;
  signal: AbortSignal;
  onTools?: (tools: ToolActivity[]) => void;
  onText?: (full: string) => void;
  instructions: string;
  input: string | Item[];
  tools: typeof translateTools | typeof imageTranslateTools;
  payloadName: string;
  parsePayload: (raw: unknown) => unknown;
}

async function executeTranslateCall(spec: TranslateCallSpec): Promise<{
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
      } else if (type === "function_call" || type.endsWith("_call")) {
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
    throw new Error("The model did not submit a translation. Try again.");
  }
  return { payload, tools, citations, usage };
}

export interface TranslateRunInput {
  config: OpenRouterConfig;
  sessionId: string;
  analysis: TextAnalysis;
  lexicon: Lexicon;
  signal: AbortSignal;
  onTools?: (tools: ToolActivity[]) => void;
  onText?: (full: string) => void;
}

export interface TranslateRunResult {
  payload: SubmitTranslationInput;
  bound: BoundTranslation;
  analysis: TextAnalysis;
  sourceText: string;
  tools: ToolActivity[];
  citations: Citation[];
  usage: TurnUsage;
}

export async function runTranslateAgent(input: TranslateRunInput): Promise<TranslateRunResult> {
  const call = await executeTranslateCall({
    config: input.config,
    sessionId: input.sessionId,
    signal: input.signal,
    onTools: input.onTools,
    onText: input.onText,
    instructions: TRANSLATE_INSTRUCTIONS,
    input: translationPrompt(input.analysis),
    tools: translateTools,
    payloadName: "submit_translation",
    parsePayload: parseSubmitTranslation,
  });
  const payload = call.payload as SubmitTranslationInput;
  const bound = bindTranslationResult(input.analysis, payload, input.lexicon);
  if (!bound.ok) throw new Error(bound.error);
  return {
    payload,
    bound: bound.result,
    analysis: bound.analysis,
    sourceText: bound.sourceText,
    tools: call.tools,
    citations: call.citations,
    usage: call.usage,
  };
}

export interface TranslateImageRunInput {
  config: OpenRouterConfig;
  sessionId: string;
  imageUrl: string;
  lexicon: Lexicon;
  signal: AbortSignal;
  onTools?: (tools: ToolActivity[]) => void;
  onText?: (full: string) => void;
}

export interface TranslateImageRunResult {
  payload: SubmitImageTranslationInput;
  bound: BoundTranslation;
  analysis: TextAnalysis;
  sourceText: string;
  tools: ToolActivity[];
  citations: Citation[];
  usage: TurnUsage;
}

export async function runTranslateImageAgent(input: TranslateImageRunInput): Promise<TranslateImageRunResult> {
  const call = await executeTranslateCall({
    config: input.config,
    sessionId: input.sessionId,
    signal: input.signal,
    onTools: input.onTools,
    onText: input.onText,
    instructions: IMAGE_TRANSLATE_INSTRUCTIONS,
    input: imageTranslationInput(input.imageUrl),
    tools: imageTranslateTools,
    payloadName: "submit_image_translation",
    parsePayload: parseSubmitImageTranslation,
  });
  const payload = call.payload as SubmitImageTranslationInput;
  const bound = bindImageTranslation(payload, input.lexicon);
  if (!bound.ok) throw new Error(bound.error);
  return {
    payload,
    bound: bound.result,
    analysis: bound.analysis,
    sourceText: bound.sourceText,
    tools: call.tools,
    citations: call.citations,
    usage: call.usage,
  };
}
