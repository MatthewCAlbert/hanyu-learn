import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ChatMessage, ChatRecord, ChatSummary } from "./types";

const DB_NAME = "hanyu-ai";
const DB_VERSION = 1;

interface ChatDB extends DBSchema {
  chats: {
    key: string;
    value: PersistedChat;
    indexes: { "by-updated": number };
  };
}

export type PersistedChat = Omit<ChatRecord, "saved">;

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

export function openChatDb(): Promise<IDBPDatabase<ChatDB>> {
  dbPromise ??= openDB<ChatDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("chats")) {
        const store = db.createObjectStore("chats", { keyPath: "id" });
        store.createIndex("by-updated", "updatedAt");
      }
    },
  });
  return dbPromise;
}

/** Drop the cached connection so tests can start from an empty database. */
export function resetChatDbForTests(): void {
  dbPromise = null;
}

export async function listSavedChats(): Promise<ChatSummary[]> {
  const db = await openChatDb();
  const rows = await db.getAllFromIndex("chats", "by-updated");
  return rows
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, createdAt: c.createdAt }));
}

export async function getSavedChat(id: string): Promise<ChatRecord | null> {
  const db = await openChatDb();
  const row = await db.get("chats", id);
  return row ? { ...row, saved: true } : null;
}

export async function putSavedChat(chat: ChatRecord): Promise<void> {
  if (!chat.saved) return;
  const db = await openChatDb();
  const { saved: _saved, ...rest } = chat;
  await db.put("chats", rest);
}

export async function deleteSavedChat(id: string): Promise<void> {
  const db = await openChatDb();
  await db.delete("chats", id);
}

export function toSummary(chat: ChatRecord): ChatSummary {
  return { id: chat.id, title: chat.title, updatedAt: chat.updatedAt, createdAt: chat.createdAt };
}

export function cloneChat(chat: ChatRecord): ChatRecord {
  return {
    ...chat,
    messages: chat.messages.map((m) => cloneMessage(m)),
  };
}

export function cloneMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    mentions: message.mentions ? [...message.mentions] : undefined,
    toolActivities: message.toolActivities?.map((t) => ({ ...t })),
    citations: message.citations?.map((c) => ({ ...c })),
    usage: message.usage ? { ...message.usage } : undefined,
  };
}
