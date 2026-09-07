import { DetailLink } from "~/components/DetailLink";
import { Chip, Section, StatusDot } from "~/components/ui";
import { Prose } from "~/components/DetailShell";
import { Decomposition } from "~/components/Decomposition";
import { StrokeOrder } from "~/components/StrokeOrder";
import { Sentences } from "~/components/Sentences";
import type { HanziDetailData } from "~/lib/detail-data";

export function HanziDetailContent({ data }: { data: HanziDetailData }) {
  const {
    hanzi: h,
    radical,
    etymology: e,
    strokes,
    glosses,
    phoneticSeries,
    words,
    topics,
    semanticRole,
    phoneticRole,
    componentHrefs,
  } = data;
  const a = h.authored;
  const radicalForm =
    radical && (h.radical === radical.display || h.radical === radical.canonical)
      ? h.radical
      : radical?.display;

  return (
    <>
      <div className="ui-card flex flex-wrap items-start gap-5 px-4 py-5 sm:gap-7 sm:px-6">
        <span className="han text-7xl leading-none sm:text-8xl">{h.char}</span>
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {h.readings.map((r) => (
              <span key={r.pinyin} className="text-lg text-ink">
                {r.pinyin}
              </span>
            ))}
            <Chip tone="accent">HSK {h.level}</Chip>
            {h.standards.map((t) => (
              <Chip key={t} tone="quiet" title="Also appears in this standard">
                {t.replace("old-", "旧 ").replace("newest-", "2026 · ")}
              </Chip>
            ))}
            {h.traditional && (
              <Chip tone="neutral" title="Traditional form">
                <span className="han">{h.traditional}</span>
              </Chip>
            )}
            <span className="flex w-full items-center gap-1.5 text-xs text-ink-3 sm:ml-auto sm:w-auto">
              <StatusDot status={a?.status ?? "stub"} />
              {a?.status ?? "not yet written"}
            </span>
          </div>

          {topics.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {topics.map((t) => (
                <DetailLink
                  key={t.id}
                  to={`/topics/${t.id}`}
                  className="ui-touch inline-flex items-center rounded-full bg-accent-soft px-3 text-xs text-accent transition-opacity hover:opacity-75 sm:min-h-8"
                >
                  {t.label}
                </DetailLink>
              ))}
            </div>
          )}

          <div className="mt-2 space-y-1">
            {h.readings.map((r) => (
              <p key={r.pinyin} className="text-sm text-ink-2">
                <span className="text-ink-3">{r.pinyin}</span> — {r.meanings.join("; ")}
              </p>
            ))}
          </div>

          {(semanticRole || phoneticRole || radical) && (
            <div className="mt-3 space-y-1 text-sm text-ink-2">
              {semanticRole && (
                <p>
                  <span className="text-ink-3">Meaning</span>{" "}
                  <RoleLink href={semanticRole.href}>
                    <span className="han text-base">{semanticRole.form}</span>
                    {semanticRole.gloss && <> · {semanticRole.gloss}</>}
                  </RoleLink>
                </p>
              )}
              {phoneticRole && (
                <p>
                  <span className="text-ink-3">Sound</span>{" "}
                  <DetailLink to={phoneticRole.href} className="text-accent">
                    <span className="han text-base">{phoneticRole.form}</span>
                    {phoneticRole.anchor !== phoneticRole.form && (
                      <>
                        {" "}
                        / <span className="han">{phoneticRole.anchor}</span>
                      </>
                    )}
                    {phoneticRole.pinyin[0] && <> {phoneticRole.pinyin[0]}</>}
                    {phoneticRole.gloss && <> · {phoneticRole.gloss}</>}
                  </DetailLink>
                </p>
              )}
              {radical && radicalForm && (
                <p>
                  <span className="text-ink-3">Dictionary radical</span>{" "}
                  <DetailLink
                    to={`/radicals/${encodeURIComponent(radical.char)}`}
                    className="text-accent"
                  >
                    <span className="han text-base">{radicalForm}</span> {radical.gloss}
                  </DetailLink>{" "}
                  <span className="text-ink-3">
                    · Kangxi #{radical.number}
                    {radicalForm !== radical.canonical && (
                      <>
                        {" "}
                        · written form of <span className="han">{radical.canonical}</span>
                      </>
                    )}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <Section title="Written & built">
          <div className="flex flex-col items-center gap-8 sm:items-start lg:flex-row">
            <StrokeOrder key={h.char} char={h.char} data={strokes as never} />
            <div className="min-w-0 flex-1">
              <Decomposition
                decomposition={h.decomposition}
                etymology={e}
                glosses={glosses}
                hrefs={componentHrefs}
              />
              {e && (
                <p className="mt-4 text-sm text-ink-2">
                  <span className="text-ink-3">{e.type}</span>
                  {e.hint && <> — {e.hint}</>}
                </p>
              )}
              {e?.phonetic && e.phoneticVisible === false && (
                <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
                  The phonetic component <span className="han">{e.phonetic}</span> was lost when
                  this character was simplified — the modern form gives no sound clue.
                </p>
              )}
            </div>
          </div>
        </Section>

        {a?.etymology && (
          <Section
            title="Etymology"
            aside={<span className="text-xs text-ink-3">confidence: {a.confidence}</span>}
          >
            <Prose>{a.etymology}</Prose>
            {a.sources.length > 0 && (
              <ul className="mt-3 space-y-0.5 text-xs text-ink-3">
                {a.sources.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {a?.mnemonic && (
          <Section
            title="Mnemonic"
            aside={<span className="text-xs text-ink-3">invented aid</span>}
          >
            <Prose>{a.mnemonic}</Prose>
          </Section>
        )}

        {!a && (
          <Section title="Etymology">
            <p className="text-sm text-ink-3">
              Not yet written. Ask Claude Code to “fill in hanzi content for HSK {h.level}”, or see{" "}
              <code className="rounded bg-sunk px-1">docs/RESEARCH-PLAYBOOK.md</code>.
            </p>
          </Section>
        )}

        {phoneticSeries.length > 0 && phoneticRole && (
          <Section
            title={
              <DetailLink to={phoneticRole.href} className="hover:text-accent">
                Phonetic series <span className="han">{e?.phonetic ?? phoneticRole.form}</span>
              </DetailLink>
            }
            aside={<span className="text-xs text-ink-3">same sound component</span>}
          >
            <p className="mb-3 text-xs text-ink-3">
              These share <span className="han">{e?.phonetic}</span> for its sound. Their meanings
              are unrelated — which is the point: the phonetic carries no meaning.
            </p>
            <div className="flex flex-wrap gap-2">
              {phoneticSeries.map((p) => (
                <DetailLink
                  key={p.char}
                  to={`/hanzi/${encodeURIComponent(p.char)}`}
                  className="ui-card ui-card-interactive ui-touch flex items-center gap-1.5 px-3"
                >
                  <span className="han text-xl">{p.char}</span>
                  <span className="text-xs text-ink-2">{p.pinyin}</span>
                  <span className="max-w-28 truncate text-xs text-ink-3">{p.meaning}</span>
                </DetailLink>
              ))}
            </div>
          </Section>
        )}

        {a?.notes && (
          <Section title="Notes">
            <Prose>{a.notes}</Prose>
          </Section>
        )}

        {words.length > 0 && (
          <Section
            title={`Words using ${h.char}`}
            aside={<span className="text-xs text-ink-3">{words.length}</span>}
          >
            <div className="grid gap-1.5 sm:grid-cols-2">
              {words.map((w) => (
                <DetailLink
                  key={w.word}
                  to={`/words/${encodeURIComponent(w.word)}`}
                  className="ui-card ui-card-interactive flex min-h-14 min-w-0 flex-wrap items-center gap-x-2 px-3 py-2"
                >
                  <span className="han text-lg">{w.word}</span>
                  <span className="text-xs text-ink-2">{w.pinyin}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{w.meaning}</span>
                  <Chip tone="quiet">{w.extra ? "Extra" : w.level}</Chip>
                </DetailLink>
              ))}
            </div>
          </Section>
        )}

        <Section
          title="Examples"
          aside={
            <span className="text-xs text-ink-3">only characters from HSK {h.level} and below</span>
          }
        >
          <Sentences sentences={h.sentences} highlight={h.char} />
        </Section>

        {h.components.length > 0 && (
          <Section title="Components">
            <div className="flex flex-wrap gap-2">
              {h.components.map((c) => {
                const href = componentHrefs[c];
                const className =
                  "han inline-flex size-11 items-center justify-center rounded-lg border border-line bg-surface text-xl text-ink";
                if (href) {
                  return (
                    <DetailLink
                      key={c}
                      to={href}
                      className={`${className} transition-colors hover:border-accent hover:text-accent`}
                    >
                      {c}
                    </DetailLink>
                  );
                }
                return (
                  <span key={c} className={className}>
                    {c}
                  </span>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </>
  );
}

function RoleLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (href) {
    return (
      <DetailLink to={href} className="text-accent">
        {children}
      </DetailLink>
    );
  }
  return <>{children}</>;
}
