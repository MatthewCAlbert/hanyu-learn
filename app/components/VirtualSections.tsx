import { useCallback, useEffect, useMemo, useRef } from "react";
import { Virtuoso } from "react-virtuoso";

export interface Section<Row> {
  id: string;
  /** Null on continuation chunks and in ungrouped modes. */
  header: { label: string; route: string; gloss: string; strokes: number; count: number } | null;
  rows: Row[];
}

interface FooterContext {
  hasMore: boolean;
  pending: boolean;
  loadedLabel: string;
  progressLabel: string;
  step: number;
  onEndReached: () => void;
}

/**
 * The footer only exists once the last section is rendered, so a sentinel
 * inside it is an exact "reached the end" signal — more reliable than Virtuoso's
 * `endReached`, which can miss when the item stream is re-created by a loader
 * revalidation.
 *
 * Declared at module scope on purpose: passing an inline component to
 * `components` gives it a new identity every render, remounting it constantly.
 */
function ListFooter({ context }: { context?: FooterContext }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const ctx = context;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !ctx?.hasMore || ctx.pending) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) ctx.onEndReached();
      },
      // Start the next page slightly before the reader actually hits the end.
      { rootMargin: "600px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [ctx?.hasMore, ctx?.pending, ctx?.onEndReached]);

  if (!ctx?.hasMore) {
    return <div className="py-6 text-center text-xs text-ink-3">{ctx?.loadedLabel}</div>;
  }

  return (
    <div ref={sentinel} className="flex flex-col items-center gap-2 py-6">
      {/*
        Scrolling loads the next page automatically, but an explicit control is
        still needed: infinite scroll alone is unreachable by keyboard and
        screen-reader users, and it silently does nothing wherever the observer
        cannot fire.
      */}
      <button
        type="button"
        onClick={ctx.onEndReached}
        disabled={ctx.pending}
        className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {ctx.pending ? "Loading…" : `Load ${ctx.step} more`}
      </button>
      <span className="text-[11px] text-ink-3">{ctx.progressLabel}</span>
    </div>
  );
}

/**
 * Windowed list of pre-chunked sections.
 *
 * Rows are grouped into bounded chunks by the loader so each virtualized item
 * stays a small, fixed piece of DOM. That preserves the grouped-by-radical
 * layout with sticky headers, which a flat grid could not do, while only
 * mounting what is near the viewport.
 *
 * Window scrolling keeps the page's own sticky header working.
 */
export function VirtualSections<Row>({
  sections,
  renderSection,
  onEndReached,
  hasMore,
  pending,
  loadedLabel,
  progressLabel,
  step,
  initialItemCount = 6,
}: {
  sections: Section<Row>[];
  renderSection: (section: Section<Row>) => React.ReactNode;
  onEndReached: () => void;
  hasMore: boolean;
  pending: boolean;
  loadedLabel: string;
  progressLabel: string;
  step: number;
  /**
   * Sections rendered without measurement. Virtuoso normally emits an empty
   * list on the server, which would leave every prerendered page contentless
   * until JavaScript runs; this puts a real screenful into the HTML.
   */
  initialItemCount?: number;
}) {
  const loadMore = useCallback(() => {
    if (hasMore && !pending) onEndReached();
  }, [hasMore, pending, onEndReached]);

  const context = useMemo<FooterContext>(
    () => ({ hasMore, pending, loadedLabel, progressLabel, step, onEndReached: loadMore }),
    [hasMore, pending, loadedLabel, progressLabel, step, loadMore],
  );

  const components = useMemo(() => ({ Footer: ListFooter }), []);

  return (
    <Virtuoso
      useWindowScroll
      data={sections}
      context={context}
      components={components}
      // Overscan by about a screenful so fast scrolling does not show gaps.
      increaseViewportBy={{ top: 400, bottom: 800 }}
      computeItemKey={(_, section) => section.id}
      initialItemCount={Math.min(initialItemCount, sections.length)}
      endReached={loadMore}
      itemContent={(_, section) => renderSection(section)}
    />
  );
}
