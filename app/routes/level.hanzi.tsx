import { Link, useNavigation, useSearchParams } from "react-router";
import clsx from "clsx";
import type { Route } from "./+types/level.hanzi";
import { getHanziIndexes, getMeta } from "~/lib/data.client";
import { parseLevels } from "~/lib/levels";
import { PAGE_STEP, UNTAGGED, filterHanzi, readFilters, readTake, statusOf } from "~/lib/filters";
import { Chip, Empty, StatusDot } from "~/components/ui";
import { VirtualSections, type Section } from "~/components/VirtualSections";

/** Rows per virtualized chunk. Bounded so each mounted item stays small. */
const CHUNK = 48;

interface Row {
  char: string;
  pinyin: string;
  meaning: string;
  status: ReturnType<typeof statusOf>;
  frequency: number | null;
  level: number;
}

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const levels = parseLevels(params.level);
  const url = new URL(request.url);
  const filters = readFilters(url.searchParams);
  const take = readTake(url.searchParams);
  const [{ radicals: RADICALS, topics: TOPICS }, HANZI] = await Promise.all([
    getMeta(),
    getHanziIndexes(levels),
  ]);
  const gloss = new Map(RADICALS.map((r) => [r.char, r]));

  const matched = filterHanzi(
    HANZI.filter((h) => levels.includes(h.level)),
    filters,
  );

  const byFreq = (a: { frequency: number | null }, b: { frequency: number | null }) =>
    (a.frequency ?? Infinity) - (b.frequency ?? Infinity);

  /**
   * Topic grouping is many-to-many where radical grouping is one-to-one: a
   * character with two topics belongs under both headings. So the result set is
   * expanded into (entry, group) pairs *before* ordering and slicing, which lets
   * the existing pagination work unchanged — it still slices an ordered list and
   * rebuilds sections from the slice.
   */
  const topicOrder = new Map(TOPICS.map((t, i) => [t.id, i]));
  type Pair = { h: (typeof matched)[number]; key: string };

  const ordered: Pair[] =
    filters.group === "topic"
      ? matched
          .flatMap((h) =>
            h.topics.length > 0
              ? h.topics.map((t) => ({ h, key: t }))
              : [{ h, key: UNTAGGED }],
          )
          // Untagged sorts last: it is a backlog, not a topic.
          .sort(
            (a, b) =>
              (a.key === UNTAGGED ? Infinity : (topicOrder.get(a.key) ?? Infinity)) -
                (b.key === UNTAGGED ? Infinity : (topicOrder.get(b.key) ?? Infinity)) ||
              byFreq(a.h, b.h),
          )
      : filters.group === "frequency"
        ? [...matched].sort(byFreq).map((h) => ({ h, key: "" }))
        : [...matched]
            .sort((a, b) => {
              const ra = gloss.get(a.radicalCanonical);
              const rb = gloss.get(b.radicalCanonical);
              return (
                (ra?.strokes ?? 0) - (rb?.strokes ?? 0) ||
                (ra?.number ?? 0) - (rb?.number ?? 0) ||
                byFreq(a, b)
              );
            })
            .map((h) => ({ h, key: h.radicalCanonical }));

  const slice = ordered.slice(0, take);
  const page = slice.map(
    ({ h }): Row => ({
      char: h.char,
      pinyin: h.pinyin[0] ?? "",
      meaning: h.meanings[0] ?? "",
      status: statusOf(h),
      frequency: h.frequency,
      level: h.level,
    }),
  );

  // Rebuild sections from the revealed rows only.
  const sections: Section<Row>[] = [];
  if (filters.group === "frequency") {
    for (let i = 0; i < page.length; i += CHUNK) {
      sections.push({ id: `f${i}`, header: null, rows: page.slice(i, i + CHUNK) });
    }
  } else {
    const order: string[] = [];
    const grouped = new Map<string, Row[]>();
    for (let i = 0; i < slice.length; i += 1) {
      const key = slice[i]!.key;
      const cur = grouped.get(key);
      if (cur) cur.push(page[i]!);
      else {
        grouped.set(key, [page[i]!]);
        order.push(key);
      }
    }
    for (const key of order) {
      const rows = grouped.get(key)!;
      const header = headerFor(key, rows.length);
      // Split large groups so no single mounted item gets huge; the header
      // rides on the first chunk only.
      for (let i = 0; i < rows.length; i += CHUNK) {
        sections.push({
          id: `${key}:${i}`,
          header: i === 0 ? header : null,
          rows: rows.slice(i, i + CHUNK),
        });
      }
    }
  }

  function headerFor(key: string, count: number) {
    if (filters.group === "topic") {
      if (key === UNTAGGED) {
        return { label: "—", route: "", gloss: "Untagged", strokes: 0, count };
      }
      const t = TOPICS.find((x) => x.id === key);
      return { label: "", route: `topic:${key}`, gloss: t?.label ?? key, strokes: 0, count };
    }
    const r = gloss.get(key);
    return {
      label: r?.display ?? key,
      route: key,
      gloss: r?.gloss ?? "",
      strokes: r?.strokes ?? 0,
      count,
    };
  }

  return {
    sections,
    total: matched.length,
    // With topic grouping an entry can occupy several sections, so the number of
    // placements is not the number of characters. Reported separately rather than
    // conflated.
    placements: filters.group === "topic" ? ordered.length : null,
    shown: page.length,
    hasMore: page.length < ordered.length,
    view: filters.view,
    group: filters.group,
    showLevel: levels.length > 1,
  };
}
clientLoader.hydrate = true as const;

