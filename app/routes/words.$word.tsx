import type { Route } from "./+types/words.$word";
import { loadWordDetail } from "~/lib/detail-data";
import { DetailShell } from "~/components/DetailShell";
import { WordDetailContent } from "~/components/details/WordDetailContent";
import { CompareVsButton } from "~/components/CompareVsButton";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  return [{ title: `${loaderData.word.word} ${loaderData.word.pinyin} — Mandarin` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const text = decodeURIComponent(params.word);
  const page = await loadWordDetail(text);
  if (!page) throw new Response(`${text} is not in HSK 1–9`, { status: 404 });
  return page;
}
clientLoader.hydrate = true as const;

export default function WordDetail({ loaderData }: Route.ComponentProps) {
  const { word: w } = loaderData;
  return (
    <DetailShell
      back={{ to: `/hsk/${w.level}/words`, label: `HSK ${w.level} words` }}
      action={<CompareVsButton entry={{ kind: "word", id: w.word }} />}
    >
      <WordDetailContent data={loaderData} />
    </DetailShell>
  );
}
