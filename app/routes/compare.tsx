import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Route } from "./+types/compare";
import { CreditsFooter } from "~/components/CreditsFooter";
import { ComparePicker, type CompareSelection } from "~/components/ComparePicker";
import { CompareEntryView } from "~/components/details/CompareEntryView";
import { Empty } from "~/components/ui";
import {
  compareSearchHref,
  KIND_LABEL_ONE,
  setCompareSide,
  swapCompareSearch,
  type EntryRef,
} from "~/lib/compare";
import {
  compareEntrySubtitle,
  compareEntryTitle,
  loadCompareCatalog,
  paneTitle,
  resolveComparePane,
  type ComparePane,
} from "~/lib/detail-data";
import { PageContextBridge } from "~/components/ai/PageContextBridge";
import { serializeCompareContext } from "~/lib/ai/context";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Compare — Mandarin" }];
  const left = metaLabel(loaderData.left);
  const right = metaLabel(loaderData.right);
  if (left === "…" && right === "…") return [{ title: "Compare — Mandarin" }];
  return [{ title: `${left} vs ${right} — Compare` }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const [left, right, catalog] = await Promise.all([
    resolveComparePane(url.searchParams.get("left")),
    resolveComparePane(url.searchParams.get("right")),
    loadCompareCatalog(),
  ]);
  return { left, right, catalog };
}
clientLoader.hydrate = true as const;

function metaLabel(pane: ComparePane): string {
  return pane.status === "empty" ? "…" : paneTitle(pane);
}

function selectionOf(pane: ComparePane): CompareSelection | null {
  if (pane.status === "ready") {
    return {
      title: compareEntryTitle(pane.entry),
      subtitle: `${compareEntrySubtitle(pane.entry)} · ${KIND_LABEL_ONE[pane.entry.kind]}`,
      han: pane.entry.kind !== "topic",
      ok: true,
    };
  }
  if (pane.status === "missing") {
    return {
      title: pane.ref.id,
      subtitle: `Not in HSK 1–9 · ${KIND_LABEL_ONE[pane.ref.kind]}`,
      han: pane.ref.kind !== "topic",
      ok: false,
    };
  }
  if (pane.status === "invalid") {
    return {
      title: pane.raw,
      subtitle: "Couldn’t read this selection",
      han: false,
      ok: false,
    };
  }
  return null;
}

