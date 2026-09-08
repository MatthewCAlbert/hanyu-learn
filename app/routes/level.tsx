import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Route } from "./+types/level";
import {
  countsFor,
  matchesPhonetic,
  matchesRadical,
  matchesTopic,
  phoneticsAtLevels,
  radicalsAtLevels,
  topicsAtLevels,
} from "~/lib/catalog";
import { getHanziIndexes, getMeta, getPhonetics, getWordIndexesForBands } from "~/lib/data.client";
import {
  LEVELS,
  bandsSummary,
  formatBands,
  levelLabel,
  parseBands,
  toggleExtra,
  toggleLevelInBands,
  type Bands,
} from "~/lib/levels";
import {
  UNTAGGED,
  filterHanzi,
  filterWords,
  readFilters,
  searchLexemes,
  toSearch,
  type Filters,
} from "~/lib/filters";
import { isHanziLexeme } from "~/lib/lexical";
import type { Status } from "~/lib/types";
import { BottomSheet } from "~/components/Dialog";
import { ThemeToggle } from "~/components/ThemeToggle";
import { CreditsFooter } from "~/components/CreditsFooter";
import { TranslateSearchHint } from "~/components/translate/TranslateSearchHint";
import { WorkspaceNav } from "~/components/WorkspaceNav";

export function meta({ params }: Route.MetaArgs) {
  try {
    return [{ title: `${bandsSummary(parseBands(params.level))} — Mandarin` }];
  } catch {
    return [{ title: "Mandarin" }];
  }
}

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const bands = parseBands(params.level);
  const { levels, extra } = bands;
  const filters = readFilters(new URL(request.url).searchParams);
  const [{ radicals: allRadicals, topics: allTopics, counts, extraWords, lexemes }, hanzi, words, phonetics] =
    await Promise.all([
      getMeta(),
      getHanziIndexes(levels),
      getWordIndexesForBands(bands),
      getPhonetics(),
    ]);
  const radicals = radicalsAtLevels(allRadicals, hanzi, levels);
  const { topics, untagged } = topicsAtLevels(allTopics, hanzi, words, levels);
  const phoneticSeries = phoneticsAtLevels(phonetics, hanzi, levels);
  const totals = countsFor(counts, levels, extra ? extraWords : 0);

  /**
   * Each badge counts what its own tab would list, using that tab's own
   * predicate — otherwise the bar reads "Hanzi 300" over two visible rows. The
   * indexes are already in hand, so this is a filter pass, not a fetch.
   */
  const spokenHanziAll = extra ? lexemes.filter((l) => isHanziLexeme(l.form)).length : 0;
  const spokenWordsAll = extra ? lexemes.length : 0;
  const spokenHanzi = extra
    ? searchLexemes(
        lexemes.filter((l) => isHanziLexeme(l.form)),
        filters,
      ).length
    : 0;
  const spokenWords = extra ? searchLexemes(lexemes, filters).length : 0;
  const shown = {
    hanzi:
      filterHanzi(
        hanzi.filter((h) => levels.includes(h.level)),
        filters,
      ).length + spokenHanzi,
    words:
      filterWords(
        words.filter((w) => w.extra || levels.includes(w.level)),
        filters,
      ).length + spokenWords,
    topics: topics.filter((t) => matchesTopic(filters.q, t)).length,
    radicals: radicals.filter((r) => matchesRadical(filters.q, r)).length,
    phonetics: phoneticSeries.filter((row) => matchesPhonetic(filters.q, row)).length,
  };

  return {
    levels,
    extra,
    counts: {
      ...totals,
      hanzi: totals.hanzi + spokenHanziAll,
      words: totals.words + spokenWordsAll,
      radicals: radicals.length,
      topics: topics.length,
      phonetics: phoneticSeries.length,
    },
    shown,
    untagged,
    topics: topics.map((t) => ({
      id: t.id,
      label: t.label,
      count: t.hanzi.length + t.words.length,
    })),
    radicals: radicals.map((r) => ({
      char: r.char,
      display: r.display,
      gloss: r.gloss,
      strokes: r.strokes,
      count: r.hanzi.length,
    })),
  };
}
clientLoader.hydrate = true as const;

const STATUSES: Status[] = ["reviewed", "drafted", "stub"];
/** Search-param keys that hold repeatable filter values. */
type FilterKey = "r" | "s" | "std" | "topic";

const STANDARDS = [
  { value: "old-1", label: "旧 1" },
  { value: "old-2", label: "旧 2" },
  { value: "newest-1", label: "2026 · 1" },
  { value: "newest-2", label: "2026 · 2" },
];

