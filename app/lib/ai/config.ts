import { z } from "zod";
import type { OpenRouterConfig } from "./types";

export const CONFIG_STORAGE_KEY = "hanyu-ai-config-v1";

const storedSchema = z.object({
  v: z.literal(1),
  modelName: z.string(),
  apiKey: z.string(),
});

export const configInputSchema = z.object({
  modelName: z
    .string()
    .trim()
    .min(1, "Model name is required")
    .regex(/^[\w.\-/:]+$/, "Use an OpenRouter model slug such as anthropic/claude-sonnet-4"),
  apiKey: z
    .string()
    .trim()
    .min(1, "API key is required")
    .regex(/^sk-or-/, "OpenRouter keys start with sk-or-"),
});

export type ConfigInput = z.infer<typeof configInputSchema>;

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 10) return "••••";
  return `${trimmed.slice(0, 7)}…${trimmed.slice(-4)}`;
}

export function parseConfig(raw: unknown): OpenRouterConfig | null {
  const parsed = storedSchema.safeParse(raw);
  if (!parsed.success) return null;
  const input = configInputSchema.safeParse({
    modelName: parsed.data.modelName,
    apiKey: parsed.data.apiKey,
  });
  if (!input.success) return null;
  return { modelName: input.data.modelName, apiKey: input.data.apiKey };
}

export function readConfig(): OpenRouterConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return parseConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeConfig(config: OpenRouterConfig): void {
  localStorage.setItem(
    CONFIG_STORAGE_KEY,
    JSON.stringify({ v: 1, modelName: config.modelName, apiKey: config.apiKey }),
  );
}

export function clearConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}

export function hasValidConfig(config: OpenRouterConfig | null): config is OpenRouterConfig {
  return config != null && configInputSchema.safeParse(config).success;
}

export interface RemoteConfigCheck {
  ok: boolean;
  error?: string;
  supportsTools?: boolean;
}

const OPENROUTER = "https://openrouter.ai/api/v1";

/** Non-inference check: key works, and the named model exists. */
export async function validateConfigRemote(
  config: OpenRouterConfig,
  signal?: AbortSignal,
): Promise<RemoteConfigCheck> {
  const parsed = configInputSchema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid configuration" };
  }

  const headers = { Authorization: `Bearer ${parsed.data.apiKey}` };
  try {
    const keyRes = await fetch(`${OPENROUTER}/key`, { headers, signal });
    if (keyRes.status === 401) return { ok: false, error: "That API key was rejected." };
    if (!keyRes.ok) return { ok: false, error: `OpenRouter key check failed (${keyRes.status}).` };
  } catch (err) {
    if (signal?.aborted) throw err;
    return { ok: false, error: "Could not reach OpenRouter to check the key." };
  }

  try {
    const modelRes = await fetch(`${OPENROUTER}/models`, { headers, signal });
    if (!modelRes.ok) return { ok: true, supportsTools: undefined };
    const body = (await modelRes.json()) as {
      data?: { id?: string; supported_parameters?: string[] }[];
    };
    const model = body.data?.find((m) => m.id === parsed.data.modelName);
    if (!model) {
      return {
        ok: false,
        error: `Model “${parsed.data.modelName}” is not on OpenRouter.`,
      };
    }
    const supportsTools = model.supported_parameters?.includes("tools") ?? false;
    if (!supportsTools) {
      return {
        ok: false,
        error: `Model “${parsed.data.modelName}” does not advertise tool calling.`,
        supportsTools: false,
      };
    }
    return { ok: true, supportsTools: true };
  } catch (err) {
    if (signal?.aborted) throw err;
    return { ok: true, supportsTools: undefined };
  }
}
