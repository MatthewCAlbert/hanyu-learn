import { useEffect, useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { EntryRef } from "~/lib/compare";
import { flattenCompareHits, hitKey, searchCompare, type CompareHit } from "~/lib/compare-search";
import type { CompareCatalog } from "~/lib/detail-data";
import { Highlighted } from "~/components/ui";

export interface CompareSelection {
  title: string;
  subtitle: string;
  han: boolean;
  ok: boolean;
}

export function ComparePicker({
  label,
  catalog,
  selected,
  onSelect,
  onClear,
  onActivate,
}: {
  label: string;
  catalog: CompareCatalog;
  selected: CompareSelection | null;
  onSelect: (ref: EntryRef) => void;
  onClear: () => void;
  onActivate?: () => void;
}) {
  const reactId = useId();
  const listId = `${reactId}-list`;
  const inputId = `${reactId}-input`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(!selected?.ok);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (selected?.ok) {
      setEditing(false);
      setDraft("");
      setOpen(false);
    } else if (!selected) {
      setEditing(true);
    }
  }, [selected]);

  const groups = useMemo(() => searchCompare(catalog, draft), [catalog, draft]);
  const flat = useMemo(() => flattenCompareHits(groups), [groups]);

  useEffect(() => {
    setActive(0);
  }, [draft]);

  useEffect(() => {
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const showList = editing && open;
  const activeHit = flat[active];

  const choose = (hit: CompareHit) => {
    onSelect(hit.ref);
    setDraft("");
    setOpen(false);
    setEditing(false);
  };

  const startEditing = () => {
    onActivate?.();
    setEditing(true);
    setOpen(true);
    queueMicrotask(() => inputRef.current?.focus());
  };

  return (
    <div ref={rootRef} className="min-w-0">
      <label htmlFor={inputId} className="ui-eyebrow">
        {label}
      </label>
      {selected && !editing ? (
        <div className="mt-1.5 flex gap-1">
          <button
            type="button"
            onClick={startEditing}
            className={clsx(
              "ui-touch ui-card ui-card-interactive flex min-w-0 flex-1 items-center gap-2 px-3 text-left",
              selected.ok ? "border-line" : "border-accent",
            )}
          >
            <span className={clsx("min-w-0 flex-1 truncate", selected.han && "han text-lg")}>
              {selected.title}
            </span>
            <span className="max-w-[50%] truncate text-xs text-ink-3">{selected.subtitle}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClear();
              setEditing(true);
              setDraft("");
              onActivate?.();
            }}
            aria-label={`Clear ${label}`}
            className="ui-touch inline-flex shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-sm text-ink-3 transition-colors hover:border-accent hover:text-accent"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="relative mt-1.5">
          <div className="flex gap-1">
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={showList && activeHit ? `${listId}-opt-${active}` : undefined}
              placeholder="Search hanzi, words, radicals…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={draft}
              onFocus={() => {
                onActivate?.();
                setOpen(true);
              }}
              onBlur={(e) => {
                if (rootRef.current?.contains(e.relatedTarget as Node)) return;
                setOpen(false);
                if (selected?.ok) setEditing(false);
              }}
              onChange={(e) => {
                setDraft(e.target.value);
                setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  if (!flat.length) return;
                  setActive((i) => (i + 1) % flat.length);
                  setOpen(true);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  if (!flat.length) return;
                  setActive((i) => (i - 1 + flat.length) % flat.length);
                  setOpen(true);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (activeHit) choose(activeHit);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                  if (selected?.ok) {
                    setEditing(false);
                    setDraft("");
                  }
                }
              }}
              className="ui-touch min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-3"
            />
            {selected && (
              <button
                type="button"
                onClick={() => {
                  if (selected.ok) {
                    setEditing(false);
                    setDraft("");
                    setOpen(false);
                  } else {
                    onClear();
                    setDraft("");
                  }
                }}
                aria-label={selected.ok ? `Cancel changing ${label}` : `Clear ${label}`}
                className="ui-touch inline-flex shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-sm text-ink-3 transition-colors hover:border-accent hover:text-accent"
              >
                ×
              </button>
            )}
          </div>
          {showList && (
            <div
              id={listId}
              role="listbox"
              aria-label={`${label} search results`}
              className="ui-card absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto py-1 shadow-lg"
            >
              {draft.trim() === "" ? (
                <p className="px-3 py-3 text-sm text-ink-3">
                  Type a character, pinyin, English, radical, or topic.
                </p>
              ) : flat.length === 0 ? (
                <p className="px-3 py-3 text-sm text-ink-3">No matches for “{draft.trim()}”.</p>
              ) : (
                groups.map((group) => (
                  <div key={group.kind} className="py-1">
                    <p className="ui-eyebrow px-3 py-1">{group.label}</p>
                    {group.hits.map((hit) => {
                      const index = flat.indexOf(hit);
                      const isActive = index === active;
                      return (
                        <button
                          key={hitKey(hit)}
                          type="button"
                          id={`${listId}-opt-${index}`}
                          role="option"
                          aria-selected={isActive}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => choose(hit)}
                          className={clsx(
                            "ui-touch flex w-full items-center gap-2 px-3 text-left text-sm",
                            isActive ? "bg-accent-soft text-ink" : "text-ink hover:bg-sunk",
                          )}
                        >
                          <span
                            className={clsx(
                              "min-w-0 truncate",
                              hit.kind !== "topic" && "han text-lg",
                            )}
                          >
                            {hit.title}
                          </span>
                          {hit.reading && (
                            <span className="shrink-0 text-xs text-ink-2">{hit.reading}</span>
                          )}
                          {hit.gloss && (
                            <span className="min-w-0 flex-1 truncate text-xs text-ink-3">
                              <Highlighted text={hit.gloss} at={hit.at} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
