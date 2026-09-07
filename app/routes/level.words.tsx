import { Link, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/level.words";
import { getMeta, getWordIndexes } from "~/lib/data.client";
import { parseLevels } from "~/lib/levels";
import { PAGE_STEP, UNTAGGED, filterWords, readFilters, readTake, statusOf } from "~/lib/filters";
import { CreditsFooter } from "~/components/CreditsFooter";
import { Chip, Empty, StatusDot } from "~/components/ui";
import { VirtualSections, type Section } from "~/components/VirtualSections";
import { Toggle, Toolbar } from "./level.hanzi";

const CHUNK = 36;

interface Row {
  word: string;
  pinyin: string;
  meaning: string;
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

  const matched = filterWords(
    WORDS.filter((w) => levels.includes(w.level)),
    filters,
  ).sort((a, b) => (a.frequency ?? Infinity) - (b.frequency ?? Infinity));

  // Same many-to-many expansion as the hanzi list: a word with two topics is
  // placed under both headings.
  const topicOrder = new Map(TOPICS.map((t, i) => [t.id, i]));
  const ordered =
    filters.group === "topic"
      ? matched
          .flatMap((w) =>
            w.topics.length > 0 ? w.topics.map((t) => ({ w, key: t })) : [{ w, key: UNTAGGED }],
          )
          .sort(
            (a, b) =>
              (a.key === UNTAGGED ? Infinity : (topicOrder.get(a.key) ?? Infinity)) -
                (b.key === UNTAGGED ? Infinity : (topicOrder.get(b.key) ?? Infinity)) ||
              (a.w.frequency ?? Infinity) - (b.w.frequency ?? Infinity),
          )
      : matched.map((w) => ({ w, key: "" }));

  const slice = ordered.slice(0, take);
  const page = slice.map(({ w }) => w).map(
    (w): Row => ({
      word: w.word,
      pinyin: w.pinyin,
      meaning: w.meanings.slice(0, 2).join("; "),
      status: statusOf(w),
      level: w.level,
      literal: w.literal,
      transparency: w.transparency,
    }),
  );

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
      const label = key === UNTAGGED ? "Untagged" : (TOPICS.find((t) => t.id === key)?.label ?? key);
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
                <div className="sticky top-[92px] z-10 -mx-1 mb-2 flex items-baseline gap-2 bg-paper/90 px-1 py-1.5 backdrop-blur">
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
              <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {s.rows.map((r) => (
                <Link
                  key={r.word}
                  to={`/words/${encodeURIComponent(r.word)}`}
                  className="group flex flex-col rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:border-accent"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="han text-2xl group-hover:text-accent">{r.word}</span>
                    <span className="truncate text-xs text-ink-2">{r.pinyin}</span>
                    {showLevel && <span className="text-[10px] text-ink-3">HSK {r.level}</span>}
                    <StatusDot status={r.status} />
                  </div>
                  <span className="mt-0.5 truncate text-xs text-ink-2">{r.meaning}</span>
                  {r.literal && (
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-3">
                      <span className="truncate">literally “{r.literal}”</span>
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
