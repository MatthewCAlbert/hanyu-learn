import { useEffect, useState } from "react";
import { PronunciationButton } from "~/components/PronunciationButton";
import { Chip } from "~/components/ui";
import { getHanziPage, getWordPage } from "~/lib/data.client";
import { entryPath } from "~/lib/compare";
import type { CorpusRef } from "~/lib/segment";
import type { HanziPage, WordPage } from "~/lib/types";

type Preview =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "word"; data: WordPage }
  | { status: "hanzi"; data: HanziPage };

const cache = new Map<string, Promise<Preview>>();

function loadPreview(ref: CorpusRef): Promise<Preview> {
  const key = `${ref.kind}:${ref.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const req = (ref.kind === "word" ? getWordPage(ref.id) : getHanziPage(ref.id)).then((data) => {
    if (!data) return { status: "missing" as const };
    return ref.kind === "word"
      ? { status: "word" as const, data: data as WordPage }
      : { status: "hanzi" as const, data: data as HanziPage };
  });
  cache.set(key, req);
  return req;
}

export function TokenPreview({
  entry,
  onClose,
}: {
  entry: CorpusRef;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<Preview>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setPreview({ status: "loading" });
    void loadPreview(entry).then((next) => {
      if (!cancelled) setPreview(next);
    });
    return () => {
      cancelled = true;
    };
  }, [entry.kind, entry.id]);

  const href = entryPath({ kind: entry.kind, id: entry.id });

  return (
    <div className="ui-card mt-3 px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {preview.status === "loading" && <p className="text-sm text-ink-3">Loading…</p>}
          {preview.status === "missing" && (
            <p className="text-sm text-ink-3">Not in this corpus.</p>
          )}
          {preview.status === "word" && <WordSummary data={preview.data} />}
          {preview.status === "hanzi" && <HanziSummary data={preview.data} />}
        </div>
        <button
          type="button"
          aria-label="Close summary"
          onClick={onClose}
          className="ui-touch inline-flex shrink-0 items-center justify-center rounded-lg px-2 text-sm text-ink-3 hover:text-ink"
        >
          ×
        </button>
      </div>
      {preview.status !== "missing" && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="ui-touch mt-2 inline-flex items-center text-sm font-medium text-accent hover:opacity-80"
        >
          View full
        </a>
      )}
    </div>
  );
}

function WordSummary({ data }: { data: WordPage }) {
  const w = data.word;
  const a = w.authored;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="han text-3xl leading-none">{w.word}</span>
        <span className="flex items-center gap-1">
          <span className="text-sm text-ink">{w.pinyin}</span>
          <PronunciationButton form={w.word} pinyin={w.pinyin} preferWordClip />
        </span>
        <Chip tone="accent">{w.extra ? "Extra" : `HSK ${w.level}`}</Chip>
      </div>
      <p className="mt-1.5 text-sm text-ink-2">{w.meanings.join("; ")}</p>
      {a && (
        <p className="mt-1 text-xs text-ink-3">
          Literally {a.literal}
          {a.actual ? ` · actually ${a.actual}` : ""}
        </p>
      )}
    </div>
  );
}

function HanziSummary({ data }: { data: HanziPage }) {
  const h = data.hanzi;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="han text-3xl leading-none">{h.char}</span>
        {h.readings.map((r) => (
          <span key={r.pinyin} className="flex items-center gap-1">
            <span className="text-sm text-ink">{r.pinyin}</span>
            <PronunciationButton form={h.char} pinyin={r.pinyin} preferWordClip={false} />
          </span>
        ))}
        <Chip tone="accent">HSK {h.level}</Chip>
      </div>
      <p className="mt-1.5 text-sm text-ink-2">{h.meanings.join("; ")}</p>
    </div>
  );
}