export default function ComparePage({ loaderData }: Route.ComponentProps) {
  const { left, right, catalog } = loaderData;
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const hasLeft = searchParams.has("left");
  const hasRight = searchParams.has("right");
  const both = hasLeft && hasRight;
  const [active, setActive] = useState<"left" | "right">(hasLeft || !hasRight ? "left" : "right");

  useEffect(() => {
    if (active === "left" && !hasLeft && hasRight) setActive("right");
    if (active === "right" && !hasRight && hasLeft) setActive("left");
  }, [active, hasLeft, hasRight]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const update = () =>
      document.documentElement.style.setProperty("--app-header-height", `${header.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--app-header-height");
    };
  }, []);

  const go = (params: URLSearchParams) => {
    navigate(compareSearchHref(params), { preventScrollReset: true });
  };

  const setSide = (side: "left" | "right", ref: EntryRef | null) => {
    go(setCompareSide(searchParams, side, ref));
    if (ref) setActive(side);
  };

  const hideOnMobile = (side: "left" | "right") => {
    if (both) return active !== side;
    if (hasLeft && !hasRight) return side === "right";
    if (hasRight && !hasLeft) return side === "left";
    return side === "right";
  };

  const context = useMemo(
    () => serializeCompareContext(left, right, `${location.pathname}${location.search}`),
    [left, right, location.pathname, location.search],
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper lg:h-dvh lg:overflow-hidden">
      <PageContextBridge context={context} />
      <header
        ref={headerRef}
        className="safe-top sticky top-0 z-20 shrink-0 border-b border-line bg-paper/90 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 px-3 py-1 lg:px-6">
          <Link
            to="/hsk/1/hanzi"
            className="ui-touch inline-flex items-center rounded-lg px-2 text-sm font-medium text-ink-2 transition-colors hover:text-accent"
          >
            <span aria-hidden className="mr-2 text-lg">
              ←
            </span>
            Browse
          </Link>
          <h1 className="flex-1 text-center text-sm font-medium text-ink">Compare</h1>
          <button
            type="button"
            onClick={() => go(swapCompareSearch(searchParams))}
            aria-label="Swap sides"
            title="Swap sides"
            className="ui-touch inline-flex shrink-0 items-center justify-center rounded-lg px-2 text-sm font-medium text-ink-2 transition-colors hover:text-accent"
          >
            ⇄
          </button>
        </div>
        <div className="grid gap-2 px-3 pb-3 lg:grid-cols-2 lg:gap-6 lg:px-6">
          <ComparePicker
            label="Left"
            catalog={catalog}
            selected={selectionOf(left)}
            onActivate={() => setActive("left")}
            onSelect={(ref) => setSide("left", ref)}
            onClear={() => setSide("left", null)}
          />
          <ComparePicker
            label="Right"
            catalog={catalog}
            selected={selectionOf(right)}
            onActivate={() => setActive("right")}
            onSelect={(ref) => setSide("right", ref)}
            onClear={() => setSide("right", null)}
          />
        </div>
        {both && (
          <div
            role="tablist"
            aria-label="Comparison side"
            className="flex border-t border-line lg:hidden"
          >
            <SideTab
              id="compare-tab-left"
              controls="compare-pane-left"
              selected={active === "left"}
              onSelect={() => setActive("left")}
              pane={left}
            />
            <SideTab
              id="compare-tab-right"
              controls="compare-pane-right"
              selected={active === "right"}
              onSelect={() => setActive("right")}
              pane={right}
            />
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-2">
        <ComparePaneFrame
          id="compare-pane-left"
          labelledBy="compare-tab-left"
          pane={left}
          tabbed={both}
          hiddenOnMobile={hideOnMobile("left")}
          border
        />
        <ComparePaneFrame
          id="compare-pane-right"
          labelledBy="compare-tab-right"
          pane={right}
          tabbed={both}
          hiddenOnMobile={hideOnMobile("right")}
        />
      </div>
      <CreditsFooter />
    </div>
  );
}

function SideTab({
  id,
  controls,
  selected,
  onSelect,
  pane,
}: {
  id: string;
  controls: string;
  selected: boolean;
  onSelect: () => void;
  pane: ComparePane;
}) {
  const title = paneTitle(pane);
  const han =
    pane.status === "ready"
      ? pane.entry.kind !== "topic"
      : pane.status === "missing" && pane.ref.kind !== "topic";
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={selected}
      onClick={onSelect}
      className={clsx(
        "ui-touch min-w-0 flex-1 truncate border-b-2 px-3 text-sm transition-colors",
        selected ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink",
      )}
    >
      <span className={clsx(han && "han")}>{title}</span>
    </button>
  );
}

function ComparePaneFrame({
  id,
  labelledBy,
  pane,
  tabbed,
  hiddenOnMobile,
  border,
}: {
  id: string;
  labelledBy: string;
  pane: ComparePane;
  tabbed: boolean;
  hiddenOnMobile: boolean;
  border?: boolean;
}) {
  return (
    <section
      id={id}
      role={tabbed ? "tabpanel" : undefined}
      aria-labelledby={tabbed ? labelledBy : undefined}
      className={clsx(
        "min-w-0 px-4 py-6 sm:px-6 lg:overflow-y-auto lg:py-8",
        border && "lg:border-r lg:border-line",
        hiddenOnMobile ? "hidden lg:block" : "block",
      )}
    >
      <PaneBody pane={pane} />
    </section>
  );
}

function PaneBody({ pane }: { pane: ComparePane }) {
  if (pane.status === "ready") {
    return <CompareEntryView entry={pane.entry} />;
  }
  if (pane.status === "missing") {
    return (
      <Empty>
        {KIND_LABEL_ONE[pane.ref.kind]} “{pane.ref.id}” isn’t in HSK 1–9. Search for something else.
      </Empty>
    );
  }
  if (pane.status === "invalid") {
    return (
      <Empty>
        Couldn’t read “{pane.raw}”. Search for a hanzi, word, radical, phonetic series, or topic.
      </Empty>
    );
  }
  return (
    <Empty>Search above to add this side — hanzi, words, radicals, phonetics, or topics.</Empty>
  );
}
