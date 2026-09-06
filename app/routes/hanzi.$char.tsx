import { createRequire } from "node:module";
import { Link } from "react-router";
import type { Route } from "./+types/hanzi.$char";
import { HANZI, RADICALS, WORDS, getHanzi, getRadical, getTopic } from "~/lib/data.server";
import { Chip, HanziLink, Section, StatusDot } from "~/components/ui";
import { DetailShell, Prose } from "~/components/DetailShell";
import { Decomposition } from "~/components/Decomposition";
import { StrokeOrder } from "~/components/StrokeOrder";
import { Sentences } from "~/components/Sentences";

const require = createRequire(import.meta.url);

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found" }];
  return [{ title: `${loaderData.hanzi.char} ${loaderData.hanzi.pinyin[0] ?? ""} — Mandarin` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const char = decodeURIComponent(params.char);
  const hanzi = getHanzi(char);
  if (!hanzi) throw new Response(`${char} is not in HSK 1–2`, { status: 404 });

  // Stroke data comes from hanzi-writer-data at request time so the serverless
  // function does not need the generated copies on disk.
  let strokes: unknown = null;
  try {
    strokes = require(`hanzi-writer-data/${char}.json`);
  } catch {
    strokes = null;
  }

  const radical = getRadical(hanzi.radicalCanonical);

  /**
   * Authored `semantic`/`phonetic` take precedence over the upstream etymology:
   * they are the human-checked answer, and `pnpm check:content` has already
   * verified each names a component the character really contains.
   */
  const a = hanzi.authored;
  const etymology = hanzi.etymology
    ? {
        ...hanzi.etymology,
        ...(a?.semantic ? { semantic: a.semantic, semanticVisible: true } : {}),
        ...(a?.phonetic ? { phonetic: a.phonetic, phoneticVisible: true } : {}),
      }
    : a?.semantic || a?.phonetic
      ? {
          type: "ideographic" as const,
          ...(a.semantic ? { semantic: a.semantic, semanticVisible: true } : {}),
          ...(a.phonetic ? { phonetic: a.phonetic, phoneticVisible: true } : {}),
        }
      : null;

  // Glosses for the component chips in the decomposition tree.
  const glosses: Record<string, string> = {};
  for (const c of hanzi.components) {
    const asHanzi = getHanzi(c);
    if (asHanzi) glosses[c] = asHanzi.meanings[0]?.split(/[;,]/)[0]?.trim() ?? "";
    else {
      const asRadical = RADICALS.find((r) => r.char === c || r.canonical === c);
      if (asRadical) glosses[c] = asRadical.gloss;
    }
  }

  /**
   * Characters sharing this one's phonetic component. Listing them is the
   * fastest way to show that a phonetic carries sound and not meaning.
   */
  const phonetic = a?.phonetic ?? hanzi.etymology?.phonetic;
  const phoneticSeries =
    phonetic && hanzi.etymology?.phoneticVisible !== false
      ? HANZI.filter(
          (h) =>
            h.char !== hanzi.char &&
            (h.authored?.phonetic ?? h.etymology?.phonetic) === phonetic,
        ).map((h) => ({ char: h.char, pinyin: h.pinyin[0] ?? "", meaning: h.meanings[0] ?? "" }))
      : [];

  const words = hanzi.words
    .map((w) => WORDS.find((x) => x.word === w))
    .filter((w): w is NonNullable<typeof w> => Boolean(w))
    .map((w) => ({
      word: w.word,
      pinyin: w.pinyin,
      meaning: w.meanings[0] ?? "",
      level: w.level,
    }));

  const topics = hanzi.topics
    .map((id) => getTopic(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((t) => ({ id: t.id, label: t.label }));

  return { hanzi, radical, etymology, strokes, glosses, phoneticSeries, words, topics };
}

export default function HanziDetail({ loaderData }: Route.ComponentProps) {
  const { hanzi: h, radical, etymology: e, strokes, glosses, phoneticSeries, words, topics } =
    loaderData;
  const a = h.authored;

  return (
    <DetailShell back={{ to: `/hsk/${h.level}/hanzi`, label: `HSK ${h.level} hanzi` }}>
      {/* ---------------------------------------------------------- header */}
      <div className="flex flex-wrap items-start gap-6">
        <span className="han text-8xl leading-none">{h.char}</span>
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
            <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-3">
              <StatusDot status={a?.status ?? "stub"} />
              {a?.status ?? "not yet written"}
            </span>
          </div>

          {topics.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {topics.map((t) => (
                <Link
                  key={t.id}
                  to={`/topics/${t.id}`}
                  className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] leading-4 text-accent transition-opacity hover:opacity-75"
                >
                  {t.label}
                </Link>
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

          {radical && (
            <p className="mt-3 text-sm text-ink-2">
              Radical{" "}
              <Link to={`/radicals/${encodeURIComponent(radical.char)}`} className="text-accent">
                <span className="han text-base">{h.radical}</span> {radical.gloss}
              </Link>{" "}
              <span className="text-ink-3">
                · Kangxi #{radical.number}
                {h.radical !== radical.canonical && (
                  <> · written form of <span className="han">{radical.canonical}</span></>
                )}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {/* ------------------------------ how it's written / how it's built */}
        <Section title="Written & built">
          <div className="flex flex-wrap items-start gap-8">
            <StrokeOrder key={h.char} char={h.char} data={strokes as never} />
            <div className="min-w-0 flex-1">
              <Decomposition decomposition={h.decomposition} etymology={e} glosses={glosses} />
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

        {/* -------------------------------------------------------- authored */}
        {a?.etymology && (
          <Section
            title="Etymology"
            aside={
              <span className="text-[11px] text-ink-3">confidence: {a.confidence}</span>
            }
          >
            <Prose>{a.etymology}</Prose>
            {a.sources.length > 0 && (
              <ul className="mt-3 space-y-0.5 text-[11px] text-ink-3">
                {a.sources.map((s) => (
                  <li key={s}>· {s}</li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {a?.mnemonic && (
          <Section title="Mnemonic" aside={<span className="text-[11px] text-ink-3">invented aid</span>}>
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

        {/* -------------------------------------------------- phonetic series */}
        {phoneticSeries.length > 0 && (
          <Section
            title={`Phonetic series ${e?.phonetic ?? ""}`}
            aside={<span className="text-[11px] text-ink-3">same sound component</span>}
          >
            <p className="mb-3 text-xs text-ink-3">
              These share <span className="han">{e?.phonetic}</span> for its sound. Their meanings
              are unrelated — which is the point: the phonetic carries no meaning.
            </p>
            <div className="flex flex-wrap gap-2">
              {phoneticSeries.map((p) => (
                <Link
                  key={p.char}
                  to={`/hanzi/${encodeURIComponent(p.char)}`}
                  className="flex items-baseline gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 hover:border-accent"
                >
                  <span className="han text-xl">{p.char}</span>
                  <span className="text-xs text-ink-2">{p.pinyin}</span>
                  <span className="max-w-28 truncate text-[11px] text-ink-3">{p.meaning}</span>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {a?.notes && (
          <Section title="Notes">
            <Prose>{a.notes}</Prose>
          </Section>
        )}

        {/* ------------------------------------------------------ vocabulary */}
        {words.length > 0 && (
          <Section title={`Words using ${h.char}`} aside={<span className="text-[11px] text-ink-3">{words.length}</span>}>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {words.map((w) => (
                <Link
                  key={w.word}
                  to={`/words/${encodeURIComponent(w.word)}`}
                  className="flex items-baseline gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 hover:border-accent"
                >
                  <span className="han text-lg">{w.word}</span>
                  <span className="text-xs text-ink-2">{w.pinyin}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ink-3">{w.meaning}</span>
                  <Chip tone="quiet">{w.level}</Chip>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* -------------------------------------------------------- examples */}
        <Section
          title="Examples"
          aside={
            <span className="text-[11px] text-ink-3">
              only characters from HSK {h.level} and below
            </span>
          }
        >
          <Sentences sentences={h.sentences} highlight={h.char} />
        </Section>

        {h.components.length > 0 && (
          <Section title="Components">
            <div className="flex flex-wrap gap-2">
              {h.components.map((c) => (
                <HanziLink key={c} char={c} size="sm" />
              ))}
            </div>
          </Section>
        )}
      </div>
    </DetailShell>
  );
}
