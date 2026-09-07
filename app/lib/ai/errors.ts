export function normalizeAgentError(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") return "Stopped.";
  if (err && typeof err === "object" && "name" in err && err.name === "AbortError") {
    return "Stopped.";
  }
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Something went wrong.";
  if (/abort/i.test(message)) return "Stopped.";
  if (/401|unauthorized|invalid.*key/i.test(message)) {
    return "OpenRouter rejected the API key. Check it in Settings.";
  }
  if (/402|payment|credits/i.test(message)) {
    return "OpenRouter reports insufficient credits on this key.";
  }
  if (/429|rate limit/i.test(message)) return "OpenRouter is rate-limiting this key. Try again shortly.";
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Could not reach OpenRouter. Check the network connection.";
  }
  return message;
}

export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError") {
    return true;
  }
  return /abort/i.test(err instanceof Error ? err.message : String(err ?? ""));
}
