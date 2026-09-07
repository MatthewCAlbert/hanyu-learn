import { createStore } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import { useStore } from "zustand/react";
import {
  cloneChat,
  deleteSavedChat,
  getSavedChat,
  listSavedChats,
  putSavedChat,
  toSummary,
} from "./chat-db.client";
import { clearConfig, hasValidConfig, readConfig, writeConfig } from "./config";
import { contextChanged } from "./context";
import { isAbortError, normalizeAgentError } from "./errors";
import { extractMentions } from "./mentions";
import type {
  ChatRecord,
  ChatSummary,
  Citation,
  OpenRouterConfig,
  PageContext,
  ToolActivity,
} from "./types";

function now(): number {
  return Date.now();
}

function uid(): string {
  return crypto.randomUUID();
}

function titleFrom(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "New chat";
  return t.length > 42 ? `${t.slice(0, 41)}…` : t;
}

function scheduleFrame(cb: () => void): number {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(cb);
  return setTimeout(cb, 16) as unknown as number;
}

function cancelFrame(id: number): void {
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
  else clearTimeout(id);
}

/** Coalesce high-frequency stream patches onto animation frames so the bubble can paint. */
export function coalesce<T>(apply: (value: T) => void): { push: (value: T) => void; flush: () => void } {
  let pending: T | undefined;
  let queued = false;
  let frame = 0;
  const flush = () => {
    queued = false;
    frame = 0;
    if (pending === undefined) return;
    const value = pending;
    pending = undefined;
    apply(value);
  };
  return {
    push(value) {
      pending = value;
      if (queued) return;
      queued = true;
      frame = scheduleFrame(flush);
    },
    flush() {
      if (frame) cancelFrame(frame);
      flush();
    },
  };
}

export function createBlankChat(): ChatRecord {
  const t = now();
  return {
    id: uid(),
    title: "New chat",
    createdAt: t,
    updatedAt: t,
    saved: false,
    sessionId: uid(),
    messages: [],
  };
}

export interface AiState {
  ready: boolean;
  panelOpen: boolean;
  listOpen: boolean;
  composer: string;
  config: OpenRouterConfig | null;
  pageContext: PageContext | null;
  chats: ChatSummary[];
  active: ChatRecord | null;
  sending: boolean;
  error: string | null;
  dirty: boolean;
}

export interface AiActions {
  hydrate: () => Promise<void>;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  setListOpen: (open: boolean) => void;
  setComposer: (value: string) => void;
  setPageContext: (ctx: PageContext | null) => void;
  setConfig: (config: OpenRouterConfig) => Promise<void>;
  clearConfig: () => void;
  newChat: () => void;
  saveActive: () => Promise<void>;
  openChat: (id: string) => Promise<void>;
  renameChat: (id: string, title: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  sendMessage: (text?: string) => Promise<void>;
  stop: () => void;
}

export type AiStore = AiState & AiActions;

const initial: AiState = {
  ready: false,
  panelOpen: false,
  listOpen: false,
  composer: "",
  config: null,
  pageContext: null,
  chats: [],
  active: null,
  sending: false,
  error: null,
  dirty: false,
};

let abort: AbortController | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistInterval: ReturnType<typeof setInterval> | null = null;

export const AI_PERSIST = {
  debounceMs: 2_000,
  intervalMs: 15_000,
} as const;

async function persistIfSaved(chat: ChatRecord | null): Promise<void> {
  if (!chat?.saved) return;
  await putSavedChat(chat);
}

function queuePersist(get: () => AiStore, set: (partial: Partial<AiState>) => void): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const { active, dirty } = get();
    if (!dirty || !active?.saved) return;
    void persistIfSaved(active).then(() => {
      if (get().active?.id === active.id) set({ dirty: false });
    });
  }, AI_PERSIST.debounceMs);
}

