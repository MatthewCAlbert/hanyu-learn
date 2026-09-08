import clsx from "clsx";
import { usageExplanation, formatUsd } from "~/lib/ai/usage";
import type { ChatMessage, ToolActivity } from "~/lib/ai/types";

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

export function visibleToolActivities(tools: ToolActivity[]): ToolActivity[] {
  const calls = tools.filter((t) => t.name !== "function_call_output");
  return calls.length > 0 ? calls : tools;
}

export function toolActivitySummary(tools: ToolActivity[]): string {
  const list = visibleToolActivities(tools);
  if (list.length === 0) return "Tools";
  const running = list.some((t) => t.status === "running");
  const error = list.some((t) => t.status === "error");
  const status = running ? "working" : error ? "error" : "done";
  const first = list[0];
  if (list.length === 1 && first) return `${labelFor(first.name)} · ${status}`;
  return `${list.length} tools · ${status}`;
}

export function ToolActivityList({ tools }: { tools: ToolActivity[] }) {
  const list = visibleToolActivities(tools);
  if (list.length === 0) return null;
  return (
    <details className="mb-2 text-xs text-ink-3">
      <summary className="cursor-pointer select-none hover:text-ink-2">{toolActivitySummary(tools)}</summary>
      <div className="mt-1.5 space-y-1">
        {list.map((t) => (
          <ToolCallRow key={t.id} name={t.name} status={t.status} preview={t.resultPreview} />
        ))}
      </div>
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
    <div className="min-w-0 rounded-lg bg-sunk px-2.5 py-1.5 text-xs text-ink-2">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "size-1.5 shrink-0 rounded-full",
            status === "running" && "bg-accent",
            status === "done" && "bg-ink-3",
            status === "error" && "bg-accent",
          )}
        />
        <span className="min-w-0 truncate font-medium text-ink">{labelFor(name)}</span>
        <span className="shrink-0 text-ink-3">{status === "running" ? "working" : status}</span>
      </div>
      {preview ? <p className="mt-1 truncate font-mono text-ink-3">{preview}</p> : null}
    </div>
  );
}

function labelFor(name: string): string {
  if (name.includes("web_search") || name === "web_search_call") return "Web search";
  if (name === "search_corpus") return "Search corpus";
  if (name === "lookup_hanzi") return "Look up hanzi";
  if (name === "lookup_word") return "Look up word";
  if (name === "lookup_entry") return "Look up entry";
  if (name === "submit_translation") return "Submit translation";
  if (name === "submit_image_translation") return "Submit image translation";
  if (name === "submit_song_candidates") return "Submit song matches";
  if (name === "submit_song_import") return "Submit song import";
  if (name === "provider_retry") return "Retry provider";
  return name;
}
