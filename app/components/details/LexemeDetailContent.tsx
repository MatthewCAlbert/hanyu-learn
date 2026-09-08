import { Chip, Section, StatusDot } from "~/components/ui";
import { Prose } from "~/components/DetailShell";
import { GlossaryLegend, GlossaryTerm } from "~/components/GlossaryTerm";
import { RelationSections } from "~/components/details/RelationSections";
import { MEMBER_UI_LABEL } from "~/lib/lexical";
import type { GlossaryKey } from "~/lib/lexical-glossary";
import type { LexemeDetailData } from "~/lib/detail-data";
import type { MemberUiRole } from "~/lib/types";

export function LexemeDetailContent({ data }: { data: LexemeDetailData }) {
  const { lexeme: l, relations } = data;
  const legend: GlossaryKey[] = ["out-of-corpus"];
  const roles: MemberUiRole[] = [];
  for (const m of relations.flatMap((r) => r.members)) {
    if (m.form !== l.form || !m.role) continue;
    if (!legend.includes(m.role)) legend.push(m.role);
    if (!roles.includes(m.role)) roles.push(m.role);
  }
  for (const r of relations) {
    if (!legend.includes(r.kind)) legend.push(r.kind);
  }

  return (
    <>
      <div className="ui-card flex flex-wrap items-baseline gap-4 px-4 py-5 sm:px-6">
        <span className="han text-5xl leading-none sm:text-6xl">{l.form}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg text-ink">{l.pinyin}</span>
            <Chip tone="quiet">not on HSK</Chip>
            {l.pos.map((p) => (
              <Chip key={p} tone="quiet">
                {p}
              </Chip>
            ))}
            {roles.map((role) => (
              <GlossaryTerm key={role} term={role}>
                {MEMBER_UI_LABEL[role]}
              </GlossaryTerm>
            ))}
            <span className="flex w-full items-center gap-1.5 text-xs text-ink-3 sm:ml-auto sm:w-auto">
              <StatusDot status={l.status} />
              {l.status}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-ink-2">{l.meanings.join("; ")}</p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <Section title="Textbook vs everyday">
          <GlossaryLegend terms={legend} />
          <p className="text-sm text-ink-2">
            {l.register}
            {l.contexts.length > 0 && <> · {l.contexts.join(", ")}</>}
            {l.regions.length > 0 && <> · {l.regions.join(", ")}</>}
            <> · {l.currency}</>
          </p>
          <p className="mt-2 text-xs text-ink-3">
            Register, context, region, and currency are separate facts — this is not automatically
            “slang.”
          </p>
        </Section>

        <RelationSections relations={relations} current={l.form} />

        {l.notes && (
          <Section title="Notes">
            <Prose>{l.notes}</Prose>
          </Section>
        )}

        {l.sources.length > 0 && (
          <Section title="Sources">
            <ul className="space-y-0.5 text-xs text-ink-3">
              {l.sources.map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
