import { Link } from "react-router";
import { levelLabel } from "~/lib/levels";
import { Chip, Empty, Section, StatusDot } from "~/components/ui";
import { Prose } from "~/components/DetailShell";
import type { TopicDetailData, TopicMember } from "~/lib/detail-data";
import type { Level } from "~/lib/types";

export function TopicDetailContent({ data }: { data: TopicDetailData }) {
  const { topic, byLevel, extra, total } = data;

  return (
    <>
      <div className="ui-card px-4 py-5 sm:px-6">
        <h1 className="text-2xl text-ink">{topic.label}</h1>
        <p className="mt-1 text-sm text-ink-3">
          {total === 0 ? "Nothing tagged yet" : `${total} entr${total === 1 ? "y" : "ies"}`}
          <span className="text-ink-3"> · </span>
          <code className="rounded bg-sunk px-1 text-xs">content/topics/{topic.id}.md</code>
        </p>

        {topic.description && (
          <div className="mt-4">
            <Prose>{topic.description}</Prose>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-6">
        {total === 0 ? (
          <Empty>
            No hanzi or words carry this topic yet. Add them to{" "}
            <code className="rounded bg-sunk px-1">content/topics/{topic.id}.md</code>.
          </Empty>
        ) : (
          <>
            {byLevel.map(({ level, members }) => (
              <Section
                key={level}
                title={`HSK ${levelLabel(level as Level)}`}
                aside={<span className="text-xs text-ink-3">{members.length}</span>}
              >
                <MemberGrid members={members} />
              </Section>
            ))}
            {extra.length > 0 && (
              <Section
                title="Extra"
                aside={<span className="text-xs text-ink-3">{extra.length}</span>}
              >
                <MemberGrid members={extra} />
              </Section>
            )}
          </>
        )}
      </div>
    </>
  );
}

function MemberGrid({ members }: { members: TopicMember[] }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {members.map((m) => (
        <Link
          key={`${m.kind}-${m.text}`}
          to={`/${m.kind === "hanzi" ? "hanzi" : "words"}/${encodeURIComponent(m.text)}`}
          className="ui-card ui-card-interactive flex min-h-16 flex-wrap items-center gap-3 px-3 py-2"
        >
          <span className="han shrink-0 text-2xl">{m.text}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-ink-2">{m.pinyin}</span>
            <span className="block truncate text-xs text-ink-3">{m.meaning}</span>
          </span>
          {m.also.length > 0 && (
            <Chip tone="quiet" title={`Also in: ${m.also.join(", ")}`}>
              +{m.also.length}
            </Chip>
          )}
          <StatusDot status={m.status} />
        </Link>
      ))}
    </div>
  );
}
