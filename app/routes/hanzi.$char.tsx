import { Link } from "react-router";
import type { Route } from "./+types/hanzi.$char";
import { loadHanziDetail } from "~/lib/detail-data";
import { DetailShell } from "~/components/DetailShell";
import { HanziDetailContent } from "~/components/details/HanziDetailContent";
import { CompareVsButton } from "~/components/CompareVsButton";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  return [{ title: `${loaderData.hanzi.char} ${loaderData.hanzi.pinyin[0] ?? ""} — Mandarin` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const char = decodeURIComponent(params.char);
  const data = await loadHanziDetail(char);
  if (!data) throw new Response(`${char} is not in HSK 1–9`, { status: 404 });
  return data;
}
clientLoader.hydrate = true as const;

export default function HanziDetail({ loaderData }: Route.ComponentProps) {
  const { hanzi: h } = loaderData;
  return (
    <DetailShell
      back={{ to: `/hsk/${h.level}/hanzi`, label: `HSK ${h.level} hanzi` }}
      action={<CompareVsButton entry={{ kind: "hanzi", id: h.char }} />}
    >
      <HanziDetailContent data={loaderData} />
    </DetailShell>
  );
}
