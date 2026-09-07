import type { Route } from "./+types/phonetic.$component";
import { loadPhoneticDetail } from "~/lib/detail-data";
import { LEVELS, formatLevels } from "~/lib/levels";
import { DetailShell } from "~/components/DetailShell";
import { PhoneticDetailContent } from "~/components/details/PhoneticDetailContent";
import { CompareVsButton } from "~/components/CompareVsButton";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  const { meta } = loaderData;
  return [
    { title: `Phonetic ${meta.component}${meta.pinyin[0] ? ` ${meta.pinyin[0]}` : ""} — Mandarin` },
  ];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const component = decodeURIComponent(params.component);
  const data = await loadPhoneticDetail(component);
  if (!data) throw new Response(`No phonetic series ${component} in HSK 1–9`, { status: 404 });
  return data;
}
clientLoader.hydrate = true as const;

export default function PhoneticDetail({ loaderData }: Route.ComponentProps) {
  return (
    <DetailShell
      back={{ to: `/hsk/${formatLevels(LEVELS)}/phonetics`, label: "All phonetics" }}
      action={<CompareVsButton entry={{ kind: "phonetic", id: loaderData.meta.component }} />}
    >
      <PhoneticDetailContent data={loaderData} />
    </DetailShell>
  );
}
