import type { Route } from "./+types/topics.$topic";
import { loadTopicDetail } from "~/lib/detail-data";
import { LEVELS, formatLevels } from "~/lib/levels";
import { DetailShell } from "~/components/DetailShell";
import { TopicDetailContent } from "~/components/details/TopicDetailContent";
import { CompareVsButton } from "~/components/CompareVsButton";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  return [{ title: `${loaderData.topic.label} — Mandarin` }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const data = await loadTopicDetail(params.topic);
  if (!data) throw new Response(`No topic “${params.topic}”`, { status: 404 });
  return data;
}
clientLoader.hydrate = true as const;

export default function TopicDetail({ loaderData }: Route.ComponentProps) {
  return (
    <DetailShell
      back={{ to: `/hsk/${formatLevels(LEVELS)}/topics`, label: "All topics" }}
      action={<CompareVsButton entry={{ kind: "topic", id: loaderData.topic.id }} />}
    >
      <TopicDetailContent data={loaderData} />
    </DetailShell>
  );
}
