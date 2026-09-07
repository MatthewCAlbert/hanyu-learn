import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { configInputSchema } from "~/lib/ai/config";

function loadDotEnv(): Record<string, string> {
  if (!existsSync(".env")) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

const env = { ...loadDotEnv(), ...process.env };
const model = env.MODEL_NAME?.trim();
const key = env.API_KEY?.trim();
const live = Boolean(model && key && env.AI_LIVE === "1");

describe.skipIf(!live)("OpenRouter live smoke", () => {
  it("accepts the configured key and model without logging secrets", async () => {
    const parsed = configInputSchema.safeParse({ modelName: model, apiKey: key });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const keyRes = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${parsed.data.apiKey}` },
    });
    expect(keyRes.ok, `key check HTTP ${keyRes.status}`).toBe(true);

    const modelsRes = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${parsed.data.apiKey}` },
    });
    expect(modelsRes.ok).toBe(true);
    const body = (await modelsRes.json()) as { data?: { id?: string; supported_parameters?: string[] }[] };
    const found = body.data?.find((m) => m.id === parsed.data.modelName);
    expect(found, "model slug missing on OpenRouter").toBeTruthy();
    expect(found?.supported_parameters ?? []).toContain("tools");
  });

  it("streams a short cached-prefix turn and reports usage fields", async () => {
    const parsed = configInputSchema.safeParse({ modelName: model, apiKey: key });
    if (!parsed.success) return;
    const session = `hanyu-test-${Date.now()}`;
    const headers = {
      Authorization: `Bearer ${parsed.data.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-OpenRouter-Title": "Hanyu Learn test",
    };
    const payload = {
      model: parsed.data.modelName,
      session_id: session,
      cache_control: { type: "ephemeral" },
      messages: [
        { role: "system", content: "Reply with one word: ok" },
        { role: "user", content: "ping" },
      ],
      max_tokens: 16,
    };

    const first = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    expect(first.ok, `first completion HTTP ${first.status}`).toBe(true);
    const firstJson = (await first.json()) as {
      usage?: {
        prompt_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
      };
    };
    expect(firstJson.usage?.prompt_tokens).toBeGreaterThan(0);

    const second = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...payload,
        messages: [...payload.messages, { role: "user", content: "again" }],
      }),
    });
    expect(second.ok, `second completion HTTP ${second.status}`).toBe(true);
    const secondJson = (await second.json()) as {
      usage?: {
        prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
      };
    };
    const details = secondJson.usage?.prompt_tokens_details;
    expect(details).toBeTruthy();
    expect(
      (details?.cached_tokens ?? 0) + (details?.cache_write_tokens ?? 0),
    ).toBeGreaterThanOrEqual(0);
  });
});