export const aiStore = createStore<AiStore>()(
  subscribeWithSelector((set, get) => ({
    ...initial,

    hydrate: async () => {
      const config = readConfig();
      let chats: ChatSummary[] = [];
      try {
        chats = await listSavedChats();
      } catch {
        chats = [];
      }
      set({
        ready: true,
        config: hasValidConfig(config) ? config : null,
        chats,
        active: get().active ?? createBlankChat(),
      });
    },

    openPanel: () => set({ panelOpen: true, error: null }),
    closePanel: () => set({ panelOpen: false, listOpen: false }),
    togglePanel: () => set({ panelOpen: !get().panelOpen, listOpen: false, error: null }),
    setListOpen: (listOpen) => set({ listOpen }),
    setComposer: (composer) => set({ composer }),
    setPageContext: (pageContext) => set({ pageContext }),

    setConfig: async (config) => {
      writeConfig(config);
      set({ config, error: null });
    },

    clearConfig: () => {
      clearConfig();
      set({ config: null });
    },

    newChat: () => {
      abort?.abort();
      abort = null;
      set({
        active: createBlankChat(),
        composer: "",
        sending: false,
        error: null,
        dirty: false,
        listOpen: false,
      });
    },

    saveActive: async () => {
      const { active, chats } = get();
      if (!active) return;
      const saved: ChatRecord = { ...active, saved: true, updatedAt: now() };
      await putSavedChat(saved);
      const summary = toSummary(saved);
      const nextChats = [summary, ...chats.filter((c) => c.id !== saved.id)].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      set({ active: saved, chats: nextChats, dirty: false });
    },

    openChat: async (id) => {
      abort?.abort();
      abort = null;
      const loaded = await getSavedChat(id);
      if (!loaded) return;
      set({
        active: cloneChat(loaded),
        composer: "",
        sending: false,
        error: null,
        dirty: false,
        listOpen: false,
      });
    },

    renameChat: async (id, title) => {
      const nextTitle = title.replace(/\s+/g, " ").trim();
      if (!nextTitle) return;
      const { active, chats } = get();
      if (active?.id === id) {
        const updated: ChatRecord = { ...active, title: nextTitle, updatedAt: now() };
        const nextChats = updated.saved
          ? [toSummary(updated), ...chats.filter((c) => c.id !== id)].sort(
              (a, b) => b.updatedAt - a.updatedAt,
            )
          : chats;
        set({ active: updated, chats: nextChats, dirty: updated.saved });
        if (updated.saved) await persistIfSaved(updated);
        return;
      }
      const loaded = await getSavedChat(id);
      if (!loaded) return;
      const updated: ChatRecord = { ...loaded, title: nextTitle, updatedAt: now() };
      await putSavedChat(updated);
      set({
        chats: [toSummary(updated), ...get().chats.filter((c) => c.id !== id)].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        ),
      });
    },

    deleteChat: async (id) => {
      await deleteSavedChat(id);
      const { active, chats } = get();
      const nextChats = chats.filter((c) => c.id !== id);
      if (active?.id === id) {
        abort?.abort();
        abort = null;
        set({ chats: nextChats, active: createBlankChat(), sending: false, dirty: false });
      } else {
        set({ chats: nextChats });
      }
    },

    sendMessage: async (raw) => {
      const text = (raw ?? get().composer).trim();
      if (!text || get().sending) return;
      const { config, active, pageContext } = get();
      if (!hasValidConfig(config)) {
        set({ panelOpen: true, error: "Add a model and API key to chat." });
        return;
      }
      const chat = active ?? createBlankChat();
      const createdAt = now();
      const attachContext = contextChanged(chat.lastContextKey, pageContext);
      const user = {
        id: uid(),
        role: "user" as const,
        content: text,
        createdAt,
        mentions: extractMentions(text),
        pageContextKey: attachContext ? pageContext?.key : undefined,
        pageContextText: attachContext ? pageContext?.text : undefined,
      };
      const assistantId = uid();
      const assistant = {
        id: assistantId,
        role: "assistant" as const,
        content: "",
        createdAt: createdAt + 1,
      };
      const nextChat: ChatRecord = {
        ...chat,
        title: chat.messages.length === 0 ? titleFrom(text) : chat.title,
        updatedAt: createdAt,
        lastContextKey: pageContext?.kind && pageContext.kind !== "none" ? pageContext.key : chat.lastContextKey,
        messages: [...chat.messages, user, assistant],
      };
      abort?.abort();
      abort = new AbortController();
      const signal = abort.signal;
      set({
        active: nextChat,
        composer: "",
        sending: true,
        error: null,
        dirty: nextChat.saved,
        panelOpen: true,
      });
      if (nextChat.saved) queuePersist(get, set);

      const patchAssistant = (partial: Partial<ChatRecord["messages"][number]>) => {
        const current = get().active;
        if (!current || current.id !== nextChat.id) return;
        const messages = current.messages.map((m) => (m.id === assistantId ? { ...m, ...partial } : m));
        const updated = { ...current, messages, updatedAt: now() };
        set({ active: updated, dirty: updated.saved });
        if (updated.saved) queuePersist(get, set);
      };

      const liveText = coalesce((content: string) => patchAssistant({ content }));

      try {
        const { runAgent } = await import("./agent");
        const result = await runAgent({
          config,
          sessionId: nextChat.sessionId,
          messages: nextChat.messages.filter((m) => m.id !== assistantId),
          signal,
          onText: (content) => liveText.push(content),
          onTools: (toolActivities: ToolActivity[]) => patchAssistant({ toolActivities }),
          onCitations: (citations: Citation[]) => patchAssistant({ citations }),
        });
        liveText.flush();
        if (signal.aborted && !result.content) {
          patchAssistant({ content: result.content, error: "Stopped." });
        } else {
          patchAssistant({
            content: result.content,
            toolActivities: result.tools,
            citations: result.citations,
            usage: result.usage,
          });
        }
      } catch (err) {
        if (isAbortError(err)) {
          patchAssistant({ error: "Stopped." });
        } else {
          const message = normalizeAgentError(err);
          patchAssistant({ error: message });
          set({ error: message });
        }
      } finally {
        if (abort?.signal === signal) abort = null;
        const current = get().active;
        if (current?.id === nextChat.id) {
          set({ sending: false, dirty: current.saved });
          if (current.saved) {
            await persistIfSaved(current);
            const summary = toSummary(current);
            set({
              chats: [summary, ...get().chats.filter((c) => c.id !== current.id)].sort(
                (a, b) => b.updatedAt - a.updatedAt,
              ),
              dirty: false,
            });
          }
        } else {
          set({ sending: false });
        }
      }
    },

    stop: () => {
      abort?.abort();
      abort = null;
      set({ sending: false });
    },
  })),
);

export function useAiStore<T>(selector: (state: AiStore) => T): T {
  return useStore(aiStore, selector);
}

export function startAiPersistence(): () => void {
  const flush = () => {
    const { active, dirty } = aiStore.getState();
    if (dirty && active?.saved) {
      void persistIfSaved(active).then(() => {
        if (aiStore.getState().active?.id === active.id) {
          aiStore.setState({ dirty: false });
        }
      });
    }
  };

  persistInterval = setInterval(flush, AI_PERSIST.intervalMs);
  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };
  const onPageHide = () => flush();
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onPageHide);

  return () => {
    if (persistInterval) clearInterval(persistInterval);
    persistInterval = null;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = null;
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onPageHide);
    flush();
  };
}
