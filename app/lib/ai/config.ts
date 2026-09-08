import { z } from "zod";
import {
  CONFIG_SAMPLING_DEFAULTS,
  REASONING_EFFORTS,
  VERBOSITY_LEVELS,
  type OpenRouterConfig,
  type ReasoningEffort,
  type Verbosity,
} from "./types";

export const CONFIG_STORAGE_KEY = "hanyu-ai-config-v1";

const samplingSchema = z.object({
  reasoning: z.boolean(),
  reasoningEffort: z.enum(REASONING_EFFORTS),
  verbosity: z.enum(VERBOSITY_LEVELS),
});

const storedSchema = z.object({
  v: z.literal(1),
  modelName: z.string(),
  apiKey: z.string(),
  reasoning: z.boolean().optional(),
  reasoningEffort: z.enum(REASONING_EFFORTS).optional(),
  verbosity: z.enum(VERBOSITY_LEVELS).optional(),
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
  reasoning: z.boolean().default(CONFIG_SAMPLING_DEFAULTS.reasoning),
  reasoningEffort: z.enum(REASONING_EFFORTS).default(CONFIG_SAMPLING_DEFAULTS.reasoningEffort),
  verbosity: z.enum(VERBOSITY_LEVELS).default(CONFIG_SAMPLING_DEFAULTS.verbosity),
});

export type ConfigInput = z.infer<typeof configInputSchema>;

export function withSamplingDefaults(
  config: Pick<OpenRouterConfig, "modelName" | "apiKey"> & Partial<OpenRouterConfig>,
): OpenRouterConfig {
  const sampling = samplingSchema.parse({
    reasoning: config.reasoning ?? CONFIG_SAMPLING_DEFAULTS.reasoning,
    reasoningEffort: config.reasoningEffort ?? CONFIG_SAMPLING_DEFAULTS.reasoningEffort,
    verbosity: config.verbosity ?? CONFIG_SAMPLING_DEFAULTS.verbosity,
  });
  return {
    modelName: config.modelName,
    apiKey: config.apiKey,
    ...sampling,
  };
}

/** Wire shape for OpenRouter Responses `reasoning` + `text.verbosity`. */
export function samplingFromConfig(config: OpenRouterConfig): {
  reasoning: { enabled: boolean; effort?: ReasoningEffort };
  text: { verbosity: Verbosity };
} {
  return {
    reasoning: config.reasoning
      ? { enabled: true, effort: config.reasoningEffort }
      : { enabled: false },
    text: { verbosity: config.verbosity },
  };
}

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
  return withSamplingDefaults({
    modelName: input.data.modelName,
    apiKey: input.data.apiKey,
    reasoning: parsed.data.reasoning,
    reasoningEffort: parsed.data.reasoningEffort,
    verbosity: parsed.data.verbosity,
  });
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
  const next = withSamplingDefaults(config);
  localStorage.setItem(
    CONFIG_STORAGE_KEY,
    JSON.stringify({
      v: 1,
      modelName: next.modelName,
      apiKey: next.apiKey,
      reasoning: next.reasoning,
      reasoningEffort: next.reasoningEffort,
      verbosity: next.verbosity,
    }),
  );
}

export function clearConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}

export function hasValidConfig(config: OpenRouterConfig | null): config is OpenRouterConfig {
  return config != null && configInputSchema.safeParse(config).success;
}

const OPENROUTER = "https://openrouter.ai/api/v1";

/** True when OpenRouter lists `image` among the model's input modalities. */
export function modelAcceptsImageInput(model: unknown): boolean {
  if (!model || typeof model !== "object") return false;
  const rec = model as Record<string, unknown>;
  const arch =
    rec.architecture && typeof rec.architecture === "object"
      ? (rec.architecture as Record<string, unknown>)
      : null;
  const mods = arch?.input_modalities ?? rec.input_modalities;
  if (!Array.isArray(mods)) return false;
  return mods.some((entry) => {
    if (entry === "image") return true;
    if (entry && typeof entry === "object" && "type" in entry) {
      return (entry as { type?: unknown }).type === "image";
    }
    return false;
  });
}

export async function checkModelImageInput(
  config: OpenRouterConfig,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = configInputSchema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid configuration" };
  }
  const headers = { Authorization: `Bearer ${parsed.data.apiKey}` };
  try {
    const modelRes = await fetch(`${OPENROUTER}/models`, { headers, signal });
    if (!modelRes.ok) return { ok: true };
    const body = (await modelRes.json()) as { data?: unknown[] };
    const model = body.data?.find(
      (row) => row && typeof row === "object" && (row as { id?: unknown }).id === parsed.data.modelName,
    );
    if (!model) {
      return { ok: false, error: `Model “${parsed.data.modelName}” is not on OpenRouter.` };
    }
    if (!modelAcceptsImageInput(model)) {
      return {
        ok: false,
        error: "This model does not accept images. Choose a vision-capable model in Settings.",
      };
    }
    return { ok: true };
  } catch (err) {
    if (signal?.aborted) throw err;
    return { ok: true };
  }
}

export interface RemoteConfigCheck {
  ok: boolean;
  error?: string;
  supportsTools?: boolean;
}

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
