/**
 * Click-to-play pronunciation. Loaded only from PronunciationButton so the
 * Web Audio code is not in the initial bundle.
 *
 * Recorded clips come from CDN_AUDIO_URL (`hsk/cmn-*.mp3`, `syllabs/cmn-*.mp3`).
 * When that env is unset, or a clip is missing, fall through to speechSynthesis.
 */
import { emitPronunciation } from "./pronunciation.events";
import {
  LruCache,
  audioCdnBase,
  cdnSyllableUrl,
  cdnWordUrl,
  pinyinSyllables,
  syllableAudioKey,
} from "./pronunciation";

const BUFFER_CACHE = new LruCache<string, AudioBuffer>(32);
const inflightClip = new Map<string, Promise<ArrayBuffer>>();

let audioCtx: AudioContext | null = null;
const activeSources: AudioBufferSourceNode[] = [];
let playGeneration = 0;

export function stopPronunciation() {
  playGeneration += 1;
  for (const source of activeSources) {
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
  }
  activeSources.length = 0;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  emitPronunciation({ id: null, phase: "idle" });
}

function context(): AudioContext | null {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  audioCtx ??= new AC();
  return audioCtx;
}

async function fetchClip(url: string): Promise<ArrayBuffer> {
  const cached = inflightClip.get(url);
  if (cached) return cached;
  const req = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return res.arrayBuffer();
    })
    .catch((error) => {
      inflightClip.delete(url);
      throw error;
    });
  inflightClip.set(url, req);
  return req;
}

async function decodeClip(url: string): Promise<AudioBuffer> {
  const hit = BUFFER_CACHE.get(url);
  if (hit) return hit;
  const ctx = context();
  if (!ctx) throw new Error("no-audio-context");
  const bytes = await fetchClip(url);
  const buffer = await ctx.decodeAudioData(bytes.slice(0));
  BUFFER_CACHE.set(url, buffer);
  return buffer;
}

function zhVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const zh = voices.filter(
    (v) => /^zh\b/i.test(v.lang) || /chinese|mandarin|中文|汉语/i.test(v.name),
  );
  return zh.find((v) => v.localService) ?? zh[0];
}

async function listVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  const immediate = synth.getVoices();
  if (immediate.length > 0) return immediate;
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      synth.removeEventListener("voiceschanged", onChange);
      resolve(synth.getVoices());
    };
    const onChange = () => finish();
    const timer = window.setTimeout(finish, 700);
    synth.addEventListener("voiceschanged", onChange);
  });
}

async function canSpeakZh(): Promise<boolean> {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  return zhVoice(await listVoices()) !== undefined;
}

function speak(text: string, generation: number, id: string): Promise<"played" | "unavailable"> {
  const synth = window.speechSynthesis;
  if (!synth) return Promise.resolve("unavailable");
  return listVoices().then(
    (voices) =>
      new Promise<"played" | "unavailable">((resolve) => {
        if (generation !== playGeneration) {
          resolve("unavailable");
          return;
        }
        const voice = zhVoice(voices);
        if (!voice) {
          resolve("unavailable");
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = voice.lang || "zh-CN";
        utterance.voice = voice;
        utterance.onend = () => {
          if (generation === playGeneration) emitPronunciation({ id: null, phase: "idle" });
          resolve("played");
        };
        utterance.onerror = () => {
          if (generation === playGeneration) emitPronunciation({ id: null, phase: "idle" });
          resolve("unavailable");
        };
        emitPronunciation({ id, phase: "playing" });
        synth.speak(utterance);
      }),
  );
}

async function playBuffers(
  buffers: AudioBuffer[],
  generation: number,
  id: string,
): Promise<"played" | "unavailable"> {
  const ctx = context();
  if (!ctx || buffers.length === 0) return "unavailable";
  await ctx.resume();
  if (generation !== playGeneration) return "unavailable";

  let t = ctx.currentTime + 0.02;
  let last: AudioBufferSourceNode | null = null;
  for (const buffer of buffers) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(t);
    t += buffer.duration;
    activeSources.push(source);
    last = source;
  }
  emitPronunciation({ id, phase: "playing" });
  await new Promise<void>((resolve) => {
    if (!last) {
      resolve();
      return;
    }
    last.onended = () => resolve();
  });
  if (generation === playGeneration) {
    activeSources.length = 0;
    emitPronunciation({ id: null, phase: "idle" });
  }
  return "played";
}

function syllableKeys(pinyin: string): string[] | null {
  const expected = pinyinSyllables(pinyin);
  const keys = expected.map(syllableAudioKey).filter((key): key is string => key !== null);
  if (expected.length === 0 || keys.length !== expected.length) return null;
  return keys;
}

export async function playPronunciation(args: {
  id: string;
  form: string;
  pinyin: string;
  preferWordClip: boolean;
}): Promise<"played" | "unavailable"> {
  stopPronunciation();
  const generation = playGeneration;
  const cdn = audioCdnBase();

  if (cdn && args.preferWordClip) {
    try {
      const buffer = await decodeClip(cdnWordUrl(cdn, args.form));
      if (generation !== playGeneration) return "unavailable";
      return playBuffers([buffer], generation, args.id);
    } catch {
      /* missing word clip — try syllables, then TTS */
    }
  }

  if (cdn) {
    const keys = syllableKeys(args.pinyin);
    if (keys) {
      try {
        const buffers = await Promise.all(keys.map((key) => decodeClip(cdnSyllableUrl(cdn, key))));
        if (generation !== playGeneration) return "unavailable";
        return playBuffers(buffers, generation, args.id);
      } catch {
        /* missing syllable — TTS */
      }
    }
  }

  if (await canSpeakZh()) {
    if (generation !== playGeneration) return "unavailable";
    return speak(args.form, generation, args.id);
  }
  return "unavailable";
}
