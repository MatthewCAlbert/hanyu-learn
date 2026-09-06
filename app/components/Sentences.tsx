import { useState } from "react";
import { Highlighted } from "./ui";
import type { Sentence } from "~/lib/types";

/**
 * Example sentences. Every one is guaranteed by the build to contain only
 * characters known at this entry's level, so the reader can work through it
 * without hitting anything unlearned.
 */
export function Sentences({ sentences, highlight }: { sentences: Sentence[]; highlight: string }) {
  const [expanded, setExpanded] = useState(false);
  if (sentences.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        No example sentence uses only characters from this level yet.
      </p>
    );
  }
  const shown = expanded ? sentences : sentences.slice(0, 3);
  return (
    <div className="space-y-3">
      {shown.map((s) => (
        <div key={s.id} className="border-l-2 border-line pl-3">
          <p className="han text-lg leading-relaxed">
            <Highlighted text={s.cmn} highlight={highlight} />
          </p>
          <p className="mt-0.5 flex items-baseline gap-2 text-xs text-ink-2">
            <span>{s.eng}</span>
            <a
              href={`https://tatoeba.org/en/sentences/show/${s.id}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-ink-3 hover:text-accent"
              title="View on Tatoeba"
            >
              #{s.id}
            </a>
          </p>
        </div>
      ))}
      {sentences.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-accent underline underline-offset-4"
        >
          {expanded ? "Show fewer" : `Show ${sentences.length - 3} more`}
        </button>
      )}
    </div>
  );
}
