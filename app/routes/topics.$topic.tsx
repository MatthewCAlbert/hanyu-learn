import { Link } from "react-router";
import type { Route } from "./+types/topics.$topic";
import { HANZI, WORDS, getTopic } from "~/lib/data.server";
import { LEVELS, levelLabel } from "~/lib/levels";
import { Chip, Empty, Section, StatusDot } from "~/components/ui";
import { DetailShell, Prose } from "~/components/DetailShell";
import type { Level } from "~/lib/types";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  return [{ title: `${loaderData.topic.label} — Mandarin` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const topic = getTopic(params.topic);
  if (!topic) throw new Response(`No topic “${params.topic}”`, { status: 404 });

  const members = [
    ...HANZI.filter((h) => h.topics.includes(topic.id)).map((h) => ({
      kind: "hanzi" as const,
      text: h.char,
      pinyin: h.pinyin[0] ?? "",
      meaning: h.meanings[0] ?? "",
      level: h.level,
      status: h.authored?.status ?? ("stub" as const),
      also: h.topics.filter((t) => t !== topic.id),
    })),
    ...WORDS.filter((w) => w.topics.includes(topic.id)).map((w) => ({
      kind: "word" as const,
      text: w.word,
      pinyin: w.pinyin,
      meaning: w.meanings[0] ?? "",
      level: w.level,
      status: w.authored?.status ?? ("stub" as const),
      also: w.topics.filter((t) => t !== topic.id),
    })),
  ];

  const byLevel = LEVELS.map((level) => ({
    level,
    members: members.filter((m) => m.level === level),
  })).filter((g) => g.members.length > 0);

  return { topic, byLevel, total: members.length };
}

export default function TopicDetail({ loaderData }: Route.ComponentProps) {
  const { topic, byLevel, total } = loaderData;

  return (
    <DetailShell back={{ to: "/hsk/1,2,3,4,5,6,7/topics", label: "All topics" }}>
      <h1 className="text-2xl text-ink">{topic.label}</h1>
      <p className="mt-1 text-sm text-ink-3">
        {total === 0 ? "Nothing tagged yet" : `${total} entr${total === 1 ? "y" : "ies"}`}
        <span className="text-ink-3"> · </span>
        <code className="rounded bg-sunk px-1 text-[11px]">content/topics/{topic.id}.md</code>
      </p>

      {topic.description && (
        <div className="mt-4">
          <Prose>{topic.description}</Prose>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {total === 0 ? (
          <Empty>
            No hanzi or words carry this topic yet. Add them to{" "}
            <code className="rounded bg-sunk px-1">content/topics/{topic.id}.md</code>.
          </Empty>
        ) : (
          byLevel.map(({ level, members }) => (
            <Section
              key={level}
              title={`HSK ${levelLabel(level as Level)}`}
              aside={<span className="text-[11px] text-ink-3">{members.length}</span>}
            >
              <div className="grid gap-1.5 sm:grid-cols-2">
                {members.map((m) => (
                  <Link
                    key={`${m.kind}-${m.text}`}
                    to={`/${m.kind === "hanzi" ? "hanzi" : "words"}/${encodeURIComponent(m.text)}`}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 hover:border-accent"
                  >
                    <span className="han shrink-0 text-2xl">{m.text}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-ink-2">{m.pinyin}</span>
                      <span className="block truncate text-[11px] text-ink-3">{m.meaning}</span>
                    </span>
                    {/* Shown because many-to-many membership is easy to forget. */}
                    {m.also.length > 0 && (
                      <Chip tone="quiet" title={`Also in: ${m.also.join(", ")}`}>
                        +{m.also.length}
                      </Chip>
                    )}
                    <StatusDot status={m.status} />
                  </Link>
                ))}
              </div>
            </Section>
          ))
        )}
      </div>
    </DetailShell>
  );
}
