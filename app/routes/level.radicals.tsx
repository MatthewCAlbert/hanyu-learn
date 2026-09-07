import { Link } from "react-router";
import type { Route } from "./+types/level.radicals";
import { matchesRadical, radicalsAtLevels } from "~/lib/catalog";
import { getHanziIndexes, getMeta } from "~/lib/data.client";
import { parseLevels } from "~/lib/levels";
import { readFilters } from "~/lib/filters";
import { Empty } from "~/components/ui";
import { Toolbar } from "./level.hanzi";

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const levels = parseLevels(params.level);
  const { q } = readFilters(new URL(request.url).searchParams);
  const [{ radicals: allRadicals }, hanzi] = await Promise.all([getMeta(), getHanziIndexes(levels)]);

  const radicals = radicalsAtLevels(allRadicals, hanzi, levels).filter((r) => matchesRadical(q, r));

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
          <h2 className="mb-2 text-[11px] font-medium tracking-[0.12em] text-ink-3 uppercase">
            {strokes} stroke{strokes > 1 ? "s" : ""}
          </h2>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {radicals.map((r) => (
              <Link
                key={r.char}
                to={`/radicals/${encodeURIComponent(r.char)}`}
                className="group flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 transition-colors hover:border-accent"
              >
                <span className="han w-8 shrink-0 text-center text-2xl group-hover:text-accent">
                  {r.display}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{r.gloss}</span>
                  <span className="block text-[11px] text-ink-3">
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
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
