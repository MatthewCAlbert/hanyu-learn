import { Link } from "react-router";
import { ToolActivityList, UsageDetails } from "~/components/ai/UsageDetails";
import { hasValidConfig } from "~/lib/ai/config";
import { useAiStore } from "~/lib/ai/store";
import type { BoundTranslation } from "~/lib/ai/translate";
import type { ToolActivity, TurnUsage } from "~/lib/ai/types";

export type TranslateAiStatus =
  | { status: "idle" }
  | { status: "running"; tools: ToolActivity[] }
  | { status: "done"; result: BoundTranslation; usage: TurnUsage; tools: ToolActivity[] }
  | { status: "error"; message: string; tools: ToolActivity[] };

export function TranslateAiPanel({
  state,
  disabled,
  variant = "text",
  onGenerate,
  onStop,
}: {
  state: TranslateAiStatus;
  disabled: boolean;
  variant?: "text" | "image";
  onGenerate: () => void;
  onStop: () => void;
}) {
  const config = useAiStore((s) => s.config);
  const ready = hasValidConfig(config);
  const image = variant === "image";

  if (!ready) {
    return (
      <div className="ui-card px-4 py-4">
        <p className="text-sm text-ink-2">
          {image
            ? "Image translation uses the OpenRouter key on this device. Add a vision-capable model in Settings."
            : "AI translation uses the OpenRouter key on this device. Add it in Settings for pinyin and other text that is not Hanzi yet."}
        </p>
        {state.status === "error" && (
          <p className="mt-2 text-sm text-accent">{state.message}</p>
        )}
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
    state.status === "done" || state.status === "error"
      ? "Retry translation"
      : image
        ? "Translate image"
        : "Translate with AI";
  const showGenerate = !image || state.status === "done" || state.status === "error";

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
        ) : showGenerate ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={disabled}
            className="ui-touch inline-flex items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40"
          >
            {label}
          </button>
        ) : null}
      </div>
      {state.status === "running" && (
        <>
          <p className="text-sm text-ink-3">{image ? "Reading image…" : "Translating…"}</p>
          <ToolActivityList tools={state.tools} />
        </>
      )}
      {state.status === "error" && (
        <p className="text-sm text-accent">{state.message}</p>
      )}
      {state.status === "done" && (
        <>
          <ToolActivityList tools={state.tools} />
          <UsageDetails usage={state.usage} />
        </>
      )}
    </div>
  );
}
