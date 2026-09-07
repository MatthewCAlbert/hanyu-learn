import { Link } from "react-router";
import type { Route } from "./+types/level.topics";
import { matchesTopic, topicsAtLevels } from "~/lib/catalog";
import { getHanziIndexes, getMeta, getWordIndexes } from "~/lib/data.client";
import { parseLevels } from "~/lib/levels";
import { readFilters } from "~/lib/filters";
import { Empty } from "~/components/ui";
import { Toolbar } from "./level.hanzi";

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const levels = parseLevels(params.level);
  const { q } = readFilters(new URL(request.url).searchParams);
  const [{ topics: allTopics }, hanzi, words] = await Promise.all([
    getMeta(),
    getHanziIndexes(levels),
    getWordIndexes(levels),
  ]);
  const { topics, untagged, total } = topicsAtLevels(allTopics, hanzi, words, levels);

  const rows = topics
    .map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      hanzi: t.hanzi.length,
      words: t.words.length,
      count: t.hanzi.length + t.words.length,
    }))
    .filter((t) => matchesTopic(q, t));

  const tagged = rows.reduce((n, t) => n + t.count, 0);
  return { rows, untagged, total, tagged, levelPath: params.level ?? "1" };
}
clientLoader.hydrate = true as const;

export default function LevelTopics({ loaderData }: Route.ComponentProps) {
  const { rows, untagged, total, levelPath } = loaderData;
  const done = total - untagged;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <>
      <Toolbar total={rows.length} noun="topic" />

      {/*
        Tagging is authored by hand, so for most of this feature's life the
        honest headline is how much is still untagged. Lead with it rather than
        showing a page of zeros with no explanation.
      */}
      <div className="mb-5 rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-ink">
            {done.toLocaleString()} of {total.toLocaleString()} entries tagged
            <span className="text-ink-3"> · {pct}%</span>
          </span>
          <Link
            to={`/hsk/${levelPath}/hanzi?topic=untagged`}
            className="text-xs text-accent underline underline-offset-4"
          >
            {untagged.toLocaleString()} still untagged →
          </Link>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunk">
          <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        {done === 0 && (
          <p className="mt-2 text-xs text-ink-3">
            Nothing tagged at these levels yet. Topics are filled in per level — ask
            Claude Code to “tag HSK 1 by topic”, or see{" "}
            <code className="rounded bg-sunk px-1">docs/RESEARCH-PLAYBOOK.md</code>.
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty>No topic matches that search.</Empty>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => (
            <Link
              key={t.id}
              to={`/topics/${t.id}`}
              className="group flex flex-col rounded-lg border border-line bg-surface px-3 py-2.5 transition-colors hover:border-accent"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-ink group-hover:text-accent">{t.label}</span>
                <span className="ml-auto text-xs tabular-nums text-ink-3">
                  {t.count === 0 ? "—" : t.count}
                </span>
              </div>
              <span className="mt-0.5 line-clamp-2 text-[11px] text-ink-3">{t.description}</span>
              {t.count > 0 && (
                <span className="mt-1 text-[11px] text-ink-3">
                  {t.hanzi} hanzi · {t.words} words
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
