/**
 * PUT pruned audio-cmn clips to S3-compatible object storage (MinIO, R2,
 * Garage, Ceph, AWS, …). Signs with SigV4 using Node crypto — no SDK.
 *
 * Reads `.env` then `.env.local` (existing process env wins). Required:
 *   AUDIO_S3_ENDPOINT         API origin, e.g. https://s3.example.com:9000
 *   AUDIO_S3_BUCKET
 *   AUDIO_S3_ACCESS_KEY_ID
 *   AUDIO_S3_SECRET_ACCESS_KEY
 * Optional:
 *   AUDIO_S3_REGION           default us-east-1 (R2: auto)
 *   AUDIO_S3_ADDRESSING       path (default, {endpoint}/{bucket}/{key})
 *                             or virtual ({bucket}.{endpoint-host}/{key})
 *   AUDIO_S3_PREFIX           extra key prefix
 *   AUDIO_S3_SESSION_TOKEN
 *   AUDIO_S3_ACL              e.g. public-read (omit unless the store needs it)
 *
 * Usage: pnpm data:audio:upload -- [--dry-run] [--force]
 */
import { createHash, createHmac } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = "data/sources/audio-cmn";
const CONCURRENCY = 8;
const FETCH_ATTEMPTS = 5;
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const TRANSIENT_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_CONNECT",
  "UND_ERR_SOCKET",
]);
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export interface S3Target {
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  endpoint: string;
  addressing: "path" | "virtual";
  sessionToken?: string;
  prefix: string;
  acl?: string;
}

export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out[match[1]!] = value;
  }
  return out;
}

export function loadDotEnv(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): void {
  const merged: Record<string, string> = {};
  for (const name of [".env", ".env.local"]) {
    try {
      Object.assign(merged, parseEnvText(readFileSync(`${cwd}/${name}`, "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  for (const [key, value] of Object.entries(merged)) {
    if (env[key] === undefined) env[key] = value;
  }
}

export function awsUriEncode(value: string, encodeSlash = true): string {
  let encoded = encodeURIComponent(value).replace(/[!'()*]/g, (ch) => {
    return `%${ch.charCodeAt(0).toString(16).toUpperCase()}`;
  });
  if (!encodeSlash) encoded = encoded.replaceAll("%2F", "/");
  return encoded;
}

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function signingKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function amzDate(now: Date): { amz: string; day: string } {
  const iso = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return { amz: iso, day: iso.slice(0, 8) };
}

export function objectUrl(
  target: S3Target,
  key: string,
): { url: string; host: string; path: string } {
  const encodedKey = awsUriEncode(key, false);
  const base = new URL(target.endpoint);
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error(`AUDIO_S3_ENDPOINT must be http(s), got ${base.protocol}`);
  }
  const originPath = base.pathname.replace(/\/+$/, "");

  if (target.addressing === "virtual") {
    const host = base.hostname === target.bucket || base.hostname.startsWith(`${target.bucket}.`)
      ? base.host
      : `${target.bucket}.${base.host}`;
    const path = `${originPath}/${encodedKey}`.replace(/\/{2,}/g, "/");
    const canonicalPath = path.startsWith("/") ? path : `/${path}`;
    return { url: `${base.protocol}//${host}${canonicalPath}`, host, path: canonicalPath };
  }

  const path = `${originPath}/${awsUriEncode(target.bucket, true)}/${encodedKey}`.replace(
    /\/{2,}/g,
    "/",
  );
  const canonicalPath = path.startsWith("/") ? path : `/${path}`;
  return {
    url: `${base.protocol}//${base.host}${canonicalPath}`,
    host: base.host,
    path: canonicalPath,
  };
}

export function objectKey(prefix: string, rel: string): string {
  const trimmed = prefix.replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/${rel}` : rel;
}

export function authorizeS3(args: {
  method: string;
  target: S3Target;
  key: string;
  payloadHash: string;
  extraHeaders?: Record<string, string>;
  now?: Date;
}): { url: string; headers: Record<string, string> } {
  const { method, target, key, payloadHash, extraHeaders = {}, now = new Date() } = args;
  const { url, host, path } = objectUrl(target, key);
  const { amz, day } = amzDate(now);
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
    ...extraHeaders,
  };
  if (target.sessionToken) headers["x-amz-security-token"] = target.sessionToken;

  const signedNames = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const canonicalHeaders = signedNames
    .map((name) => {
      const match = Object.entries(headers).find(([k]) => k.toLowerCase() === name);
      return `${name}:${(match?.[1] ?? "").trim()}\n`;
    })
    .join("");
  const signedHeaders = signedNames.join(";");
  const canonical = [
    method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${day}/${target.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amz, scope, sha256Hex(canonical)].join("\n");
  const signature = hmac(signingKey(target.secretKey, day, target.region), stringToSign).toString(
    "hex",
  );
  headers.authorization = [
    `AWS4-HMAC-SHA256 Credential=${target.accessKey}/${scope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");
  return { url, headers };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in the environment or .env`);
  return value;
}

function readAddressing(): "path" | "virtual" {
  const raw = process.env.AUDIO_S3_ADDRESSING?.trim().toLowerCase();
  if (!raw || raw === "path") return "path";
  if (raw === "virtual") return "virtual";
  throw new Error(`AUDIO_S3_ADDRESSING must be path or virtual, got ${raw}`);
}

function readTarget(): S3Target {
  return {
    endpoint: requireEnv("AUDIO_S3_ENDPOINT").replace(/\/+$/, ""),
    bucket: requireEnv("AUDIO_S3_BUCKET"),
    region: process.env.AUDIO_S3_REGION?.trim() || "us-east-1",
    accessKey: requireEnv("AUDIO_S3_ACCESS_KEY_ID"),
    secretKey: requireEnv("AUDIO_S3_SECRET_ACCESS_KEY"),
    addressing: readAddressing(),
    sessionToken: process.env.AUDIO_S3_SESSION_TOKEN?.trim() || undefined,
    prefix: process.env.AUDIO_S3_PREFIX?.trim() ?? "",
    acl: process.env.AUDIO_S3_ACL?.trim() || undefined,
  };
}

async function listClips(): Promise<{ from: string; rel: string }[]> {
  const clips: { from: string; rel: string }[] = [];
  for (const dir of ["hsk", "syllabs"] as const) {
    let names: string[];
    try {
      names = await readdir(`${SRC}/${dir}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`${SRC}/${dir} is missing. Run pnpm data:audio first.`);
      }
      throw error;
    }
    for (const name of names) {
      if (!name.endsWith(".mp3")) continue;
      clips.push({ from: `${SRC}/${dir}/${name}`, rel: `${dir}/${name}` });
    }
  }
  clips.sort((a, b) => a.rel.localeCompare(b.rel));
  return clips;
}

