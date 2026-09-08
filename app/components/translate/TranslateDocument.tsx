import clsx from "clsx";
import { LuSparkles } from "react-icons/lu";
import { Chip } from "~/components/ui";
import { entryPath } from "~/lib/compare";
import type { BoundParagraph } from "~/lib/ai/translate";
import type { CorpusCandidate, CorpusRef, TextAnalysis, TextSpan } from "~/lib/segment";
import { TokenPreview } from "./TokenPreview";

export type DetailMode = "embed" | "direct";

export interface TokenSelection {
  spanId: string;
  ref: CorpusRef;
}

export function TranslateDocument({
  analysis,
  mode,
  selected,
  onSelect,
  translations,
  headings,
  onAddToChat,
}: {
  analysis: TextAnalysis;
  mode: DetailMode;
  selected: TokenSelection | null;
  onSelect: (next: TokenSelection | null) => void;
  translations?: BoundParagraph[] | null;
  headings?: { blockId: string; label: string; targetId?: string }[];
  onAddToChat?: (text: string) => void;
}) {
  const byBlock = new Map((translations ?? []).map((p) => [p.id, p]));
  const headingByBlock = new Map((headings ?? []).map((h) => [h.blockId, h]));
  const lyricLayout = (headings?.length ?? 0) > 0;
  return (
    <div className="space-y-6">
      {analysis.blocks.map((block) => {
        if (block.text === "" && block.spans.length === 0) {
          return <div key={block.id} className="h-3" aria-hidden />;
        }
        const translation = byBlock.get(block.id);
        const selectedInBlock =
          selected && block.spans.some((s) => s.id === selected.spanId) ? selected : null;
        const heading = headingByBlock.get(block.id);
        return (
          <section key={block.id} className="grid gap-3 lg:grid-cols-2">
            {heading ? (
              <h3
                id={heading.targetId}
                className={clsx(
                  "ui-eyebrow lg:col-span-2",
                  heading.targetId &&
                    "scroll-mt-[calc(var(--app-header-height,0px)+3.75rem)]",
                )}
              >
                {heading.label}
              </h3>
            ) : null}
            <div>
              {lyricLayout ? null : <p className="ui-eyebrow">Source</p>}
              <div className={lyricLayout ? "flex flex-wrap items-start gap-1.5" : "mt-2 flex flex-wrap items-start gap-1.5"}>
                {block.spans.map((span) => (
                  <SpanCluster
                    key={span.id}
                    span={span}
                    mode={mode}
                    selected={selected}
                    onSelect={onSelect}
                    noted={Boolean(translation?.notes.some((n) => n.spanId === span.id))}
                  />
                ))}
              </div>
              {mode === "embed" && selectedInBlock && (
                <TokenPreview
                  entry={selectedInBlock.ref}
                  onClose={() => onSelect(null)}
                />
              )}
            </div>
            {(translation || onAddToChat) && (
              <div className={onAddToChat ? "flex min-w-0 items-start gap-2" : undefined}>
                {onAddToChat ? (
                  <button
                    type="button"
                    aria-label={`Add lyric line to chat: ${block.text}`}
                    onClick={() => onAddToChat(block.text)}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-sunk hover:text-accent"
                  >
                    <LuSparkles className="size-3.5" aria-hidden />
                  </button>
                ) : null}
                {translation ? (
                  <div className="min-w-0 flex-1">
                    {lyricLayout ? null : <p className="ui-eyebrow">Translation</p>}
                    <p className={lyricLayout ? "text-[15px] leading-7 text-ink" : "mt-2 text-[15px] leading-7 text-ink"}>
                      {translation.translation}
                    </p>
                    {translation.notes.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {translation.notes.map((note) => (
                          <li key={`${note.spanId ?? "p"}:${note.text}`} className="text-xs leading-5 text-ink-2">
                            {note.span ? (
                              <button
                                type="button"
                                className="han mr-1.5 text-accent hover:opacity-80"
                                onClick={() => {
                                  if (!note.span?.ref || !note.spanId) return;
                                  if (mode === "direct") {
                                    window.open(
                                      entryPath({ kind: note.span.ref.kind, id: note.span.ref.id }),
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                    return;
                                  }
                                  onSelect({ spanId: note.spanId, ref: note.span.ref });
                                }}
                              >
                                {note.span.text}
                              </button>
                            ) : null}
                            {note.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function SpanCluster({
  span,
  mode,
  selected,
  onSelect,
  noted,
}: {
  span: TextSpan;
  mode: DetailMode;
  selected: TokenSelection | null;
  onSelect: (next: TokenSelection | null) => void;
  noted: boolean;
}) {
  if (span.kind === "punct" || span.kind === "other") {
    return (
      <span className="inline-flex min-h-11 items-center px-0.5 text-lg text-ink-2">{span.text}</span>
    );
  }

  const isSelected = selected?.spanId === span.id;
  const extras = span.candidates.filter(
    (c) => !(span.ref && c.kind === span.ref.kind && c.text === span.ref.id),
  );

  return (
    <div
      className={clsx(
        "inline-flex min-w-11 flex-col items-stretch rounded-xl px-1 py-1",
        isSelected && "bg-accent-soft",
        noted && !isSelected && "ring-1 ring-accent/40 ring-inset",
      )}
    >
      <PrimaryToken span={span} mode={mode} selected={isSelected} onSelect={onSelect} />
      {span.summary && (
        <p className="max-w-28 truncate px-0.5 text-[11px] leading-4 text-ink-3" title={span.summary.meaning}>
          {span.summary.pinyin}
          {span.summary.meaning ? ` · ${span.summary.meaning}` : ""}
        </p>
      )}
      {span.kind === "unknown" && !span.summary && (
        <p className="px-0.5 text-[11px] leading-4 text-ink-3">Not in corpus</p>
      )}
      {extras.length > 0 && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {extras.slice(0, 6).map((c) => (
            <CandidateLink
              key={c.id}
              candidate={c}
              spanId={span.id}
              mode={mode}
              active={selected?.spanId === span.id && selected.ref.id === c.text && selected.ref.kind === c.kind}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PrimaryToken({
  span,
  mode,
  selected,
  onSelect,
}: {
  span: TextSpan;
  mode: DetailMode;
  selected: boolean;
  onSelect: (next: TokenSelection | null) => void;
}) {
  const className = clsx(
    "ui-touch inline-flex min-h-11 items-center justify-center rounded-lg border px-1.5 han text-2xl leading-none",
    selected ? "border-accent bg-surface text-ink" : "border-line bg-surface text-ink hover:border-accent",
    span.kind === "unknown" && "border-dashed",
  );

  if (!span.ref) {
    return (
      <span className={className} title="Not in this corpus">
        {span.text}
      </span>
    );
  }

  if (mode === "direct") {
    return (
      <a
        href={entryPath({ kind: span.ref.kind, id: span.ref.id })}
        target="_blank"
        rel="noreferrer"
        className={className}
      >
        {span.text}
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() =>
        onSelect(selected ? null : { spanId: span.id, ref: span.ref as CorpusRef })
      }
      className={className}
    >
      {span.text}
    </button>
  );
}

function CandidateLink({
  candidate,
  spanId,
  mode,
  active,
  onSelect,
}: {
  candidate: CorpusCandidate;
  spanId: string;
  mode: DetailMode;
  active: boolean;
  onSelect: (next: TokenSelection | null) => void;
}) {
  const ref: CorpusRef = { kind: candidate.kind, id: candidate.text };
  const label = `${candidate.text} ${candidate.summary.pinyin}`;
  const className = clsx(
    "ui-touch inline-flex items-center gap-1 rounded-lg px-1 text-left text-[11px] leading-4 text-ink-2 hover:text-accent",
    active && "text-accent",
  );

  if (mode === "direct") {
    return (
      <a
        href={entryPath({ kind: ref.kind, id: ref.id })}
        target="_blank"
        rel="noreferrer"
        className={className}
        title={candidate.summary.meaning}
      >
        <span className="han text-sm">{candidate.text}</span>
        <Chip tone="quiet">{candidate.kind === "word" ? "word" : "hanzi"}</Chip>
        <span className="sr-only">{label}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      title={candidate.summary.meaning}
      onClick={() => onSelect(active ? null : { spanId, ref })}
      className={className}
    >
      <span className="han text-sm">{candidate.text}</span>
      <span className="truncate">{candidate.summary.pinyin}</span>
    </button>
  );
}
