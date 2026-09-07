import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router";
import clsx from "clsx";
import type { Route } from "./+types/level";
import {
  countsFor,
  matchesRadical,
  matchesTopic,
  radicalsAtLevels,
  topicsAtLevels,
} from "~/lib/catalog";
import { getHanziIndexes, getMeta, getWordIndexes } from "~/lib/data.client";
import { LEVELS, formatLevels, levelLabel, parseLevels, toggleLevel } from "~/lib/levels";
import {
  UNTAGGED,
  filterHanzi,
  filterWords,
  readFilters,
  toSearch,
  type Filters,
} from "~/lib/filters";
import type { Status } from "~/lib/types";
import { ThemeToggle } from "~/components/ThemeToggle";
import { CreditsFooter } from "~/components/CreditsFooter";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `HSK ${params.level?.replaceAll(",", " + ")} — Mandarin` }];
}

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const levels = parseLevels(params.level);
  const filters = readFilters(new URL(request.url).searchParams);
  const [{ radicals: allRadicals, topics: allTopics, counts }, hanzi, words] = await Promise.all([
    getMeta(),
    getHanziIndexes(levels),
    getWordIndexes(levels),
  ]);
  const radicals = radicalsAtLevels(allRadicals, hanzi, levels);
  const { topics, untagged } = topicsAtLevels(allTopics, hanzi, words, levels);
  const totals = countsFor(counts, levels);

  /**
   * Each badge counts what its own tab would list, using that tab's own
   * predicate — otherwise the bar reads "Hanzi 300" over two visible rows. The
   * indexes are already in hand, so this is a filter pass, not a fetch.
   */
  const shown = {
    hanzi: filterHanzi(
      hanzi.filter((h) => levels.includes(h.level)),
      filters,
    ).length,
    words: filterWords(
      words.filter((w) => levels.includes(w.level)),
      filters,
    ).length,
    topics: topics.filter((t) => matchesTopic(filters.q, t)).length,
    radicals: radicals.filter((r) => matchesRadical(filters.q, r)).length,
  };

  return {
    levels,
    counts: { ...totals, radicals: radicals.length, topics: topics.length },
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
  const { levels, counts, shown, radicals, topics, untagged } = loaderData;
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tab = pathname.split("/").pop() ?? "hanzi";
  const selected = formatLevels(levels);

  const toggle = (key: FilterKey, value: string) => {
    const next = new URLSearchParams(params);
    const current = next.getAll(key);
    next.delete(key);
    for (const v of current) if (v !== value) next.append(key, v);
    if (!current.includes(value)) next.append(key, value);
    next.delete("take"); // a different filter means a different list
    setParams(next, { preventScrollReset: true });
  };

  const setQ = (q: string) => {
    const next = new URLSearchParams(params);
    if (q) next.set("q", q);
    else next.delete("q");
    next.delete("take");
    setParams(next, { preventScrollReset: true, replace: true });
  };

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
    filters.radicals.length + filters.status.length + filters.standards.length + filters.topics.length;
  const search = toSearch(filters);
  const listOwnsFooter = tab === "hanzi" || tab === "words";

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur">
        <div className="flex items-center gap-4 px-4 py-2.5 lg:px-6">
          <NavLink
            to={`/hsk/${selected}/hanzi`}
            aria-label="Hanzi index"
            className="flex shrink-0 items-center gap-1.5"
          >
            <img
              src="/app-mark.png"
              alt=""
              width={64}
              height={64}
              className="size-8 rounded-lg"
            />
            <span className="han text-lg tracking-tight">汉字</span>
          </NavLink>

          {/* Levels are multi-select: study one, or both at once. The
              selection lives in the path so it stays bookmarkable. */}
          {/* Seven levels, so the boxes are compact: "HSK" labels the group
              once and each toggle carries only its number. */}
          <fieldset className="flex shrink-0 items-center gap-0.5 rounded-lg border border-line p-0.5">
            <legend className="sr-only">HSK levels</legend>
            <span aria-hidden className="px-1 text-[11px] text-ink-3">
              HSK
            </span>
            {LEVELS.map((l) => {
              const on = levels.includes(l);
              const only = on && levels.length === 1;
              return (
                <label
                  key={l}
                  title={
                    only
                      ? "At least one level must stay selected"
                      : `HSK ${levelLabel(l)}${l === 7 ? " (the wordlist merges 7-9)" : ""}`
                  }
                  className={clsx(
                    "cursor-pointer rounded-md px-1.5 py-1 text-xs font-medium transition-colors",
                    on ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunk hover:text-ink",
                    only && "cursor-default",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={only}
                    onChange={() =>
                      navigate(`/hsk/${formatLevels(toggleLevel(levels, l))}/${tab}${search}`, {
                        preventScrollReset: true,
                      })
                    }
                    className="sr-only"
                  />
                  {levelLabel(l)}
                </label>
              );
            })}
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/hsk/${formatLevels(levels.length === LEVELS.length ? [1] : LEVELS)}/${tab}${search}`,
                  { preventScrollReset: true },
                )
              }
              className="ml-0.5 rounded-md px-1.5 py-1 text-[11px] text-accent transition-colors hover:bg-sunk"
            >
              {levels.length === LEVELS.length ? "only 1" : "all"}
            </button>
          </fieldset>

          <input
            type="search"
            value={filters.q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 好, hao, hǎo or “good”…"
            aria-label="Search hanzi, pinyin or English"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none placeholder:text-ink-3 focus:border-accent"
          />

          <ThemeToggle />
        </div>

        <nav className="flex gap-1 px-4 lg:px-6">
          {(
            [
              ["hanzi", "Hanzi", shown.hanzi, counts.hanzi],
              ["words", "Words", shown.words, counts.words],
              ["topics", "Topics", shown.topics, counts.topics],
              ["radicals", "Radicals", shown.radicals, counts.radicals],
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
                  "-mb-px border-b-2 px-2 py-2 text-sm transition-colors",
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
          <FilterGroup
            label="Topic"
            active={filters.topics.length}
            onReset={() => clearGroup("topic")}
          >
            {/* Untagged first: while tagging is in progress it is the most
                useful filter on the page — it is the backlog. */}
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
              {topics.map((t) => (
                <Check
                  key={t.id}
                  checked={filters.topics.includes(t.id)}
                  onChange={() => toggle("topic", t.id)}
                  label={
                    <span className="flex w-full items-baseline gap-1.5">
                      <span className={clsx("truncate", t.count === 0 && "text-ink-3")}>
                        {t.label}
                      </span>
                      <span className="ml-auto tabular-nums text-ink-3">{t.count}</span>
                    </span>
                  }
                />
              ))}
            </div>
          </FilterGroup>

          <FilterGroup
            label="Status"
            active={filters.status.length}
            onReset={() => clearGroup("s")}
          >
            {STATUSES.map((s) => (
              <Check
                key={s}
                checked={filters.status.includes(s)}
                onChange={() => toggle("s", s)}
                label={s}
              />
            ))}
          </FilterGroup>

          <FilterGroup
            label="Also in"
            active={filters.standards.length}
            onReset={() => clearGroup("std")}
          >
            {STANDARDS.map((t) => (
              <Check
                key={t.value}
                checked={filters.standards.includes(t.value)}
                onChange={() => toggle("std", t.value)}
                label={t.label}
              />
            ))}
          </FilterGroup>

          <FilterGroup
            label={`Radical (${radicals.length})`}
            active={filters.radicals.length}
            onReset={() => clearGroup("r")}
          >
            <div className="-mx-1 max-h-[45vh] overflow-y-auto px-1">
              {radicals.map((r) => (
                <Check
                  key={r.char}
                  checked={filters.radicals.includes(r.char)}
                  onChange={() => toggle("r", r.char)}
                  label={
                    <span className="flex w-full items-baseline gap-1.5">
                      <span className="han text-base">{r.display}</span>
                      <span className="truncate text-ink-3">{r.gloss}</span>
                      <span className="ml-auto tabular-nums text-ink-3">{r.count}</span>
                    </span>
                  }
                />
              ))}
            </div>
          </FilterGroup>

        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">
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
      {!listOwnsFooter && <CreditsFooter />}
    </div>
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
        <h3 className="text-[11px] font-medium tracking-[0.12em] text-ink-3 uppercase">{label}</h3>
        {/* Only offered when the group has something to reset. */}
        {active > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-accent underline underline-offset-2 hover:no-underline"
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
      label:
        t === UNTAGGED ? <span className="italic">untagged</span> : (topicLabel(t) ?? t),
    });
  }
  for (const s of filters.status) chips.push({ key: "s", value: s, label: s });
  for (const t of filters.standards) {
    chips.push({ key: "std", value: t, label: STANDARDS.find((x) => x.value === t)?.label ?? t });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-line pb-3">
      <span className="text-[11px] tracking-[0.12em] text-ink-3 uppercase">Filtering by</span>
      {chips.map((c) => (
        <button
          key={`${c.key}:${c.value}`}
          type="button"
          onClick={() => onRemove(c.key, c.value)}
          title={`Remove this filter`}
          className="group inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pr-1.5 pl-2.5 text-xs text-ink-2 transition-colors hover:border-accent hover:text-ink"
        >
          {c.label}
          <span
            aria-hidden
            className="text-ink-3 transition-colors group-hover:text-accent"
          >
            ✕
          </span>
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 text-xs text-accent underline underline-offset-4 hover:no-underline"
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
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-ink-2 hover:bg-sunk">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-3.5 shrink-0 accent-[var(--color-accent)]"
      />
      <span className="min-w-0 flex-1">{label}</span>
    </label>
  );
}