async function mapPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i]!;
      i += 1;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "?";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function writeProgress(args: {
  done: number;
  total: number;
  uploaded: number;
  skipped: number;
  started: number;
  tty: boolean;
}): void {
  const { done, total, uploaded, skipped, started, tty } = args;
  const pct = total === 0 ? 100 : Math.min(100, Math.floor((done / total) * 100));
  const elapsed = (Date.now() - started) / 1000;
  const putRate = elapsed > 0 ? uploaded / elapsed : 0;
  const remaining = total - done;
  const eta =
    remaining <= 0 ? "0s" : putRate > 0 ? formatEta(remaining / putRate) : "?";
  const line = `${pct}%  ${done}/${total}  put ${uploaded}  skip ${skipped}  ${putRate.toFixed(1)}/s  eta ${eta}`;
  if (tty) {
    process.stdout.write(`\r${line.padEnd(78)}`);
    if (done === total) process.stdout.write("\n");
    return;
  }
  if (done === total || done % 100 === 0) console.log(line);
}

export function describeError(error: unknown): string {
  const lines: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const code = (current as NodeJS.ErrnoException).code;
      lines.push(code ? `${current.message} [${code}]` : current.message);
      current = current.cause;
      continue;
    }
    lines.push(String(current));
    break;
  }
  return lines.join("\n  caused by: ");
}

export function errorCodes(error: unknown): string[] {
  const codes: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const code = (current as NodeJS.ErrnoException).code;
      if (code) codes.push(code);
      current = current.cause;
      continue;
    }
    break;
  }
  return codes;
}

