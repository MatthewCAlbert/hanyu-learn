import { useEffect, useState, type FormEvent } from "react";
import { DetailShell } from "~/components/DetailShell";
import {
  clearConfig,
  configInputSchema,
  hasValidConfig,
  maskApiKey,
  readConfig,
  validateConfigRemote,
  writeConfig,
} from "~/lib/ai/config";
import { aiStore } from "~/lib/ai/store";
import type { OpenRouterConfig } from "~/lib/ai/types";

export function meta() {
  return [{ title: "Settings — Mandarin" }];
}

export default function Settings() {
  const [stored, setStored] = useState<OpenRouterConfig | null>(null);
  const [modelName, setModelName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "saved" | "cleared">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const current = readConfig();
    setStored(current);
    if (current) setModelName(current.modelName);
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsed = configInputSchema.safeParse({
      modelName,
      apiKey: apiKey.trim() || stored?.apiKey || "",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    setStatus("checking");
    const check = await validateConfigRemote(parsed.data);
    if (!check.ok) {
      setStatus("idle");
      setError(check.error ?? "Could not validate this configuration.");
      return;
    }
    writeConfig(parsed.data);
    await aiStore.getState().setConfig(parsed.data);
    setStored(parsed.data);
    setApiKey("");
    setStatus("saved");
  };

  const remove = () => {
    clearConfig();
    aiStore.getState().clearConfig();
    setStored(null);
    setModelName("");
    setApiKey("");
    setStatus("cleared");
    setError(null);
  };

  return (
    <DetailShell back={{ to: "/hsk/1/hanzi", label: "Hanzi index" }}>
      <h1 className="text-xl font-medium">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        Study chat uses OpenRouter from this browser. Enter one model slug and API key. They are
        stored in localStorage on this device only — never sent to this app’s server, because there
        isn’t one. Anything that can run script here can read the key.
      </p>

      <form onSubmit={save} className="mt-8 max-w-lg space-y-5 border-t border-line pt-6">
        <div>
          <label htmlFor="model-name" className="ui-eyebrow">
            Model
          </label>
          <input
            id="model-name"
            name="model"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="anthropic/claude-sonnet-4"
            autoComplete="off"
            className="ui-touch mt-1.5 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none placeholder:text-ink-3"
          />
        </div>
        <div>
          <label htmlFor="api-key" className="ui-eyebrow">
            OpenRouter API key
          </label>
          <input
            id="api-key"
            name="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={stored ? `Saved ${maskApiKey(stored.apiKey)}` : "sk-or-v1-…"}
            autoComplete="off"
            className="ui-touch mt-1.5 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none placeholder:text-ink-3"
          />
          {stored && (
            <p className="mt-1.5 text-xs text-ink-3">
              Leave blank to keep the saved key ({maskApiKey(stored.apiKey)}).
            </p>
          )}
        </div>
        {error && <p className="text-sm text-accent">{error}</p>}
        {status === "saved" && !error && (
          <p className="text-sm text-ink-2">Saved. The chat bubble will use this model.</p>
        )}
        {status === "cleared" && <p className="text-sm text-ink-2">Removed from this browser.</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={status === "checking"}
            className="ui-touch inline-flex items-center justify-center rounded-xl bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40"
          >
            {status === "checking" ? "Checking…" : stored ? "Update" : "Save"}
          </button>
          {hasValidConfig(stored) && (
            <button
              type="button"
              onClick={remove}
              className="ui-touch inline-flex items-center justify-center rounded-xl border border-line px-4 text-sm text-ink-2 hover:border-accent hover:text-accent"
            >
              Delete key
            </button>
          )}
        </div>
      </form>
    </DetailShell>
  );
}
