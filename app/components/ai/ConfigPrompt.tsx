import { Link } from "react-router";
import { useAiStore } from "~/lib/ai/store";

export function ConfigPrompt() {
  return (
    <div className="flex flex-1 flex-col justify-center px-4 py-8">
      <h2 className="text-base font-medium text-ink">Add your OpenRouter key</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        This chat runs in your browser with a key you supply. The key stays on this device in
        localStorage — it is visible to anything that can run script here.
      </p>
      <Link
        to="/settings"
        className="ui-touch mt-4 inline-flex items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-paper"
      >
        Open Settings
      </Link>
    </div>
  );
}

export function ConfigBanner() {
  const config = useAiStore((s) => s.config);
  if (config) return null;
  return <ConfigPrompt />;
}