export default function LevelShell({ loaderData }: Route.ComponentProps) {
  const { levels, extra, counts, shown, radicals, topics, untagged } = loaderData;
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const location = useLocation();
  const { pathname } = location;
  const headerRef = useRef<HTMLElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const levelButtonRef = useRef<HTMLButtonElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const tab = pathname.split("/").pop() ?? "hanzi";
  const bands = { levels, extra };
  const selected = formatBands(bands);

  const toggle = (key: FilterKey, value: string) => {
    const next = new URLSearchParams(params);
    const current = next.getAll(key);
    next.delete(key);
    for (const v of current) if (v !== value) next.append(key, v);
    if (!current.includes(value)) next.append(key, value);
    next.delete("take"); // a different filter means a different list
    setParams(next, { preventScrollReset: true });
  };

  const setQ = useCallback(
    (q: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (q) next.set("q", q);
          else next.delete("q");
          next.delete("take");
          return next;
        },
        { preventScrollReset: true, replace: true },
      );
    },
    [setParams],
  );

  /** Keep the field snappy; the URL (and therefore the list) follows after a pause. */
  const [draft, setDraft] = useState(filters.q);
  useEffect(() => {
    setDraft(filters.q);
  }, [filters.q]);
  useEffect(() => {
    if (draft === filters.q) return;
    const id = window.setTimeout(() => setQ(draft), 250);
    return () => window.clearTimeout(id);
  }, [draft, filters.q, setQ]);

  /** Drop every value in one filter group, leaving the others untouched. */
  const clearGroup = (key: FilterKey | "q") => {
    const next = new URLSearchParams(params);
    next.delete(key);
    next.delete("take");
    setParams(next, { preventScrollReset: true });
  };

  /**
   * Clear the filters but keep `view` and `group` — those are display
   * preferences, not filters, and resetting them is not what "clear" means.
   */
  const clearAll = () => {
    const next = new URLSearchParams();
    if (filters.view !== "grid") next.set("view", filters.view);
    if (filters.group !== "radical") next.set("group", filters.group);
    setParams(next, { preventScrollReset: true });
  };

  const radicalLabel = (char: string) => {
    const r = radicals.find((x) => x.char === char);
    return { display: r?.display ?? char, gloss: r?.gloss ?? "" };
  };

  const activeFilters =
    filters.radicals.length +
    filters.status.length +
    filters.standards.length +
    filters.topics.length;
  const search = toSearch(filters);
  const listOwnsFooter = tab === "hanzi" || tab === "words";

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

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header
        ref={headerRef}
        className="safe-top sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-xl"
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 lg:flex lg:gap-4 lg:px-6">
          <NavLink
            to={`/hsk/${selected}/hanzi`}
            aria-label="Hanzi index"
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg"
          >
            <img src="/app-mark.png" alt="" width={64} height={64} className="size-8 rounded-lg" />
            <span>
              <span className="han block text-lg tracking-tight">汉字</span>
              <span className="hidden text-[10px] tracking-wide text-ink-3 uppercase sm:block">
                Hanyu Learn
              </span>
            </span>
          </NavLink>

          {/* Levels are multi-select: study one, or both at once. The
              selection lives in the path so it stays bookmarkable. */}
          <button
            ref={levelButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={levelsOpen}
            title={bandsSummary(bands)}
            onClick={() => setLevelsOpen(true)}
            className="ui-touch min-w-0 truncate rounded-xl border border-line bg-surface px-3 text-left text-sm font-medium text-ink lg:hidden"
          >
            {bandsSummary(bands)}
          </button>
          <fieldset className="hidden items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5 lg:flex">
            <legend className="sr-only">HSK levels and Extra</legend>
            <LevelControls bands={bands} tab={tab} search={search} compact />
          </fieldset>

          <div className="relative order-4 col-span-3 min-w-0 lg:order-0 lg:col-span-1 lg:flex-1">
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                setQ(draft);
              }}
            >
              <input
                type="search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search 好, hao, hǎo or “good”…"
                aria-label="Search hanzi, pinyin or English"
                className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-4 text-base outline-none placeholder:text-ink-3 focus:border-accent lg:min-h-9 lg:text-sm"
              />
            </form>
            <TranslateSearchHint query={filters.q} shown={shown} />
          </div>

          <div className="flex shrink-0 items-center gap-1 justify-self-end">
            <WorkspaceNav />
            <ThemeToggle />
          </div>
        </div>

        <nav
          aria-label="Browse"
          className="hide-scrollbar flex snap-x gap-1 overflow-x-auto px-4 lg:px-6"
        >
          {(
            [
              ["hanzi", "Hanzi", shown.hanzi, counts.hanzi],
              ["words", "Words", shown.words, counts.words],
              ["topics", "Topics", shown.topics, counts.topics],
              ["radicals", "Radicals", shown.radicals, counts.radicals],
              ["phonetics", "Phonetics", shown.phonetics, counts.phonetics],
            ] as const
          ).map(([slug, label, count, total]) => (
            <NavLink
              key={slug}
              to={`/hsk/${selected}/${slug}${search}`}
              // The badge shows what the tab would list; the full total moves
              // to the tooltip rather than into the label, which would reflow
              // the bar on every keystroke.
              title={count === total ? undefined : `${count} of ${total}`}
              className={({ isActive }) =>
                clsx(
                  "ui-touch -mb-px flex shrink-0 snap-start items-center border-b-2 px-2.5 text-sm font-medium transition-colors lg:min-h-10",
                  isActive
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-3 hover:text-ink-2",
                )
              }
            >
              {label} {count}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-line px-4 py-5 lg:block">
          <FilterControls
            filters={filters}
            topics={topics}
            radicals={radicals}
            untagged={untagged}
            toggle={toggle}
            clearGroup={clearGroup}
          />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 lg:px-6 lg:py-5">
          <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
            <p className="text-xs text-ink-3">Refine this collection</p>
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="ui-touch inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink"
            >
              Filters
              {activeFilters > 0 && (
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] text-white">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>
          <ActiveFilters
            filters={filters}
            radicalLabel={radicalLabel}
            topicLabel={(id) => topics.find((t) => t.id === id)?.label}
            onRemove={(key, value) => (key === "q" ? setQ("") : toggle(key, value))}
            onClearAll={clearAll}
          />
          <Outlet />
        </main>
      </div>
      <BottomSheet
        open={levelsOpen}
        onOpenChange={setLevelsOpen}
        title="Study range"
        description={bandsSummary(bands)}
        returnFocusRef={levelButtonRef}
      >
        <fieldset>
          <legend className="sr-only">HSK levels and Extra</legend>
          <LevelControls bands={bands} tab={tab} search={search} />
        </fieldset>
      </BottomSheet>
      <BottomSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Refine results"
        description="Changes apply immediately"
        returnFocusRef={filterButtonRef}
      >
        <FilterControls
          filters={filters}
          topics={topics}
          radicals={radicals}
          untagged={untagged}
          toggle={toggle}
          clearGroup={clearGroup}
        />
      </BottomSheet>
      {!listOwnsFooter && <CreditsFooter />}
    </div>
  );
}

function LevelControls({
  bands,
  tab,
  search,
  compact = false,
}: {
  bands: Bands;
  tab: string;
  search: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const { levels, extra } = bands;
  const go = (next: Bands) =>
    navigate(`/hsk/${formatBands(next)}/${tab}${search}`, { preventScrollReset: true });

  if (compact) {
    return (
      <>
        <span aria-hidden className="px-1 text-[11px] text-ink-3">
          HSK
        </span>
        {LEVELS.map((l) => {
          const on = levels.includes(l);
          const only = on && levels.length === 1 && !extra;
          return (
            <label
              key={l}
              title={
                only
                  ? "At least one level must stay selected"
                  : `HSK ${levelLabel(l)}${l === 7 ? " (the wordlist merges 7-9)" : ""}`
              }
              className={clsx(
                "ui-touch inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors lg:min-h-8 lg:min-w-8",
                on ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunk hover:text-ink",
                only && "cursor-default",
              )}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={only}
                onChange={() => go(toggleLevelInBands(bands, l))}
                className="sr-only"
              />
              {levelLabel(l)}
            </label>
          );
        })}
        <button
          type="button"
          onClick={() =>
            go({ levels: levels.length === LEVELS.length ? [1] : LEVELS, extra })
          }
          className="ui-touch ml-0.5 shrink-0 rounded-lg px-2 text-xs text-accent transition-colors hover:bg-sunk lg:min-h-8"
        >
          {levels.length === LEVELS.length ? "only 1" : "all"}
        </button>
        <label
          title={
            extra && levels.length === 0
              ? "At least one band must stay selected"
              : "Country names and spoken/chat forms not on the HSK 3.0 wordlist"
          }
          className={clsx(
            "ui-touch ml-0.5 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border-l border-line px-2 text-xs font-medium transition-colors lg:min-h-8",
            extra ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunk hover:text-ink",
            extra && levels.length === 0 && "cursor-default",
          )}
        >
          <input
            type="checkbox"
            checked={extra}
            disabled={extra && levels.length === 0}
            onChange={() => go(toggleExtra(bands))}
            className="sr-only"
          />
          Extra
        </label>
      </>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-3">
        <span className="ui-eyebrow">HSK bands</span>
        <span className="text-xs text-ink-3">{levels.length} of 7 selected</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {LEVELS.map((l) => {
          const on = levels.includes(l);
          const only = on && levels.length === 1 && !extra;
          return (
            <label
              key={l}
              title={only ? "At least one band must stay selected" : `HSK ${levelLabel(l)}`}
              className={clsx(
                "ui-touch relative flex min-h-14 cursor-pointer items-center justify-center rounded-xl border text-base font-medium transition-colors",
                l === 7 && "col-span-2",
                on
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-line bg-surface text-ink-2 hover:border-accent/50 hover:text-ink",
                only && "cursor-default",
              )}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={only}
                onChange={() => go(toggleLevelInBands(bands, l))}
                className="sr-only"
              />
              <span>HSK {levelLabel(l)}</span>
              {on && (
                <span
                  aria-hidden
                  className="absolute top-1.5 right-2 text-xs font-medium text-accent"
                >
                  ✓
                </span>
              )}
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => go({ levels: levels.length === LEVELS.length ? [1] : LEVELS, extra })}
        className="ui-touch mt-3 inline-flex w-full items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink-2 transition-colors hover:border-accent/50 hover:text-accent"
      >
        {levels.length === LEVELS.length ? "Use HSK 1" : "Select all HSK bands"}
      </button>

      <div className="mt-5 border-t border-line pt-5">
        <span className="ui-eyebrow">Supplement</span>
        <label
          title={
            extra && levels.length === 0
              ? "At least one band must stay selected"
              : "Country names and spoken/chat forms not on the HSK 3.0 wordlist"
          }
          className={clsx(
            "ui-touch mt-2 flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border px-4 transition-colors",
            extra
              ? "border-accent/40 bg-accent-soft"
              : "border-line bg-surface hover:border-accent/50",
            extra && levels.length === 0 && "cursor-default",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className={clsx("block text-sm font-medium", extra ? "text-accent" : "text-ink")}>
              Extra vocabulary
            </span>
            <span className="mt-0.5 block text-xs text-ink-3">
              Country names and spoken/chat forms
            </span>
          </span>
          <input
            type="checkbox"
            checked={extra}
            disabled={extra && levels.length === 0}
            onChange={() => go(toggleExtra(bands))}
            className="sr-only"
          />
          <span
            aria-hidden
            className={clsx(
              "flex size-6 shrink-0 items-center justify-center rounded-full border text-sm",
              extra ? "border-accent bg-accent text-white" : "border-line bg-paper text-transparent",
            )}
          >
            ✓
          </span>
        </label>
      </div>
    </div>
  );
}

function FilterControls({
  filters,
  topics,
  radicals,
  untagged,
  toggle,
  clearGroup,
}: {
  filters: Filters;
  topics: { id: string; label: string; count: number }[];
  radicals: {
    char: string;
    display: string;
    gloss: string;
    strokes: number;
    count: number;
  }[];
  untagged: number;
  toggle: (key: FilterKey, value: string) => void;
  clearGroup: (key: FilterKey | "q") => void;
}) {
  return (
    <>
      <FilterGroup label="Topic" active={filters.topics.length} onReset={() => clearGroup("topic")}>
        <Check
          checked={filters.topics.includes(UNTAGGED)}
          onChange={() => toggle("topic", UNTAGGED)}
          label={
            <span className="flex w-full items-baseline gap-1.5">
              <span className="italic text-ink-3">untagged</span>
              <span className="ml-auto tabular-nums text-ink-3">{untagged}</span>
            </span>
          }
        />
        <div className="-mx-1 max-h-[30vh] overflow-y-auto px-1">
          {topics.map((topic) => (
            <Check
              key={topic.id}
              checked={filters.topics.includes(topic.id)}
              onChange={() => toggle("topic", topic.id)}
              label={
                <span className="flex w-full items-baseline gap-1.5">
                  <span className={clsx("truncate", topic.count === 0 && "text-ink-3")}>
                    {topic.label}
                  </span>
                  <span className="ml-auto tabular-nums text-ink-3">{topic.count}</span>
                </span>
              }
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Status" active={filters.status.length} onReset={() => clearGroup("s")}>
        {STATUSES.map((status) => (
          <Check
            key={status}
            checked={filters.status.includes(status)}
            onChange={() => toggle("s", status)}
            label={status}
          />
        ))}
      </FilterGroup>

      <FilterGroup
        label="Also in"
        active={filters.standards.length}
        onReset={() => clearGroup("std")}
      >
        {STANDARDS.map((standard) => (
          <Check
            key={standard.value}
            checked={filters.standards.includes(standard.value)}
            onChange={() => toggle("std", standard.value)}
            label={standard.label}
          />
        ))}
      </FilterGroup>

      <FilterGroup
        label={`Radical (${radicals.length})`}
        active={filters.radicals.length}
        onReset={() => clearGroup("r")}
      >
        <div className="-mx-1 max-h-[45vh] overflow-y-auto px-1">
          {radicals.map((radical) => (
            <Check
              key={radical.char}
              checked={filters.radicals.includes(radical.char)}
              onChange={() => toggle("r", radical.char)}
              label={
                <span className="flex w-full items-baseline gap-1.5">
                  <span className="han text-base">{radical.display}</span>
                  <span className="truncate text-ink-3">{radical.gloss}</span>
                  <span className="ml-auto tabular-nums text-ink-3">{radical.count}</span>
                </span>
              }
            />
          ))}
        </div>
      </FilterGroup>
    </>
  );
}

function FilterGroup({
  label,
  active,
  onReset,
  children,
}: {
  label: string;
  active: number;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="ui-eyebrow">{label}</h3>
        {/* Only offered when the group has something to reset. */}
        {active > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="ui-touch -my-2 rounded-lg px-2 text-xs text-accent underline underline-offset-2 hover:no-underline lg:min-h-8"
          >
            reset{active > 1 ? ` (${active})` : ""}
          </button>
        )}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/**
 * Everything currently narrowing the results, each removable on its own.
 *
 * Lives above the results rather than in the sidebar because the sidebar is
 * hidden below 1024px — on a phone this bar is the only way to see, and undo,
 * what is filtering the list.
 */
function ActiveFilters({
  filters,
  radicalLabel,
  topicLabel,
  onRemove,
  onClearAll,
}: {
  filters: Filters;
  radicalLabel: (char: string) => { display: string; gloss: string };
  topicLabel: (id: string) => string | undefined;
  onRemove: (key: FilterKey | "q", value: string) => void;
  onClearAll: () => void;
}) {
  const chips: { key: FilterKey | "q"; value: string; label: React.ReactNode }[] = [];

  if (filters.q) {
    chips.push({ key: "q", value: filters.q, label: <>search “{filters.q}”</> });
  }
  for (const r of filters.radicals) {
    const { display, gloss } = radicalLabel(r);
    chips.push({
      key: "r",
      value: r,
      label: (
        <>
          <span className="han">{display}</span>
          {gloss && <span className="text-ink-3"> {gloss}</span>}
        </>
      ),
    });
  }
  for (const t of filters.topics) {
    chips.push({
      key: "topic",
      value: t,
      label: t === UNTAGGED ? <span className="italic">untagged</span> : (topicLabel(t) ?? t),
    });
  }
  for (const s of filters.status) chips.push({ key: "s", value: s, label: s });
  for (const t of filters.standards) {
    chips.push({ key: "std", value: t, label: STANDARDS.find((x) => x.value === t)?.label ?? t });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-line pb-3">
      <span className="ui-eyebrow">Filtering by</span>
      {chips.map((c) => (
        <button
          key={`${c.key}:${c.value}`}
          type="button"
          onClick={() => onRemove(c.key, c.value)}
          title={`Remove this filter`}
          className="ui-touch group inline-flex items-center gap-1 rounded-full border border-line bg-surface pr-2 pl-3 text-xs text-ink-2 transition-colors hover:border-accent hover:text-ink lg:min-h-8"
        >
          {c.label}
          <span aria-hidden className="text-ink-3 transition-colors group-hover:text-accent">
            ✕
          </span>
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="ui-touch ml-1 rounded-lg px-2 text-xs text-accent underline underline-offset-4 hover:no-underline lg:min-h-8"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: React.ReactNode;
}) {
  return (
    <label className="ui-touch flex cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-ink-2 hover:bg-sunk lg:min-h-8 lg:text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-accent size-4 shrink-0"
      />
      <span className="min-w-0 flex-1">{label}</span>
    </label>
  );
}
