import { Link, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/level.words";
import { getMeta, getWordIndexes } from "~/lib/data.client";
import { parseLevels } from "~/lib/levels";
import {
  PAGE_STEP,
  UNTAGGED,
  type Match,
  glossFor,
  rankOf,
  readFilters,
  readTake,
  searchWords,
  statusOf,
} from "~/lib/filters";
import { CreditsFooter } from "~/components/CreditsFooter";
import { Chip, Empty, Highlighted, StatusDot } from "~/components/ui";
import { VirtualSections, type Section } from "~/components/VirtualSections";
import { Toggle, Toolbar } from "./level.hanzi";

const CHUNK = 36;

interface Row {
  word: string;
  pinyin: string;
  meaning: string;
  /** Slice of `meaning` the search hit, for highlighting. */
  at: [number, number] | null;
  status: ReturnType<typeof statusOf>;
  level: number;
  literal: string | null;
  transparency: string | null;
}

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const levels = parseLevels(params.level);
  const url = new URL(request.url);
  const filters = readFilters(url.searchParams);
  const take = readTake(url.searchParams);
  const [{ topics: TOPICS }, WORDS] = await Promise.all([getMeta(), getWordIndexes(levels)]);

  const matched = searchWords(
    WORDS.filter((w) => levels.includes(w.level)),
    filters,
  );

  const byFreq = (a: { frequency: number | null }, b: { frequency: number | null }) =>
    (a.frequency ?? Infinity) - (b.frequency ?? Infinity);

  // Same many-to-many expansion as the hanzi list: a word with two topics is
  // placed under both headings.
  const topicOrder = new Map(TOPICS.map((t, i) => [t.id, i]));
  type Pair = { w: (typeof matched)[number]["w"]; match: Match | null; key: string };

  const pairs: Pair[] =
    filters.group === "topic"
      ? matched.flatMap(({ w, match }) =>
          w.topics.length > 0
            ? w.topics.map((key) => ({ w, match, key }))
            : [{ w, match, key: UNTAGGED }],
        )
      : matched.map(({ w, match }) => ({ w, match, key: "" }));

  const byGroup: (a: Pair, b: Pair) => number =
    filters.group === "topic"
      ? (a, b) => {
          const ra = a.key === UNTAGGED ? Infinity : (topicOrder.get(a.key) ?? Infinity);
          const rb = b.key === UNTAGGED ? Infinity : (topicOrder.get(b.key) ?? Infinity);
          return ra === rb ? 0 : ra - rb; // Infinity - Infinity is NaN
        }
      : () => 0;

  // A section sits where its strongest member does. See level.hanzi.tsx.
  const sectionRank = new Map<string, number>();
  for (const p of pairs) {
    const r = rankOf(p.match);
    const cur = sectionRank.get(p.key);
    if (cur === undefined || r < cur) sectionRank.set(p.key, r);
  }
  const bySection = (a: Pair, b: Pair) =>
    (sectionRank.get(a.key) ?? 0) - (sectionRank.get(b.key) ?? 0);

  const ordered = pairs.sort(
    (a, b) =>
      bySection(a, b) || byGroup(a, b) || rankOf(a.match) - rankOf(b.match) || byFreq(a.w, b.w),
  );

  const slice = ordered.slice(0, take);
  const page = slice.map(({ w, match }): Row => {
    const { text, at } = glossFor(w.meanings, match, 2);
    return {
      word: w.word,
      pinyin: w.pinyin,
      meaning: text,
      at,
      status: statusOf(w),
      level: w.level,
      literal: w.literal,
      transparency: w.transparency,
    };
  });

  const sections: Section<Row>[] = [];
  if (filters.group === "topic") {
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
      const label =
        key === UNTAGGED ? "Untagged" : (TOPICS.find((t) => t.id === key)?.label ?? key);
      for (let i = 0; i < rows.length; i += CHUNK) {
        sections.push({
          id: `${key}:${i}`,
          header:
            i === 0
              ? {
                  label: "",
                  route: key === UNTAGGED ? "" : `topic:${key}`,
                  gloss: label,
                  strokes: 0,
                  count: rows.length,
                }
              : null,
          rows: rows.slice(i, i + CHUNK),
        });
      }
    }
  } else {
    for (let i = 0; i < page.length; i += CHUNK) {
      sections.push({ id: `w${i}`, header: null, rows: page.slice(i, i + CHUNK) });
    }
  }

  return {
    sections,
    total: matched.length,
    placements: filters.group === "topic" ? ordered.length : null,
    shown: page.length,
    hasMore: page.length < ordered.length,
    group: filters.group,
    showLevel: levels.length > 1,
  };
}
clientLoader.hydrate = true as const;

