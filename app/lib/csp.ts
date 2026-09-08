/**
 * CSP for the static SPA. Built from the same `CDN_AUDIO_URL` the player
 * fetches, so the audio origin is never hand-listed.
 *
 * Delivered as a `<meta http-equiv>` (and as an HTTP header in Vite
 * dev/preview). Meta cannot enforce `frame-ancestors`; Vercel still sends
 * `X-Frame-Options: DENY`.
 */
export function contentSecurityPolicy(
  cdnAudioUrl?: string,
  opts: { frameAncestors?: boolean } = {},
): string {
  const connect = ["'self'", "https://openrouter.ai"];
  const audioOrigin = httpsConnectOrigin(cdnAudioUrl);
  if (audioOrigin) connect.push(audioOrigin);

  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "frame-src https://www.youtube-nocookie.com",
    "base-uri 'self'",
  ];
  if (opts.frameAncestors !== false) directives.push("frame-ancestors 'none'");
  return directives.join("; ");
}

/** HTTPS origin of `CDN_AUDIO_URL`, or null when clips are off / not https. */
export function httpsConnectOrigin(cdnAudioUrl?: string): string | null {
  const trimmed = cdnAudioUrl?.trim().replace(/\/+$/, "") ?? "";
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