export default function LevelHanzi({ loaderData }: Route.ComponentProps) {
  const { sections, total, placements, shown, hasMore, view, group, showLevel } = loaderData;
  const [params, setParams] = useSearchParams();
  const navigation = useNavigation();
  // A revalidation triggered by growing `take` is the "loading more" state.
  const pending = navigation.state === "loading";

  const set = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    next.delete("take"); // changing how the list is built restarts paging
    setParams(next, { preventScrollReset: true });
  };

  const loadMore = () => {
    const next = new URLSearchParams(params);
    next.set("take", String(shown + PAGE_STEP));
    // `replace` so growing the list does not fill the back stack.
    setParams(next, { preventScrollReset: true, replace: true });
  };

  return (
    <>
      <Toolbar
        total={total}
        shown={shown}
        placements={placements}
        noun="character"
        controls={
          <>
            <Toggle
              options={[
                ["radical", "By radical"],
                ["topic", "By topic"],
                ["frequency", "By frequency"],
              ]}
              value={group}
              onChange={(v) => set("group", v, "radical")}
            />
            <Toggle
              options={[
                ["grid", "Grid"],
                ["table", "Table"],
              ]}
              value={view}
              onChange={(v) => set("view", v, "grid")}
            />
          </>
        }
      />

      {total === 0 ? (
        <Empty>Nothing matches those filters.</Empty>
      ) : (
        <VirtualSections
          sections={sections}
          hasMore={hasMore}
          pending={pending}
          onEndReached={loadMore}
          loadedLabel={`All ${total.toLocaleString()} characters shown`}
          progressLabel={`${shown.toLocaleString()} of ${total.toLocaleString()}`}
          step={PAGE_STEP}
          renderSection={(s) => (
            <section className="mb-4">
              {s.header && (
                <div className="sticky top-[92px] z-10 -mx-1 mb-2 flex items-baseline gap-2 bg-paper/90 px-1 py-1.5 backdrop-blur">
                  {s.header.route.startsWith("topic:") ? (
                    <Link
                      to={`/topics/${s.header.route.slice(6)}`}
                      className="text-sm font-medium text-ink hover:text-accent"
                    >
                      {s.header.gloss}
                    </Link>
                  ) : s.header.route === "" ? (
                    <span className="text-sm text-ink-3 italic">{s.header.gloss}</span>
                  ) : (
                    <>
                      <Link
                        to={`/radicals/${encodeURIComponent(s.header.route)}`}
                        className="han text-2xl hover:text-accent"
                      >
                        {s.header.label}
                      </Link>
                      <span className="text-sm text-ink-2">{s.header.gloss}</span>
                    </>
                  )}
                  <span className="text-xs text-ink-3">
                    {s.header.strokes > 0 &&
                      `${s.header.strokes} stroke${s.header.strokes > 1 ? "s" : ""} · `}
                    {s.header.count}
                  </span>
                </div>
              )}

              {view === "grid" ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-1.5">
                  {s.rows.map((r) => (
                    <Link
                      key={r.char}
                      to={`/hanzi/${encodeURIComponent(r.char)}`}
                      className="group flex flex-col items-center rounded-lg border border-line bg-surface px-1 py-2.5 transition-colors hover:border-accent"
                    >
                      <span className="han text-3xl group-hover:text-accent">{r.char}</span>
                      <span className="mt-1 max-w-full truncate text-[11px] text-ink-2">
                        {r.pinyin}
                      </span>
                      <span className="max-w-full truncate text-[10px] text-ink-3">
                        {r.meaning}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1">
                        {showLevel && (
                          <span className="text-[9px] text-ink-3">HSK {r.level}</span>
                        )}
                        <StatusDot status={r.status} />
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {s.rows.map((r) => (
                      <tr key={r.char} className="border-b border-line/60 hover:bg-sunk">
                        <td className="w-12 py-1.5">
                          <Link
                            to={`/hanzi/${encodeURIComponent(r.char)}`}
                            className="han text-2xl hover:text-accent"
                          >
                            {r.char}
                          </Link>
                        </td>
                        <td className="w-28 text-ink-2">{r.pinyin}</td>
                        <td className="truncate text-ink-2">{r.meaning}</td>
                        {showLevel && (
                          <td className="w-14 text-right text-[11px] text-ink-3">HSK {r.level}</td>
                        )}
                        <td className="w-8 text-right">
                          <StatusDot status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        />
      )}
    </>
  );
}

export function Toolbar({
  total,
  shown,
  placements,
  noun,
  controls,
}: {
  total: number;
  shown?: number;
  /** Set when grouping can list one entry more than once. */
  placements?: number | null;
  noun: string;
  controls?: React.ReactNode;
}) {
  const counted = placements ?? total;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Chip tone="quiet">
        {shown !== undefined && shown < counted
          ? `${shown.toLocaleString()} of ${counted.toLocaleString()}`
          : counted.toLocaleString()}{" "}
        {noun}
        {counted === 1 ? "" : "s"}
      </Chip>
      {placements != null && (
        <Chip tone="quiet" title="Entries with several topics appear under each one">
          {total.toLocaleString()} distinct
        </Chip>
      )}
      <div className="ml-auto flex gap-2">{controls}</div>
    </div>
  );
}

export function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-line p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={v === value}
          className={clsx(
            "rounded-md px-2 py-0.5 text-xs transition-colors",
            v === value ? "bg-sunk text-ink" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
