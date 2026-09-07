import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import clsx from "clsx";
import {
  LuArrowLeft,
  LuBookmark,
  LuBookmarkCheck,
  LuMenu,
  LuPlus,
  LuSettings,
  LuSquare,
  LuX,
} from "react-icons/lu";
import { PromptDialog } from "~/components/Dialog";
import { ChatComposer } from "./ChatComposer";
import { ChatMessages } from "./ChatMessages";
import { ChatThreadList } from "./ChatThreadList";
import { ConfigPrompt } from "./ConfigPrompt";
import { suggestionsFor } from "~/lib/ai/suggestions";
import { useAiStore } from "~/lib/ai/store";

const headerBtn =
  "ui-touch inline-flex shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-sunk hover:text-accent";
const headerIcon = `${headerBtn} size-9`;

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const config = useAiStore((s) => s.config);
  const active = useAiStore((s) => s.active);
  const composer = useAiStore((s) => s.composer);
  const sending = useAiStore((s) => s.sending);
  const listOpen = useAiStore((s) => s.listOpen);
  const error = useAiStore((s) => s.error);
  const pageContext = useAiStore((s) => s.pageContext);
  const setComposer = useAiStore((s) => s.setComposer);
  const sendMessage = useAiStore((s) => s.sendMessage);
  const saveActive = useAiStore((s) => s.saveActive);
  const setListOpen = useAiStore((s) => s.setListOpen);
  const stop = useAiStore((s) => s.stop);
  const newChat = useAiStore((s) => s.newChat);
  const renameChat = useAiStore((s) => s.renameChat);
  const panelOpen = useAiStore((s) => s.panelOpen);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    if (!panelOpen || listOpen) setRenameOpen(false);
  }, [panelOpen, listOpen]);

  const saved = Boolean(active?.saved);
  const suggestions = suggestionsFor(pageContext);

  const pickSuggestion = (prompt: string) => {
    setComposer(prompt);
    queueMicrotask(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(prompt.length, prompt.length);
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <header className="flex shrink-0 items-center gap-0.5 border-b border-line px-2 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5 sm:pt-1.5">
        <button
          type="button"
          aria-label={listOpen ? "Back to chat" : "Saved chats"}
          onClick={() => setListOpen(!listOpen)}
          className={headerIcon}
        >
          {listOpen ? <LuArrowLeft className="size-4" /> : <LuMenu className="size-4" />}
        </button>
        <div className="min-w-0 flex-1">
          {listOpen ? (
            <p className="truncate text-sm font-medium text-ink">Chats</p>
          ) : (
            <button
              type="button"
              onClick={() => setRenameOpen(true)}
              aria-label={`Rename chat: ${active?.title ?? "Chat"}`}
              className="block w-full truncate rounded-lg px-1 py-0.5 text-left text-sm font-medium text-ink hover:text-accent"
            >
              {active?.title ?? "Chat"}
            </button>
          )}
          {!listOpen && pageContext && pageContext.kind !== "none" && (
            <p className="truncate px-1 text-xs text-ink-3">{pageContext.title}</p>
          )}
        </div>
        {!listOpen && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" aria-label="New chat" onClick={newChat} className={headerIcon}>
              <LuPlus className="size-4" />
            </button>
            {saved ? (
              <span className={headerIcon} title="Saved">
                <LuBookmarkCheck className="size-4 text-ink-3" />
              </span>
            ) : (
              <button
                type="button"
                aria-label="Save chat"
                onClick={() => void saveActive()}
                className={headerIcon}
              >
                <LuBookmark className="size-4" />
              </button>
            )}
            {sending && (
              <button
                type="button"
                aria-label="Stop generating"
                onClick={stop}
                className={headerIcon}
              >
                <LuSquare className="size-4" />
              </button>
            )}
          </div>
        )}
        <Link to="/settings" aria-label="Settings" onClick={onClose} className={headerIcon}>
          <LuSettings className="size-4" />
        </Link>
        <button
          type="button"
          aria-label="Close chat"
          onClick={onClose}
          className={`${headerIcon} text-ink-3`}
        >
          <LuX className="size-4" />
        </button>
      </header>
      <PromptDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename chat"
        label="Title"
        defaultValue={active?.title ?? ""}
        confirmLabel="Save"
        onSubmit={(title) => {
          if (active) void renameChat(active.id, title);
        }}
      />

      {listOpen ? (
        <ChatThreadList />
      ) : !config ? (
        <ConfigPrompt />
      ) : (
        <>
          {active ? (
            <ChatMessages
              chat={active}
              suggestions={suggestions}
              onPick={pickSuggestion}
              streaming={sending}
            />
          ) : null}
          {error && <p className="px-3 pb-1 text-xs text-accent">{error}</p>}
          <ChatComposer
            inputRef={composerRef}
            value={composer}
            onChange={setComposer}
            onSend={() => void sendMessage()}
            disabled={!config}
            sending={sending}
          />
        </>
      )}
    </div>
  );
}

export function chatPanelClass(open: boolean): string {
  return clsx(
    "fixed z-40 flex flex-col overflow-hidden overscroll-contain border-line bg-paper",
    "inset-0 h-dvh w-screen",
    "sm:inset-auto sm:right-4 sm:bottom-20 sm:h-[min(640px,calc(100dvh-6rem))] sm:w-[min(100vw-2rem,380px)] sm:rounded-2xl sm:border",
    "sm:shadow-2xl",
    open ? "pointer-events-auto" : "pointer-events-none",
  );
}
