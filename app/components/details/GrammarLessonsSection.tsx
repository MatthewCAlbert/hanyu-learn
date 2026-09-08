import { DetailLink } from "~/components/DetailLink";
import { Section } from "~/components/ui";
import type { GrammarLessonRef } from "~/lib/types";

export function GrammarLessonsSection({ lessons }: { lessons: GrammarLessonRef[] }) {
  if (lessons.length === 0) return null;
  return (
    <Section
      title="Grammar lessons"
      aside={<span className="text-xs text-ink-3">{lessons.length}</span>}
    >
      <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
        {lessons.map((g) => (
          <DetailLink
            key={g.id}
            to={`/grammar/${g.id}`}
            className="ui-card ui-card-interactive flex min-h-14 min-w-0 flex-col justify-center overflow-hidden px-3 py-2"
          >
            <span className="han text-base">{g.pattern}</span>
            <span className="truncate text-xs text-ink-3">
              {g.title} · HSK {g.level}
            </span>
          </DetailLink>
        ))}
      </div>
    </Section>
  );
}
