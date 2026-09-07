import { useState } from "react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import clsx from "clsx";
import { ConfirmDialog } from "~/components/Dialog";
import { useAiStore } from "~/lib/ai/store";
import type { ChatSummary } from "~/lib/ai/types";

export function ChatThreadList() {
  const chats = useAiStore((s) => s.chats);
  const activeId = useAiStore((s) => s.active?.id);
  const openChat = useAiStore((s) => s.openChat);
  const deleteChat = useAiStore((s) => s.deleteChat);
  const newChat = useAiStore((s) => s.newChat);
  const [pendingDelete, setPendingDelete] = useState<ChatSummary | null>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line px-3 py-2">
        <button
          type="button"
          onClick={newChat}
          className="ui-touch inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium text-ink hover:border-accent hover:text-accent"
        >
          <LuPlus className="size-4" />
          New chat
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {chats.length === 0 && (
          <li className="px-2 py-6 text-center text-sm text-ink-3">No saved chats yet.</li>
        )}
        {chats.map((c) => (
          <li key={c.id} className="flex gap-1">
            <button
              type="button"
              onClick={() => void openChat(c.id)}
              className={clsx(
                "ui-touch min-w-0 flex-1 rounded-xl px-3 text-left text-sm",
                c.id === activeId ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-sunk",
              )}
            >
              <span className="block truncate">{c.title}</span>
              <span className="block text-xs text-ink-3">{formatWhen(c.updatedAt)}</span>
            </button>
            <button
              type="button"
              aria-label={`Delete ${c.title}`}
              onClick={() => setPendingDelete(c)}
              className="ui-touch inline-flex w-11 shrink-0 items-center justify-center rounded-xl text-ink-3 hover:text-accent"
            >
              <LuTrash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete chat"
        description={
          pendingDelete
            ? `Delete “${pendingDelete.title}”? This cannot be undone.`
            : "Delete this chat?"
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (pendingDelete) void deleteChat(pendingDelete.id);
        }}
      />
    </div>
  );
}

function formatWhen(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(ts);
  } catch {
    return "";
  }
}
