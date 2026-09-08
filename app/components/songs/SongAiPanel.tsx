import { Link } from "react-router";
import { ToolActivityList, UsageDetails } from "~/components/ai/UsageDetails";
import { hasValidConfig } from "~/lib/ai/config";
import { useAiStore } from "~/lib/ai/store";
import type { ToolActivity, TurnUsage } from "~/lib/ai/types";

export type SongAiStatus =
  | { status: "idle" }
  | { status: "running"; phase: "search" | "import"; tools: ToolActivity[] }
  | { status: "done"; phase: "search" | "import"; usage: TurnUsage; tools: ToolActivity[] }
  | { status: "error"; phase: "search" | "import"; message: string; tools: ToolActivity[] };

export function SongAiPanel({
  state,
  disabled,
  onSearch,
  onStop,
}: {
  state: SongAiStatus;
  disabled: boolean;
  onSearch: () => void;
  onStop: () => void;
}) {
  const config = useAiStore((s) => s.config);
  const ready = hasValidConfig(config);

  if (!ready) {
    return (
      <div className="ui-card px-4 py-4">
        <p className="text-sm text-ink-2">
          Song search uses the OpenRouter key on this device. Add it in Settings. The model will
          search the web for title, artist, lyrics source, and a YouTube candidate.
        </p>
        {state.status === "error" && <p className="mt-2 text-sm text-accent">{state.message}</p>}
        <Link
          to="/settings"
          className="ui-touch mt-3 inline-flex items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-paper"
        >
          Open Settings
        </Link>
      </div>
    );
  }

  const running = state.status === "running";
  const label =
    state.status === "done" || state.status === "error" ? "Search again" : "Find songs";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="ui-touch inline-flex items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onSearch}
            disabled={disabled}
            className="ui-touch inline-flex items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40"
          >
            {label}
          </button>
        )}
      </div>
      {state.status === "running" && (
        <>
          <p className="text-sm text-ink-3">
            {state.phase === "import" ? "Importing lyrics…" : "Searching for matching songs…"}
          </p>
          <ToolActivityList tools={state.tools} />
        </>
      )}
      {state.status === "error" && <p className="text-sm text-accent">{state.message}</p>}
      {state.status === "done" && (
        <>
          <ToolActivityList tools={state.tools} />
          <UsageDetails usage={state.usage} />
        </>
      )}
    </div>
  );
}