export function isTransientError(error: unknown): boolean {
  return errorCodes(error).some((code) => TRANSIENT_CODES.has(code));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function s3Fetch(
  method: string,
  url: string,
  key: string,
  init: RequestInit = {},
): Promise<Response> {
  let last: unknown;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, { ...init, method });
      if (TRANSIENT_STATUS.has(res.status) && attempt < FETCH_ATTEMPTS) {
        last = new Error(`${method} ${key} → ${res.status} ${res.statusText}`);
        await sleep(200 * 2 ** (attempt - 1));
        continue;
      }
      return res;
    } catch (error) {
      last = error;
      if (!isTransientError(error) || attempt === FETCH_ATTEMPTS) {
        throw new Error(`${method} ${key}\n  ${url}\n  ${describeError(error)}`);
      }
      await sleep(200 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`${method} ${key}\n  ${url}\n  ${describeError(last)}`);
}

async function headExists(target: S3Target, key: string): Promise<boolean> {
  const signed = authorizeS3({
    method: "HEAD",
    target,
    key,
    payloadHash: EMPTY_SHA256,
  });
  const res = await s3Fetch("HEAD", signed.url, key, { headers: signed.headers });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  const body = (await res.text()).trim();
  throw new Error(
    `HEAD ${key} → ${res.status} ${res.statusText}\n  ${signed.url}` +
      (body ? `\n  ${body.slice(0, 500)}` : ""),
  );
}

async function putObject(target: S3Target, key: string, bytes: Buffer): Promise<void> {
  const extra: Record<string, string> = {
    "content-type": "audio/mpeg",
    "content-length": String(bytes.length),
    "cache-control": "public, max-age=31536000, immutable",
  };
  if (target.acl) extra["x-amz-acl"] = target.acl;
  const signed = authorizeS3({
    method: "PUT",
    target,
    key,
    payloadHash: sha256Hex(bytes),
    extraHeaders: extra,
  });
  const res = await s3Fetch("PUT", signed.url, key, {
    headers: signed.headers,
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    const body = (await res.text()).trim();
    throw new Error(
      `PUT ${key} → ${res.status} ${res.statusText}\n  ${signed.url}` +
        (body ? `\n  ${body.slice(0, 500)}` : ""),
    );
  }
}

export async function main(): Promise<void> {
  setDefaultResultOrder("ipv4first");
  loadDotEnv();
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const target = readTarget();
  const clips = await listClips();
  if (clips.length === 0) {
    throw new Error(`No MP3s under ${SRC}/hsk or ${SRC}/syllabs. Run pnpm data:audio first.`);
  }

  let uploaded = 0;
  let skipped = 0;
  let done = 0;
  const total = clips.length;
  const started = Date.now();
  const tty = Boolean(process.stdout.isTTY);
  const sample = objectKey(target.prefix, clips[0]!.rel);
  console.log(
    `${dryRun ? "dry-run " : ""}audio → ${target.endpoint} / ${target.bucket} (${target.addressing}, ${total} clips)` +
      (target.prefix ? ` prefix ${target.prefix}` : "") +
      `\n  e.g. ${objectUrl(target, sample).url}`,
  );

  const tick = () => {
    done += 1;
    writeProgress({ done, total, uploaded, skipped, started, tty });
  };

  try {
    await mapPool(clips, CONCURRENCY, async (clip) => {
      const key = objectKey(target.prefix, clip.rel);
      if (dryRun) {
        uploaded += 1;
        tick();
        return;
      }
      if (!force && (await headExists(target, key))) {
        skipped += 1;
        tick();
        return;
      }
      const bytes = await readFile(clip.from);
      await putObject(target, key, bytes);
      uploaded += 1;
      tick();
    });
  } finally {
    if (tty && done < total) process.stdout.write("\n");
  }

  console.log(`done · uploaded ${uploaded} · skipped ${skipped}`);
  if (!dryRun) {
    console.log(
      "Set CDN_AUDIO_URL to the public origin that serves these keys (plus AUDIO_S3_PREFIX if you used one). Enable CORS GET on the bucket.",
    );
  }
}

const argv1 = process.argv[1];
const invoked =
  argv1 !== undefined && fileURLToPath(import.meta.url) === resolve(argv1);
if (invoked) {
  main().catch((error: unknown) => {
    console.error(describeError(error));
    process.exit(1);
  });
}
