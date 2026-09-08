import { describe, expect, it } from "vitest";
import {
  LruCache,
  audioCdnBase,
  cdnSyllableUrl,
  cdnWordUrl,
  pinyinSyllables,
  resolvePronunciation,
  syllableAudioKey,
  type PronunciationAvailability,
} from "~/lib/pronunciation";

function availability(opts: {
  words?: string[];
  syllables?: string[];
  canSpeak?: boolean;
}): PronunciationAvailability {
  const words = new Set(opts.words ?? []);
  const syllables = new Set(opts.syllables ?? []);
  return {
    hasWord: (form) => words.has(form),
    hasSyllable: (key) => syllables.has(key),
    canSpeak: opts.canSpeak ?? false,
  };
}

describe("pinyinSyllables", () => {
  it("splits spaced readings and keeps tones", () => {
    expect(pinyinSyllables("hǎo")).toEqual([{ base: "hao", tone: 3 }]);
    expect(pinyinSyllables("ài hào")).toEqual([
      { base: "ai", tone: 4 },
      { base: "hao", tone: 4 },
    ]);
    expect(syllableAudioKey({ base: "hao", tone: 3 })).toBe("hao3");
  });

  it("folds ü to v", () => {
    expect(pinyinSyllables("nǚ")).toEqual([{ base: "nv", tone: 3 }]);
    expect(pinyinSyllables("lǜ sè")).toEqual([
      { base: "lv", tone: 4 },
      { base: "se", tone: 4 },
    ]);
    expect(syllableAudioKey({ base: "nv", tone: 3 })).toBe("nv3");
  });

  it("lowercases proper-noun marks", () => {
    expect(pinyinSyllables("Ān")).toEqual([{ base: "an", tone: 1 }]);
    expect(pinyinSyllables("Běi jīng")).toEqual([
      { base: "bei", tone: 3 },
      { base: "jing", tone: 1 },
    ]);
  });

  it("skips isolated erhua r", () => {
    expect(pinyinSyllables("nǎ r")).toEqual([{ base: "na", tone: 3 }]);
    expect(pinyinSyllables("hǎo wán r")).toEqual([
      { base: "hao", tone: 3 },
      { base: "wan", tone: 2 },
    ]);
  });

  it("does not invent a split for concatenated pinyin", () => {
    expect(pinyinSyllables("jiànguò")).toEqual([{ base: "jianguo", tone: 4 }]);
    expect(syllableAudioKey({ base: "jianguo", tone: 4 })).toBe("jianguo4");
  });

  it("treats unmarked and tone-5 syllables as unplayable keys", () => {
    expect(pinyinSyllables("bà ba")).toEqual([
      { base: "ba", tone: 4 },
      { base: "ba", tone: 0 },
    ]);
    expect(syllableAudioKey({ base: "ba", tone: 0 })).toBeNull();
    expect(syllableAudioKey({ base: "hua", tone: 5 })).toBeNull();
  });
});

describe("resolvePronunciation", () => {
  it("prefers an exact word clip for words", () => {
    expect(
      resolvePronunciation("什么", "shén me", {
        preferWordClip: true,
        availability: availability({ words: ["什么"], syllables: ["shen2", "me5"] }),
      }),
    ).toEqual({ kind: "word", form: "什么" });
  });

  it("uses the selected hanzi reading, not a word clip", () => {
    expect(
      resolvePronunciation("好", "hào", {
        preferWordClip: false,
        availability: availability({ words: ["好"], syllables: ["hao3", "hao4"] }),
      }),
    ).toEqual({ kind: "syllables", keys: ["hao4"] });
  });

  it("concatenates recorded syllables when every token has a clip", () => {
    expect(
      resolvePronunciation("爱好", "ài hào", {
        preferWordClip: true,
        availability: availability({ syllables: ["ai4", "hao4"] }),
      }),
    ).toEqual({ kind: "syllables", keys: ["ai4", "hao4"] });
  });

  it("does not substitute first-tone audio for a neutral syllable", () => {
    expect(
      resolvePronunciation("爸爸", "bà ba", {
        preferWordClip: true,
        availability: availability({ syllables: ["ba4", "ba1"], canSpeak: true }),
      }),
    ).toEqual({ kind: "tts", text: "爸爸" });
  });

  it("falls back to TTS when a fused token has no word clip", () => {
    expect(
      resolvePronunciation("见过", "jiànguò", {
        preferWordClip: true,
        availability: availability({ syllables: ["jian4", "guo4"], canSpeak: true }),
      }),
    ).toEqual({ kind: "tts", text: "见过" });
  });

  it("reports unavailable when nothing honest can play", () => {
    expect(
      resolvePronunciation("的", "de", {
        preferWordClip: false,
        availability: availability({ syllables: ["de1"], canSpeak: false }),
      }),
    ).toEqual({ kind: "unavailable", reason: "no-audio" });
  });
});

describe("LruCache", () => {
  it("evicts the least recently used entry", () => {
    const cache = new LruCache<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.has("b")).toBe(false);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
  });
});

describe("CDN clip URLs", () => {
  it("strips trailing slashes from the CDN base", () => {
    expect(audioCdnBase("https://cdn.example.com/audio/")).toBe("https://cdn.example.com/audio");
    expect(audioCdnBase("https://cdn.example.com/audio///")).toBe("https://cdn.example.com/audio");
    expect(audioCdnBase("  ")).toBeNull();
    expect(audioCdnBase("")).toBeNull();
  });

  it("uses audio-cmn hsk/syllabs names and encodes Hanzi", () => {
    const base = "https://cdn.example.com/24k-abr";
    expect(cdnWordUrl(base, "飞机")).toBe(
      "https://cdn.example.com/24k-abr/hsk/cmn-%E9%A3%9E%E6%9C%BA.mp3",
    );
    expect(cdnSyllableUrl(base, "hao3")).toBe("https://cdn.example.com/24k-abr/syllabs/cmn-hao3.mp3");
  });
});
