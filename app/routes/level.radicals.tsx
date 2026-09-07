import { DetailLink } from "~/components/DetailLink";
import type { Route } from "./+types/level.radicals";
import { matchesRadical, radicalsAtLevels } from "~/lib/catalog";
import { getHanziIndexes, getMeta } from "~/lib/data.client";
import { parseBands } from "~/lib/levels";
import { readFilters } from "~/lib/filters";
import { Empty } from "~/components/ui";
import { Toolbar } from "./level.hanzi";

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const bands = parseBands(params.level);
  const { q } = readFilters(new URL(request.url).searchParams);
  const [{ radicals: allRadicals }, hanzi] = await Promise.all([
    getMeta(),
    getHanziIndexes(bands.levels),
  ]);

  const radicals = radicalsAtLevels(allRadicals, hanzi, bands.levels).filter((r) =>
    matchesRadical(q, r),
  );

  // Sectioned by stroke count — the index a paper dictionary would use.
  const byStrokes = [...new Set(radicals.map((r) => r.strokes))]
    .sort((a, b) => a - b)
    .map((strokes) => ({ strokes, radicals: radicals.filter((r) => r.strokes === strokes) }));

  return { byStrokes, total: radicals.length };
}
clientLoader.hydrate = true as const;

export default function LevelRadicals({ loaderData }: Route.ComponentProps) {
  const { byStrokes, total } = loaderData;
  return (
    <>
      <Toolbar total={total} noun="radical" />
      {total === 0 && <Empty>No radical matches that search.</Empty>}
      {byStrokes.map(({ strokes, radicals }) => (
        <section key={strokes} className="mb-6">
          <h2 className="ui-eyebrow mb-2">
            {strokes} stroke{strokes > 1 ? "s" : ""}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {radicals.map((r) => (
              <DetailLink
                key={r.char}
                to={`/radicals/${encodeURIComponent(r.char)}`}
                className="ui-card ui-card-interactive group flex min-h-16 items-center gap-3 px-3.5 py-2.5"
              >
                <span className="han w-8 shrink-0 text-center text-2xl group-hover:text-accent">
                  {r.display}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{r.gloss}</span>
                  <span className="block text-xs text-ink-3">
                    Kangxi #{r.number}
                    {r.variants.filter((v) => v !== r.display).length > 0 && (
                      <>
                        {" "}
                        · also{" "}
                        <span className="han">
                          {r.variants.filter((v) => v !== r.display).join(" ")}
                        </span>
                      </>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-3">{r.hanzi.length}</span>
              </DetailLink>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