export default function LevelWords({ loaderData }: Route.ComponentProps) {
  const { sections, total, placements, shown, hasMore, group, showLevel } = loaderData;
  const [params, setParams] = useSearchParams();
  const navigation = useNavigation();
  // A revalidation triggered by growing `take` is the "loading more" state.
  const pending = navigation.state === "loading";

  const loadMore = () => {
    const next = new URLSearchParams(params);
    next.set("take", String(shown + PAGE_STEP));
    setParams(next, { preventScrollReset: true, replace: true });
  };

  return (
    <>
      <Toolbar
        total={total}
        shown={shown}
        placements={placements}
        noun="word"
        controls={
          <Toggle
            options={[
              ["radical", "Ungrouped"],
              ["topic", "By topic"],
            ]}
            value={group === "topic" ? "topic" : "radical"}
            onChange={(v) => {
              const next = new URLSearchParams(params);
              if (v === "topic") next.set("group", "topic");
              else next.delete("group");
              next.delete("take");
              setParams(next, { preventScrollReset: true });
            }}
          />
        }
      />
      {total === 0 ? (
        <>
          <Empty>Nothing matches those filters.</Empty>
          <CreditsFooter />
        </>
      ) : (
        <VirtualSections
          sections={sections}
          hasMore={hasMore}
          pending={pending}
          onEndReached={loadMore}
          loadedLabel={`All ${total.toLocaleString()} words shown`}
          progressLabel={`${shown.toLocaleString()} of ${total.toLocaleString()}`}
          step={PAGE_STEP}
          renderSection={(s) => (
            <div className="mb-1.5">
              {s.header && (
                <div className="sticky top-(--app-header-height) z-10 -mx-1 mb-2 flex items-baseline gap-2 border-b border-line/70 bg-paper/95 px-1 py-2 backdrop-blur">
                  {s.header.route ? (
                    <Link
                      to={`/topics/${s.header.route.slice(6)}`}
                      className="text-sm font-medium text-ink hover:text-accent"
                    >
                      {s.header.gloss}
                    </Link>
                  ) : (
                    <span className="text-sm text-ink-3 italic">{s.header.gloss}</span>
                  )}
                  <span className="text-xs text-ink-3">{s.header.count}</span>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {s.rows.map((r) => (
                  <Link
                    key={r.word}
                    to={`/words/${encodeURIComponent(r.word)}`}
                    className="ui-card ui-card-interactive group flex min-h-24 min-w-0 flex-col px-3.5 py-3"
                  >
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="han shrink-0 text-2xl group-hover:text-accent">
                        {r.word}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-ink-2">{r.pinyin}</span>
                      {showLevel && (
                        <span className="shrink-0 text-xs text-ink-3">HSK {r.level}</span>
                      )}
                      <StatusDot status={r.status} />
                    </div>
                    <span title={r.meaning} className="mt-0.5 truncate text-xs text-ink-2">
                      <Highlighted text={r.meaning} at={r.at} />
                    </span>
                    {r.literal && (
                      <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
                        <span className="min-w-0 truncate">literally “{r.literal}”</span>
                        {r.transparency === "opaque" && <Chip tone="accent">opaque</Chip>}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        />
      )}
    </>
  );
}
