import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { SavedSongRecord } from "~/lib/song";

const DB_NAME = "hanyu-songs";
const DB_VERSION = 1;

interface SongDB extends DBSchema {
  songs: {
    key: string;
    value: SavedSongRecord;
    indexes: { "by-updated": number };
  };
}

let dbPromise: Promise<IDBPDatabase<SongDB>> | null = null;

export function openSongDb(): Promise<IDBPDatabase<SongDB>> {
  dbPromise ??= openDB<SongDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("songs")) {
        const store = db.createObjectStore("songs", { keyPath: "id" });
        store.createIndex("by-updated", "updatedAt");
      }
    },
  });
  return dbPromise;
}

/** Drop the cached connection so tests can start from an empty database. */
export function resetSongDbForTests(): void {
  dbPromise = null;
}

export async function listSavedSongs(): Promise<SavedSongRecord[]> {
  const db = await openSongDb();
  const rows = await db.getAllFromIndex("songs", "by-updated");
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSavedSong(id: string): Promise<SavedSongRecord | null> {
  const db = await openSongDb();
  return (await db.get("songs", id)) ?? null;
}

export async function putSavedSong(song: SavedSongRecord): Promise<void> {
  const db = await openSongDb();
  await db.put("songs", song);
}

export async function deleteSavedSong(id: string): Promise<void> {
  const db = await openSongDb();
  await db.delete("songs", id);
}
