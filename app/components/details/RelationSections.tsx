import { DetailLink } from "~/components/DetailLink";
import { GlossaryLegend, GlossaryTerm } from "~/components/GlossaryTerm";
import { compareHref } from "~/lib/compare";
import { MEMBER_UI_LABEL } from "~/lib/lexical";
import type { GlossaryKey } from "~/lib/lexical-glossary";
import { glossaryForRelation } from "~/lib/lexical-glossary";
import type { RelationCard, RelationMemberCard } from "~/lib/types";

export function RelationSections({
  relations,
  current,
}: {
  relations: RelationCard[];
  current?: string;
}) {
  if (relations.length === 0) return null;
  return (
    <>
      {relations.map((r) => (
        <RelationBlock key={r.id} relation={r} current={current} />
      ))}
    </>
  );
}

function RelationBlock({ relation, current }: { relation: RelationCard; current?: string }) {
  const legend: GlossaryKey[] = [relation.kind];
  for (const m of relation.members) {
    if (m.role && !legend.includes(m.role)) legend.push(m.role);
    if (!m.inCorpus && !legend.includes("out-of-corpus")) legend.push("out-of-corpus");
  }
  const inCorpus = relation.members.filter((m) => m.inCorpus && m.href);
  const compareTo =
    current && inCorpus.length >= 2
      ? inCorpus.find((m) => m.form !== current)
      : inCorpus.length >= 2
        ? inCorpus[1]
        : null;
  const left = inCorpus.find((m) => m.form === current) ?? inCorpus[0];
  const compareUrl =
    left && compareTo && left.href?.startsWith("/words/") && compareTo.href?.startsWith("/words/")
      ? compareHref({
          left: { kind: "word", id: left.form },
          right: { kind: "word", id: compareTo.form },
        })
      : left && compareTo && left.href?.startsWith("/hanzi/")
        ? compareHref({
            left: { kind: "hanzi", id: left.form },
            right: { kind: "hanzi", id: compareTo.form },
          })
        : null;

  const heading = glossaryForRelation(relation.kind);

  return (
    <section className="border-t border-line pt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="ui-eyebrow">
          <GlossaryTerm term={relation.kind}>{heading.label}</GlossaryTerm>
        </h2>
        <span className="text-xs text-ink-3">{relation.label}</span>
      </div>
      <GlossaryLegend terms={legend} />
      {relation.axis && <p className="mb-3 text-xs text-ink-3">Axis: {relation.axis}</p>}
      <ul className="grid min-w-0 gap-1.5 sm:grid-cols-2">
        {relation.members.map((m) => (
          <li key={`${m.kind}:${m.form}`} className="min-w-0">
            <MemberCard member={m} current={current} />
          </li>
        ))}
      </ul>
      {relation.distinctions && (
        <p className="mt-3 text-sm text-ink-2">{relation.distinctions.split("\n\n")[0]}</p>
      )}
      {compareUrl && (
        <DetailLink
          to={compareUrl}
          className="ui-touch mt-3 inline-flex items-center rounded-lg px-3 text-sm text-accent"
        >
          Compare
        </DetailLink>
      )}
    </section>
  );
}

function MemberCard({ member, current }: { member: RelationMemberCard; current?: string }) {
  const isCurrent = member.form === current;
  const body = (
    <>
      <span className="han shrink-0 text-lg">{member.form}</span>
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="block text-xs text-ink-2">{member.pinyin}</span>
        <span className="block truncate text-xs text-ink-3">{member.meaning}</span>
      </span>
    </>
  );
  const labels = (
    <span className="flex flex-wrap gap-1">
      {member.role && (
        <GlossaryTerm term={member.role}>{MEMBER_UI_LABEL[member.role]}</GlossaryTerm>
      )}
      {!member.inCorpus && <GlossaryTerm term="out-of-corpus" />}
    </span>
  );
  return (
    <div className="ui-card flex min-w-0 flex-col gap-1 overflow-hidden px-3 py-2">
      {member.href && !isCurrent ? (
        <DetailLink
          to={member.href}
          className="ui-card-interactive -mx-3 -my-2 flex min-h-14 min-w-0 items-center gap-x-2 px-3 py-2"
        >
          {body}
        </DetailLink>
      ) : (
        <div className="flex min-h-10 min-w-0 items-center gap-x-2">{body}</div>
      )}
      {labels}
    </div>
  );
}
