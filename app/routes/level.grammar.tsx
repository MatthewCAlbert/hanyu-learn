import { DetailLink } from "~/components/DetailLink";
import type { Route } from "./+types/level.grammar";
import { grammarAtLevels, matchesGrammar } from "~/lib/grammar";
import { getGrammarIndexes } from "~/lib/data.client";
import { LEVELS, levelLabel, parseBands } from "~/lib/levels";
import { readFilters, statusOf } from "~/lib/filters";
import { CatalogEmpty } from "~/components/translate/TranslateSearchHint";
import { Chip, StatusDot } from "~/components/ui";
import { Toolbar } from "./level.hanzi";

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const bands = parseBands(params.level);
  const filters = readFilters(new URL(request.url).searchParams);
  const grammar = await getGrammarIndexes(bands.levels);
  const rows = grammarAtLevels(grammar, bands.levels).filter(
    (g) =>
      matchesGrammar(filters.q, g) &&
      (filters.status.length === 0 || filters.status.includes(statusOf(g))),
  );

  const groups = LEVELS.filter((level) => bands.levels.includes(level))
    .map((level) => ({
      level,
      lessons: rows.filter((g) => g.level === level),
    }))
    .filter((group) => group.lessons.length > 0);

  return { groups, total: rows.length, extraOnly: bands.levels.length === 0 };
}
clientLoader.hydrate = true as const;

export default function LevelGrammar({ loaderData }: Route.ComponentProps) {
  const { groups, total, extraOnly } = loaderData;

  return (
    <>
      <Toolbar total={total} noun="lesson" />

      {extraOnly ? (
        <p className="mb-4 text-sm text-ink-3">
          Grammar is authored per HSK band. Turn on a level to see its curriculum.
        </p>
      ) : null}

      {total === 0 ? (
        <CatalogEmpty
          fallback={
            extraOnly
              ? "Grammar is not part of Extra."
              : "No grammar lesson matches that search."
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map(({ level, lessons }) => (
            <section key={level}>
              <h2 className="ui-eyebrow mb-3">
                HSK {levelLabel(level)}
                <span className="ml-2 font-normal text-ink-3">{lessons.length}</span>
              </h2>
              <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {lessons.map((g) => (
                  <li key={g.id}>
                    <DetailLink
                      to={`/grammar/${g.id}`}
                      className="ui-card ui-card-interactive group flex min-h-24 flex-col px-3.5 py-3"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="han text-lg text-ink group-hover:text-accent">
                          {g.pattern}
                        </span>
                        <span className="ml-auto flex items-center gap-1.5">
                          <Chip tone="quiet">{g.order}</Chip>
                          <StatusDot status={g.status} />
                        </span>
                      </div>
                      <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-3">
                        {g.title}
                      </span>
                      {(g.hanzi.length > 0 || g.words.length > 0) && (
                        <span className="mt-1 truncate text-xs text-ink-3">
                          {[...g.hanzi, ...g.words].join(" ")}
                        </span>
                      )}
                    </DetailLink>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
