import type { EntryKind } from "~/lib/compare";

export type MentionKind = "hanzi" | "word";

export interface MentionRef {
  kind: MentionKind;
  id: string;
}

export type PageContextKind = "hanzi" | "word" | "compare" | "translate" | "none";
export type ContentStatus = "stub" | "drafted" | "reviewed" | "none";

/** UI-only; never copied into the model snapshot. */
export interface PageContextHintPane {
  label: string;
  mention?: MentionRef;
}

export interface PageContextHints {
  left?: PageContextHintPane;
  right?: PageContextHintPane;
  contentStatus?: ContentStatus;
  readings?: string[];
  /** True when authored etymology (hanzi) or formation notes (word) are missing. */
  missingAuthored?: boolean;
}

/** Compact, deterministic page snapshot fed to the model. */
export interface PageContext {
  key: string;
  route: string;
  title: string;
  kind: PageContextKind;
  text: string;
  hints?: PageContextHints;
}

export interface ToolActivity {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  args?: unknown;
  resultPreview?: string;
}

export interface Citation {
  title?: string;
  url: string;
}

/** Per-assistant-turn token and cost accounting from OpenRouter. */
export interface TurnUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  uncachedTokens: number;
  reasoningTokens: number;
  cost: number | null;
  webSearchRequests: number;
  modelCalls: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  mentions?: MentionRef[];
  pageContextKey?: string;
  pageContextText?: string;
  toolActivities?: ToolActivity[];
  citations?: Citation[];
  usage?: TurnUsage;
  error?: string;
}

export interface ChatRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  saved: boolean;
  sessionId: string;
  messages: ChatMessage[];
  lastContextKey?: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
}

export interface OpenRouterConfig {
  modelName: string;
  apiKey: string;
  /** OpenRouter `reasoning.enabled`. */
  reasoning: boolean;
  /** OpenRouter `reasoning.effort`. */
  reasoningEffort: ReasoningEffort;
  /** OpenRouter Responses `text.verbosity`. */
  verbosity: Verbosity;
}

export const REASONING_EFFORTS = [
  "max",
  "xhigh",
  "high",
  "medium",
  "low",
  "minimal",
  "none",
] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const VERBOSITY_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Verbosity = (typeof VERBOSITY_LEVELS)[number];

export const CONFIG_SAMPLING_DEFAULTS: Pick<
  OpenRouterConfig,
  "reasoning" | "reasoningEffort" | "verbosity"
> = {
  reasoning: true,
  reasoningEffort: "medium",
  verbosity: "medium",
};

export const MENTION_KINDS: MentionKind[] = ["hanzi", "word"];
export const PAGE_CONTEXT_KINDS: PageContextKind[] = ["hanzi", "word", "compare", "translate", "none"];

export function mentionToken(ref: MentionRef): string {
  return `@/${ref.kind}/${ref.id}`;
}

export function entryMentionKind(kind: EntryKind): MentionKind | null {
  return kind === "hanzi" || kind === "word" ? kind : null;
}
