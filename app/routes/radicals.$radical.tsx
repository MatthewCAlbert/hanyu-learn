import type { Route } from "./+types/radicals.$radical";
import { loadRadicalDetail } from "~/lib/detail-data";
import { LEVELS, formatLevels } from "~/lib/levels";
import { DetailShell } from "~/components/DetailShell";
import { RadicalDetailContent } from "~/components/details/RadicalDetailContent";
import { CompareVsButton } from "~/components/CompareVsButton";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  return [{ title: `Radical ${loaderData.radical.char} — ${loaderData.radical.gloss}` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const char = decodeURIComponent(params.radical);
  const data = await loadRadicalDetail(char);
  if (!data) throw new Response(`No radical ${char} in HSK 1–9`, { status: 404 });
  return data;
}
clientLoader.hydrate = true as const;

export default function RadicalDetail({ loaderData }: Route.ComponentProps) {
  const { radical: r } = loaderData;
  return (
    <DetailShell
      back={{ to: `/hsk/${formatLevels(LEVELS)}/radicals`, label: "All radicals" }}
      action={<CompareVsButton entry={{ kind: "radical", id: r.char }} />}
    >
      <RadicalDetailContent data={loaderData} />
    </DetailShell>
  );
}
