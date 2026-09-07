import clsx from "clsx";
import { usageExplanation, formatUsd } from "~/lib/ai/usage";
import type { ChatMessage } from "~/lib/ai/types";

export function UsageDetails({ usage }: { usage: NonNullable<ChatMessage["usage"]> }) {
  return (
    <details className="mt-2 text-xs text-ink-3">
      <summary className="cursor-pointer select-none hover:text-ink-2">
        Usage {usage.cost != null ? `· ${formatUsd(usage.cost)}` : null}
        {usage.cachedTokens > 0 ? ` · ${usage.cachedTokens} cache reads` : null}
        {usage.cacheWriteTokens > 0 ? ` · ${usage.cacheWriteTokens} cache writes` : null}
      </summary>
      <p className="mt-1.5 leading-relaxed">{usageExplanation(usage)}</p>
    </details>
  );
}

export function ToolCallRow({
  name,
  status,
  preview,
}: {
  name: string;
  status: "running" | "done" | "error";
  preview?: string;
}) {
  return (
    <div className="rounded-lg bg-sunk px-2.5 py-1.5 text-xs text-ink-2">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "size-1.5 shrink-0 rounded-full",
            status === "running" && "bg-accent",
            status === "done" && "bg-ink-3",
            status === "error" && "bg-accent",
          )}
        />
        <span className="font-medium text-ink">{labelFor(name)}</span>
        <span className="text-ink-3">{status === "running" ? "working" : status}</span>
      </div>
      {preview ? <p className="mt-1 truncate text-ink-3">{preview}</p> : null}
    </div>
  );
}

function labelFor(name: string): string {
  if (name.includes("web_search") || name === "web_search_call") return "Web search";
  if (name === "search_corpus") return "Search corpus";
  if (name === "lookup_hanzi") return "Look up hanzi";
  if (name === "lookup_word") return "Look up word";
  if (name === "lookup_entry") return "Look up entry";
  return name;
}
