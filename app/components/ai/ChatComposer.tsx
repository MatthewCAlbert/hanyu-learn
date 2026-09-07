import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { LuLoader, LuSend } from "react-icons/lu";
import clsx from "clsx";
import { Highlighted } from "~/components/ui";
import { loadAiCatalog } from "~/lib/ai/catalog";
import { highlightComposer, insertMention, mentionAtCaret } from "~/lib/ai/mentions";
import { kindOptions, searchMentions } from "~/lib/ai/mention-search";
import type { CompareCatalog } from "~/lib/detail-data";
import type { CompareHit } from "~/lib/compare-search";
import type { MentionKind, MentionRef } from "~/lib/ai/types";

// iOS zooms focused controls below 16px. Keep the mobile composer at 16px.
const fieldText =
  "min-h-11 w-full px-3 py-2 text-base leading-6 [overflow-wrap:anywhere] sm:text-sm sm:leading-5";

export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  sending,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const reactId = useId();
  const listId = `${reactId}-mentions`;
  const localRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const textareaRef = inputRef ?? localRef;
  const [caret, setCaret] = useState(0);
  const [catalog, setCatalog] = useState<CompareCatalog | null>(null);
  const [active, setActive] = useState(0);

  const [dismissed, setDismissed] = useState(false);
  const query = useMemo(
    () => (dismissed ? null : mentionAtCaret(value, caret)),
    [value, caret, dismissed],
  );
  const segments = useMemo(() => highlightComposer(value, caret), [value, caret]);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    void loadAiCatalog().then((c) => {
      if (!cancelled) setCatalog(c);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const kinds = query?.choosingKind ? kindOptions(query.kindPrefix) : [];
  const hits = query && catalog && !query.choosingKind ? searchMentions(catalog, query) : [];
  const show =
    Boolean(query) &&
    (kinds.length > 0 || hits.length > 0 || Boolean(query && !query.choosingKind && query.q));

  const kindCount = kinds.length;
  const total = kindCount + hits.length;

  useEffect(() => {
    setActive(0);
  }, [query?.raw, query?.q, query?.kind]);

  const syncOverlay = () => {
    const el = textareaRef.current;
    const overlay = overlayRef.current;
    if (!el || !overlay) return;
    overlay.scrollTop = el.scrollTop;
    overlay.scrollLeft = el.scrollLeft;
  };

  const chooseKind = (kind: MentionKind) => {
    const el = textareaRef.current;
    if (!query || !el) return;
    const token = `@/${kind}/`;
    const next = `${value.slice(0, query.start)}${token}${value.slice(query.end)}`;
    const nextCaret = query.start + token.length;
    onChange(next);
    queueMicrotask(() => {
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  };

  const chooseHit = (hit: CompareHit) => {
    const el = textareaRef.current;
    if (!el || (hit.kind !== "hanzi" && hit.kind !== "word")) return;
    const ref: MentionRef = { kind: hit.kind, id: hit.ref.id };
    const next = insertMention(value, caret, ref);
    onChange(next.text);
    queueMicrotask(() => {
      el.focus();
      el.setSelectionRange(next.caret, next.caret);
      setCaret(next.caret);
    });
  };

  const chooseIndex = (i: number) => {
    if (i < kindCount) {
      const k = kinds[i];
      if (k) chooseKind(k.kind);
      return;
    }
    const hit = hits[i - kindCount];
    if (hit) chooseHit(hit);
  };

  return (
    <div className="relative shrink-0 border-t border-line bg-paper px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
      {show && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-3 bottom-full z-50 mb-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg"
        >
          {kinds.map((k, i) => (
            <li key={k.kind}>
              <button
                type="button"
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={active === i}
                className={clsx(
                  "flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm",
                  active === i ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-sunk",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => chooseKind(k.kind)}
              >
                <span className="text-ink-3">{k.token}</span>
                <span>{k.label}</span>
              </button>
            </li>
          ))}
          {hits.map((hit, hi) => {
            const i = kindCount + hi;
            return (
              <li key={`${hit.kind}:${hit.ref.id}`}>
                <button
                  type="button"
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={active === i}
                  className={clsx(
                    "flex min-h-11 w-full min-w-0 items-center gap-2 px-3 text-left text-sm",
                    active === i ? "bg-accent-soft text-ink" : "text-ink-2 hover:bg-sunk",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chooseHit(hit)}
                >
                  <span className="han text-lg text-ink">{hit.title}</span>
                  <span className="shrink-0 text-xs text-ink-3">
                    @/{hit.kind}/{hit.ref.id}
                  </span>
                  <span className="min-w-0 truncate text-xs text-ink-3">
                    {hit.reading}
                    {hit.gloss ? " · " : ""}
                    {hit.at ? <Highlighted text={hit.gloss} at={hit.at} /> : hit.gloss}
                  </span>
                </button>
              </li>
            );
          })}
          {query && !query.choosingKind && !hits.length && query.q && (
            <li className="px-3 py-2 text-xs text-ink-3">No matches</li>
          )}
        </ul>
      )}
      <label className="sr-only" htmlFor={`${reactId}-input`}>
        Message
      </label>
      <div className="rounded-2xl border border-line bg-surface focus-within:border-accent">
        <div className="relative">
          <div
            ref={overlayRef}
            aria-hidden
            className={clsx(
              "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap wrap-break-word text-ink",
              fieldText,
            )}
          >
            {segments.map((seg, i) => (
              <span
                key={i}
                className={clsx(
                  seg.kind === "mention" && "rounded-sm bg-accent-soft text-accent",
                  seg.kind === "pending" && "underline decoration-accent/50 underline-offset-2",
                )}
              >
                {seg.text}
              </span>
            ))}
            {"\n"}
          </div>
          <textarea
            ref={textareaRef}
            id={`${reactId}-input`}
            rows={2}
            disabled={disabled}
            value={value}
            placeholder={disabled ? "Add a key in Settings to chat" : "Ask, or type @ to mention…"}
            aria-controls={show ? listId : undefined}
            aria-expanded={show}
            aria-autocomplete="list"
            aria-activedescendant={show && total ? `${listId}-opt-${active}` : undefined}
            onChange={(e) => {
              onChange(e.target.value);
              setCaret(e.target.selectionStart);
              setDismissed(false);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onScroll={syncOverlay}
            onKeyDown={(e) => {
              if (show && total > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                setActive((i) =>
                  e.key === "ArrowDown" ? (i + 1) % total : (i - 1 + total) % total,
                );
                return;
              }
              if (
                show &&
                total > 0 &&
                (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && query))
              ) {
                e.preventDefault();
                chooseIndex(active);
                return;
              }
              if (e.key === "Escape" && show) {
                e.preventDefault();
                setDismissed(true);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending && value.trim()) onSend();
              }
            }}
            className={clsx(
              fieldText,
              "relative z-10 resize-none bg-transparent outline-none placeholder:text-ink-3",
              value ? "text-transparent caret-ink" : "text-ink",
            )}
          />
        </div>
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <p className="min-w-0 truncate px-1 text-[11px] leading-4 text-ink-3">
            Enter to send · Shift+Enter for a new line
          </p>
          <button
            type="button"
            aria-label={sending ? "Sending" : "Send"}
            disabled={disabled || sending || !value.trim()}
            onClick={onSend}
            className="ui-touch inline-flex size-11 items-center justify-center rounded-xl bg-ink text-paper disabled:opacity-40"
          >
            {sending ? <LuLoader className="size-4 animate-spin" /> : <LuSend className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
