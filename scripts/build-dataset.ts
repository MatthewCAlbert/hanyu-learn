/**
 * Builds app/data/generated/* from the vendored sources in data/sources/,
 * overlaid with authored markdown in content/.
 *
 * Run with `pnpm data:build`. Output is gitignored and rebuilt on demand.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile, cp } from "node:fs/promises";
import matter from "gray-matter";
import { parseIds, idsLeaves, isAtomic } from "../app/lib/ids.ts";
import {
  hanziFrontmatter,
  topicFrontmatter,
  wordFrontmatter,
  sections,
} from "../app/lib/content-schema.ts";
import { SHARD_BUCKETS, shardBucket } from "../app/lib/shards.ts";
import { effectivePhonetic, effectiveSemantic } from "../app/lib/etymology.ts";
import { matchRadical } from "../app/lib/radicals.ts";
import type {
  AuthoredHanzi,
  AuthoredWord,
  Dataset,
  DatasetManifest,
  DatasetMeta,
  EtymologyType,
  Hanzi,
  HanziIndex,
  HanziPage,
  Level,
  PhoneticAnchor,
  Radical,
  Reading,
  Sentence,
  Topic,
  Word,
  WordIndex,
  WordPage,
} from "../app/lib/types.ts";

const OUT = "app/data/generated";
const HANZI_RE = /[一-鿿]/u;
const LEVEL_TAG = {
  1: "new-1", 2: "new-2", 3: "new-3", 4: "new-4",
  5: "new-5", 6: "new-6", 7: "new-7",
} as const;
const LEVELS: Level[] = [1, 2, 3, 4, 5, 6, 7];

/** Sentences attached per entry. */
const MAX_SENTENCES = 8;

interface HskEntry {
  simplified: string;
  radical: string;
  level: string[];
  frequency: number;
  pos: string[];
  forms: {
    traditional: string;
    transcriptions: { pinyin: string; numeric: string };
    meanings: string[];
    classifiers: string[];
  }[];
}

interface MmahEntry {
  character: string;
  definition?: string;
  pinyin: string[];
  decomposition: string;
  radical: string;
  etymology?: { type: string; hint?: string; phonetic?: string; semantic?: string };
}

const isHanzi = (c: string) => HANZI_RE.test(c);
const hanziOf = (s: string) => [...s].filter(isHanzi);

/**
 * Tatoeba is an open corpus and is not curated for a study app. A small
 * blocklist keeps crude or distressing examples off the cards; it is applied to
 * both sides of the pair, since either language may carry the offending term.
 */
const BLOCKED_EN =
  /\b(fuck\w*|shit\w*|bitch\w*|bastard|asshole|dick|cunt|whore|slut|damn|hell|piss\w*|rape\w*|kill(ed|ing)?|murder\w*|suicide|die|died|dead|death|drunk|sex|penis|vagina|nigg\w*|idiot|stupid|hate)\b/i;
const BLOCKED_ZH = /[肏操屄屌妓娼婊嫖賤贱骚騷淫奸姦殺杀死尸屍毒]|他妈|她妈|去死|混蛋|王八/;

const isWholesome = (s: Sentence) => !BLOCKED_EN.test(s.eng) && !BLOCKED_ZH.test(s.cmn);

const ETYMOLOGY_TYPES = new Set<EtymologyType>(["pictographic", "ideographic", "pictophonetic"]);

/** Narrow makemeahanzi's loose `etymology` blob, rejecting unexpected types loudly. */
function toEtymology(e: MmahEntry["etymology"], components: string[]): Hanzi["etymology"] {
  if (!e) return null;
  if (!ETYMOLOGY_TYPES.has(e.type as EtymologyType)) {
    throw new Error(`unexpected etymology type "${e.type}"`);
  }
  const present = new Set(components);
  return {
    type: e.type as EtymologyType,
    ...(e.hint ? { hint: e.hint } : {}),
    ...(e.phonetic ? { phonetic: e.phonetic, phoneticVisible: present.has(e.phonetic) } : {}),
    ...(e.semantic ? { semantic: e.semantic, semanticVisible: present.has(e.semantic) } : {}),
  };
}

/**
 * CC-CEDICT lists a capitalised proper-noun reading first ("Sān — surname San"
 * before "sān — three"), and pads entries with cross-reference glosses
 * ("used in 上声"). Neither is what a learner wants at the top of a card, so
 * rank the readings and expose the best one as primary while keeping the rest —
 * 中 zhōng/zhòng and 好 hǎo/hào are exactly the distinctions worth teaching.
 */
const CROSS_REF = /^(used in|variant of|abbr\. for|old variant|see |erhua variant)/i;

function rankReadings(forms: HskEntry["forms"]): Reading[] {
  const scored = forms.map((f, i) => {
    const pinyin = f.transcriptions.pinyin;
    const meanings = f.meanings.filter(Boolean);
    let score = 0;
    if (/[A-Z]/.test(pinyin)) score += 2; // proper noun
    if (meanings.length > 0 && meanings.every((m) => CROSS_REF.test(m))) score += 3;
    if (meanings.length === 0) score += 4;
    return { pinyin, meanings, score, i };
  });
  // Tiebreak on gloss count: CC-CEDICT elaborates the everyday sense more than
  // the marginal one (东西 "thing, stuff, person" vs "east and west").
  scored.sort((a, b) => a.score - b.score || b.meanings.length - a.meanings.length || a.i - b.i);
  // Collapse duplicate pronunciations, keeping the better-ranked gloss set.
  const seen = new Set<string>();
  const out: Reading[] = [];
  for (const r of scored) {
    if (seen.has(r.pinyin)) continue;
    seen.add(r.pinyin);
    out.push({ pinyin: r.pinyin, meanings: r.meanings });
  }
  return out;
}

async function main() {
  // ---------------------------------------------------------------- sources
  const hsk: HskEntry[] = JSON.parse(
    await readFile("data/sources/complete-hsk-vocabulary.json", "utf8"),
  );

  const mmah = new Map<string, MmahEntry>();
  for (const line of (await readFile("data/sources/makemeahanzi-dictionary.txt", "utf8")).split("\n")) {
    if (!line.trim()) continue;
    const o: MmahEntry = JSON.parse(line);
    mmah.set(o.character, o);
  }

  const radIndex: {
    kangxi: Record<string, { number: number; char: string; strokes: number; gloss: string }>;
    kRSUnicode: Record<string, { radical: number; extra: number }>;
    variantToKangxi: Record<string, number>;
    ambiguousVariants: Record<string, number[]>;
  } = JSON.parse(await readFile("data/sources/radical-index.json", "utf8"));

  const allSentences: Sentence[] = [];
  for (const line of (await readFile("data/sources/tatoeba-cmn-eng.tsv", "utf8")).split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [id, cmn, eng] = line.split("\t");
    if (id && cmn && eng) allSentences.push({ id, cmn, eng });
  }

  // ------------------------------------------------- level partition (exclusive)
  const entriesByLevel = new Map<Level, HskEntry[]>();
  for (const level of LEVELS) {
    entriesByLevel.set(level, hsk.filter((e) => e.level.includes(LEVEL_TAG[level])));
  }

  /**
   * A hanzi belongs to the LOWEST level that introduces it, whether standalone
   * or inside a word. So the two level sets are disjoint by construction.
   */
  const hanziLevel = new Map<string, Level>();
  for (const level of LEVELS) {
    for (const e of entriesByLevel.get(level)!) {
      for (const c of hanziOf(e.simplified)) {
        if (!hanziLevel.has(c)) hanziLevel.set(c, level);
      }
    }
  }

  // Known-character set per level, cumulative — what the learner can read by then.
  const knownAt = new Map<Level, Set<string>>();
  const cumulative = new Set<string>();
  for (const level of LEVELS) {
    for (const [c, l] of hanziLevel) if (l === level) cumulative.add(c);
    knownAt.set(level, new Set(cumulative));
  }

  // ------------------------------------------------------------- i+1 sentences
  /** Sentences readable at a level: every character already known. Shortest first. */
  const sentencesFor = new Map<Level, Sentence[]>();
  for (const level of LEVELS) {
    const known = knownAt.get(level)!;
    const pool = allSentences
      .filter(isWholesome)
      .filter((s) => hanziOf(s.cmn).every((c) => known.has(c)));
    pool.sort((a, b) => a.cmn.length - b.cmn.length || a.id.localeCompare(b.id));
    sentencesFor.set(level, pool);
  }

  /** Pick example sentences containing `needle`, drawn from that level's pool. */
  const pickSentences = (needle: string, level: Level): Sentence[] =>
    sentencesFor.get(level)!.filter((s) => s.cmn.includes(needle)).slice(0, MAX_SENTENCES);

  // ------------------------------------------------------------- authored content
  const authoredHanzi = new Map<string, AuthoredHanzi>();
  const authoredWords = new Map<string, AuthoredWord>();

  for (const file of await safeReaddir("content/hanzi")) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const { data, content } = matter(await readFile(`content/hanzi/${file}`, "utf8"));
    const fm = hanziFrontmatter.parse(data);
    const s = sections(content);
    authoredHanzi.set(fm.char, {
      status: fm.status,
      semantic: fm.semantic ?? null,
      phonetic: fm.phonetic ?? null,
      confidence: fm.confidence,
      sources: fm.sources,
      etymology: s["etymology"] ?? null,
      mnemonic: s["mnemonic"] ?? null,
      notes: s["notes"] ?? null,
    });
  }

  for (const file of await safeReaddir("content/words")) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const { data, content } = matter(await readFile(`content/words/${file}`, "utf8"));
    const fm = wordFrontmatter.parse(data);
    const s = sections(content);
    authoredWords.set(fm.word, {
      status: fm.status,
      formation: fm.formation,
      literal: fm.literal,
      actual: fm.actual,
      transparency: fm.transparency,
      confidence: fm.confidence,
      sources: fm.sources,
      why: s["why this combination"] ?? null,
      notes: s["notes"] ?? null,
    });
  }

  // ------------------------------------------------------------------ topics
  /**
   * Topic files own their membership; the app needs it per entry. Invert once
   * here so both directions are available without either side going stale.
   */
  const topics: Topic[] = [];
  const topicsOfHanzi = new Map<string, string[]>();
  const topicsOfWord = new Map<string, string[]>();

  for (const file of (await safeReaddir("content/topics")).sort()) {
    if (!file.endsWith(".md") || file.startsWith("_")) continue;
    const { data, content } = matter(await readFile(`content/topics/${file}`, "utf8"));
    const fm = topicFrontmatter.parse(data);
    topics.push({
      id: fm.topic,
      label: fm.label,
      description: content.trim(),
      hanzi: fm.hanzi,
      words: fm.words,
    });
    for (const c of fm.hanzi) push(topicsOfHanzi, c, fm.topic);
    for (const w of fm.words) push(topicsOfWord, w, fm.topic);
  }

  // ------------------------------------------------------------------- words
  const words: Word[] = [];
  for (const level of LEVELS) {
    for (const e of entriesByLevel.get(level)!) {
      if (hanziOf(e.simplified).length < 2) continue;
      const readings = rankReadings(e.forms);
      const primary = readings[0];
      const form = e.forms[0];
      if (!primary || !form) continue;
      words.push({
        word: e.simplified,
        level,
        readings,
        pinyin: primary.pinyin,
        meanings: primary.meanings,
        frequency: e.frequency ?? null,
        pos: e.pos ?? [],
        traditional: form.traditional !== e.simplified ? form.traditional : null,
        classifiers: form.classifiers ?? [],
        chars: hanziOf(e.simplified),
        sentences: pickSentences(e.simplified, level),
        standards: e.level.filter((l) => !l.startsWith("new-")),
        topics: topicsOfWord.get(e.simplified) ?? [],
        authored: authoredWords.get(e.simplified) ?? null,
      });
    }
  }

  // hanzi -> words containing it
  const wordsByChar = new Map<string, string[]>();
  for (const w of words) {
    for (const c of new Set(w.chars)) {
      const cur = wordsByChar.get(c);
      if (cur) cur.push(w.word);
      else wordsByChar.set(c, [w.word]);
    }
  }

  // standalone single-character HSK entries, for pinyin/meanings/frequency
  const standalone = new Map<string, HskEntry>();
  for (const e of hsk) if (hanziOf(e.simplified).length === 1 && e.simplified.length === 1) {
    if (!standalone.has(e.simplified)) standalone.set(e.simplified, e);
  }

  // ------------------------------------------------------------------- hanzi
  const hanziList: Hanzi[] = [];
  for (const [char, level] of [...hanziLevel].sort((a, b) => a[0].localeCompare(b[0]))) {
    const mm = mmah.get(char);
    if (!mm) throw new Error(`no makemeahanzi entry for ${char}`);

    const entry = standalone.get(char);
    const readings = entry ? rankReadings(entry.forms) : [];
    const primary = readings[0];
    const form = entry?.forms[0];
    const radical = mm.radical;
    const radicalNumber =
      radIndex.kRSUnicode[char]?.radical ??
      radIndex.variantToKangxi[radical] ??
      radIndex.kRSUnicode[radical]?.radical;
    if (radicalNumber === undefined) throw new Error(`no radical number for ${char} (${radical})`);

    const tree = isAtomic(mm.decomposition) ? null : parseIds(mm.decomposition);
    const components = tree ? [...new Set(idsLeaves(tree))].filter((c) => c !== char) : [];

    hanziList.push({
      char,
      level,
      readings,
      pinyin: primary ? readings.map((r) => r.pinyin) : mm.pinyin,
      meanings: primary?.meanings ?? (mm.definition ? [mm.definition] : []),
      frequency: entry?.frequency ?? null,
      pos: entry?.pos ?? [],
      traditional: form && form.traditional !== char ? form.traditional : null,
      radical,
      radicalCanonical: radIndex.kangxi[String(radicalNumber)]!.char,
      radicalNumber,
      decomposition: mm.decomposition,
      components,
      strokeCount: null,
      etymology: toEtymology(mm.etymology, components),
      words: wordsByChar.get(char) ?? [],
      sentences: pickSentences(char, level),
      standards: entry ? entry.level.filter((l) => !l.startsWith("new-")) : [],
      topics: topicsOfHanzi.get(char) ?? [],
      authored: authoredHanzi.get(char) ?? null,
    });
  }

  // ---------------------------------------------------------------- radicals
  /**
   * Grouped by canonical Kangxi number, not by the written variant. The two
   * sources disagree on the variant for some characters — makemeahanzi reads
   * 买's radical as 大 while Unihan indexes it under #5 乙 — so keying on the
   * variant would let one outlier rename a whole group.
   */
  const radMap = new Map<number, Radical>();
  for (const h of hanziList) {
    let r = radMap.get(h.radicalNumber);
    if (!r) {
      const k = radIndex.kangxi[String(h.radicalNumber)];
      if (!k) throw new Error(`unknown kangxi radical ${h.radicalNumber}`);
      r = {
        char: k.char,
        canonical: k.char,
        variants: [],
        display: k.char,
        number: k.number,
        strokes: k.strokes,
        gloss: k.gloss,
        hanzi: [],
      };
      radMap.set(h.radicalNumber, r);
    }
    r.hanzi.push(h.char);
  }
  /**
   * Unihan decides membership; makemeahanzi supplies the written form. Where
   * the two disagree (it reads 买's radical as 大, Unihan indexes it under 乙)
   * only Unihan-confirmed variants are recorded, so the list stays truthful.
   *
   * `display` is the variant most of the members actually write, which for a
   * simplified corpus is 讠 rather than the canonical 言.
   */
  for (const r of radMap.values()) {
    const written = new Map<string, number>();
    for (const c of r.hanzi) {
      const form = hanziList.find((h) => h.char === c)!.radical;
      const confirmed =
        form === r.canonical ||
        radIndex.kRSUnicode[form]?.radical === r.number ||
        radIndex.variantToKangxi[form] === r.number ||
        // 阝 is 阜 on the left and 邑 on the right; Unihan can only record one.
        (radIndex.ambiguousVariants[form]?.includes(r.number) ?? false);
      if (confirmed) written.set(form, (written.get(form) ?? 0) + 1);
    }
    r.variants = [...written.keys()].sort();
    r.display = [...written.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? r.canonical;
  }
  const radicals = [...radMap.values()].sort((a, b) => a.strokes - b.strokes || a.number - b.number);

  // ------------------------------------------------------------------ output
  const counts = {} as Dataset["counts"];
  for (const level of LEVELS) {
    counts[level] = {
      entries: entriesByLevel.get(level)!.length,
      hanzi: hanziList.filter((h) => h.level === level).length,
      words: words.filter((w) => w.level === level).length,
      radicals: new Set(hanziList.filter((h) => h.level === level).map((h) => h.radicalNumber)).size,
    };
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await write("hanzi.json", hanziList);
  await write("words.json", words);
  await write("radicals.json", radicals);
  await write("counts.json", counts);
  await write("topics.json", topics);

  const { version, strokeEntries } = await writeWebShards({
    hanziList,
    words,
    radicals,
    topics,
    counts,
    mmah,
  });

  for (const level of LEVELS) {
    const c = counts[level];
    console.log(
      `HSK ${level}: ${c.entries} entries · ${c.hanzi} hanzi · ${c.words} words · ${c.radicals} radicals`,
    );
  }
  const tagged =
    hanziList.filter((h) => h.topics.length > 0).length +
    words.filter((w) => w.topics.length > 0).length;
  console.log(
    `radicals total ${radicals.length} · stroke shards ${strokeEntries} chars · web ${version}`,
  );
  console.log(
    `topics ${topics.length} · ${tagged} of ${hanziList.length + words.length} entries tagged`,
  );

  // Written last, so its mtime means "everything above finished". Using an
  // output written mid-build would make anything touched during the run look
  // permanently newer than the build.
  await writeFile(`${OUT}/.built`, new Date().toISOString());

  async function write(name: string, data: unknown) {
    await writeFile(`${OUT}/${name}`, JSON.stringify(data));
  }
}

/**
 * Compact, versioned JSON the browser fetches on demand. Indexes are per level
 * so HSK 1 does not download HSK 7; details and strokes live in a fixed number
 * of hash buckets so we never mint thousands of output files.
 */
async function writeWebShards(args: {
  hanziList: Hanzi[];
  words: Word[];
  radicals: Radical[];
  topics: Topic[];
  counts: Dataset["counts"];
  mmah: Map<string, MmahEntry>;
}): Promise<{ version: string; strokeEntries: number }> {
  const { hanziList, words, radicals, topics, counts, mmah } = args;
  const hanziByChar = new Map(hanziList.map((h) => [h.char, h]));
  const wordByText = new Map(words.map((w) => [w.word, w]));
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const phonetics = buildPhonetics(hanziList, hanziByChar, radicals, mmah);

  const version = createHash("sha256")
    .update(JSON.stringify(hanziList))
    .update(JSON.stringify(words))
    .update(JSON.stringify(topics))
    .update(JSON.stringify(phonetics))
    .digest("hex")
    .slice(0, 12);

  const web = `${OUT}/web`;
  const root = `${web}/${version}`;
  await mkdir(`${root}/hd`, { recursive: true });
  await mkdir(`${root}/wd`, { recursive: true });
  await mkdir(`${root}/st`, { recursive: true });

  const manifest: DatasetManifest = { version, buckets: SHARD_BUCKETS };
  const meta: DatasetMeta = { radicals, topics, counts };
  await writeFile(`${web}/manifest.json`, JSON.stringify(manifest));
  await writeFile(`${root}/meta.json`, JSON.stringify(meta));
  await writeFile(`${root}/phonetics.json`, JSON.stringify(phonetics));

  for (const level of LEVELS) {
    const hanziIndex: HanziIndex[] = hanziList
      .filter((h) => h.level === level)
      .map((h) => ({
        char: h.char,
        level: h.level,
        pinyin: h.pinyin,
        meanings: h.meanings,
        frequency: h.frequency,
        radical: h.radical,
        radicalCanonical: h.radicalCanonical,
        components: h.components,
        standards: h.standards,
        topics: h.topics,
        status: h.authored?.status ?? "stub",
        phonetic: effectivePhonetic(h),
        semantic: effectiveSemantic(h),
      }));
    const wordIndex: WordIndex[] = words
      .filter((w) => w.level === level)
      .map((w) => ({
        word: w.word,
        level: w.level,
        pinyin: w.pinyin,
        meanings: w.meanings,
        frequency: w.frequency,
        standards: w.standards,
        topics: w.topics,
        status: w.authored?.status ?? "stub",
        literal: w.authored?.literal ?? null,
        transparency: w.authored?.transparency ?? null,
      }));
    await writeFile(`${root}/h${level}.json`, JSON.stringify(hanziIndex));
    await writeFile(`${root}/w${level}.json`, JSON.stringify(wordIndex));
  }

  const hanziPages: Record<string, HanziPage>[] = Array.from({ length: SHARD_BUCKETS }, () => ({}));
  const wordPages: Record<string, WordPage>[] = Array.from({ length: SHARD_BUCKETS }, () => ({}));
  const strokePages: Record<string, unknown>[] = Array.from({ length: SHARD_BUCKETS }, () => ({}));

  for (const hanzi of hanziList) {
    hanziPages[shardBucket(hanzi.char)]![hanzi.char] = buildHanziPage(
      hanzi,
      hanziList,
      hanziByChar,
      wordByText,
      radicals,
      topicById,
      phonetics,
    );
  }
  for (const word of words) {
    wordPages[shardBucket(word.word)]![word.word] = buildWordPage(word, hanziByChar, topicById);
  }

  let strokeEntries = 0;
  for (const h of hanziList) {
    const src = `node_modules/hanzi-writer-data/${h.char}.json`;
    try {
      strokePages[shardBucket(h.char)]![h.char] = JSON.parse(await readFile(src, "utf8"));
      strokeEntries += 1;
    } catch {
      console.warn(`  ! no stroke data for ${h.char}`);
    }
  }

  for (let i = 0; i < SHARD_BUCKETS; i += 1) {
    await writeFile(`${root}/hd/${i}.json`, JSON.stringify(hanziPages[i]));
    await writeFile(`${root}/wd/${i}.json`, JSON.stringify(wordPages[i]));
    await writeFile(`${root}/st/${i}.json`, JSON.stringify(strokePages[i]));
  }

  await rm("public/data", { recursive: true, force: true });
  await mkdir("public", { recursive: true });
  await cp(web, "public/data", { recursive: true });

  return { version, strokeEntries };
}

function overlayEtymology(hanzi: Hanzi): Hanzi["etymology"] {
  const a = hanzi.authored;
  if (hanzi.etymology) {
    return {
      ...hanzi.etymology,
      ...(a?.semantic ? { semantic: a.semantic, semanticVisible: true } : {}),
      ...(a?.phonetic ? { phonetic: a.phonetic, phoneticVisible: true } : {}),
    };
  }
  if (a?.semantic || a?.phonetic) {
    return {
      type: "ideographic",
      ...(a.semantic ? { semantic: a.semantic, semanticVisible: true } : {}),
      ...(a.phonetic ? { phonetic: a.phonetic, phoneticVisible: true } : {}),
    };
  }
  return null;
}

function firstGloss(text: string | undefined): string {
  return text?.split(/[;,]/)[0]?.trim() ?? "";
}

function componentGloss(
  form: string,
  hanziByChar: Map<string, Hanzi>,
  radicals: Radical[],
): string {
  const asHanzi = hanziByChar.get(form);
  if (asHanzi) return firstGloss(asHanzi.meanings[0]);
  const rad = matchRadical(form, radicals);
  if (rad) {
    const canonHanzi = hanziByChar.get(rad.canonical) ?? hanziByChar.get(rad.display);
    if (canonHanzi) return firstGloss(canonHanzi.meanings[0]);
    return rad.gloss;
  }
  return "";
}

function componentHref(
  form: string,
  role: "phonetic" | "other",
  hanziByChar: Map<string, Hanzi>,
  radicals: Radical[],
): string | null {
  if (role === "phonetic") return `/phonetic/${encodeURIComponent(form)}`;
  if (hanziByChar.has(form)) return `/hanzi/${encodeURIComponent(form)}`;
  const rad = matchRadical(form, radicals);
  if (rad) {
    if (hanziByChar.has(rad.canonical)) return `/hanzi/${encodeURIComponent(rad.canonical)}`;
    const displayed = [...rad.variants, rad.display].find((v) => hanziByChar.has(v));
    if (displayed) return `/hanzi/${encodeURIComponent(displayed)}`;
    return `/radicals/${encodeURIComponent(rad.char)}`;
  }
  return null;
}

function radicalRef(
  r: Radical,
): Pick<Radical, "char" | "display" | "gloss" | "number" | "canonical"> {
  return {
    char: r.char,
    display: r.display,
    gloss: r.gloss,
    number: r.number,
    canonical: r.canonical,
  };
}

function pickAnchor(
  component: string,
  rad: Radical | undefined,
  hanziByChar: Map<string, Hanzi>,
  mmah: Map<string, MmahEntry>,
): string {
  const opts = [...new Set([component, rad?.canonical, rad?.display, ...(rad?.variants ?? [])].filter(
    (c): c is string => Boolean(c),
  ))];
  return (
    opts.find((c) => hanziByChar.has(c)) ??
    opts.find((c) => (mmah.get(c)?.pinyin.length ?? 0) > 0) ??
    opts.find((c) => mmah.has(c)) ??
    component
  );
}

function buildPhonetics(
  hanziList: Hanzi[],
  hanziByChar: Map<string, Hanzi>,
  radicals: Radical[],
  mmah: Map<string, MmahEntry>,
): Record<string, PhoneticAnchor> {
  const out: Record<string, PhoneticAnchor> = {};
  for (const h of hanziList) {
    const component = effectivePhonetic(h);
    if (!component || out[component]) continue;
    const rad = matchRadical(component, radicals);
    const anchor = pickAnchor(component, rad, hanziByChar, mmah);
    const asHanzi = hanziByChar.get(anchor) ?? hanziByChar.get(component);
    const mm = mmah.get(anchor);
    const hanziChar = hanziByChar.has(component)
      ? component
      : hanziByChar.has(anchor)
        ? anchor
        : null;
    out[component] = {
      component,
      anchor,
      pinyin: asHanzi?.pinyin ?? mm?.pinyin ?? [],
      meaning:
        firstGloss(asHanzi?.meanings[0]) ||
        firstGloss(mm?.definition) ||
        rad?.gloss ||
        null,
      radical: rad ? radicalRef(rad) : null,
      hanzi: hanziChar,
    };
  }
  return out;
}

function buildHanziPage(
  hanzi: Hanzi,
  all: Hanzi[],
  hanziByChar: Map<string, Hanzi>,
  wordByText: Map<string, Word>,
  radicals: Radical[],
  topicById: Map<string, Topic>,
  phonetics: Record<string, PhoneticAnchor>,
): HanziPage {
  const radical = radicals.find((r) => r.char === hanzi.radicalCanonical) ?? null;
  const etymology = overlayEtymology(hanzi);
  const glosses: Record<string, string> = {};
  const componentHrefs: Record<string, string | null> = {};
  const phoneticKey = effectivePhonetic(hanzi);
  for (const c of hanzi.components) {
    glosses[c] = componentGloss(c, hanziByChar, radicals);
    const role = phoneticKey === c ? "phonetic" : "other";
    componentHrefs[c] = componentHref(c, role, hanziByChar, radicals);
  }

  const phoneticSeries = phoneticKey
    ? all
        .filter((h) => h.char !== hanzi.char && effectivePhonetic(h) === phoneticKey)
        .map((h) => ({ char: h.char, pinyin: h.pinyin[0] ?? "", meaning: h.meanings[0] ?? "" }))
    : [];

  const semanticForm = effectiveSemantic(hanzi);
  const phoneticMeta = phoneticKey ? phonetics[phoneticKey] : undefined;

  const pageWords = hanzi.words
    .map((w) => wordByText.get(w))
    .filter((w): w is Word => Boolean(w))
    .map((w) => ({
      word: w.word,
      pinyin: w.pinyin,
      meaning: w.meanings[0] ?? "",
      level: w.level,
    }));
  const pageTopics = hanzi.topics
    .map((id) => topicById.get(id))
    .filter((t): t is Topic => Boolean(t))
    .map((t) => ({ id: t.id, label: t.label }));
  return {
    hanzi,
    radical: radical ? radicalRef(radical) : null,
    etymology,
    glosses,
    componentHrefs,
    semanticRole: semanticForm
      ? {
          form: semanticForm,
          gloss: componentGloss(semanticForm, hanziByChar, radicals),
          href: componentHref(semanticForm, "other", hanziByChar, radicals),
        }
      : null,
    phoneticRole: phoneticKey
      ? {
          form: phoneticKey,
          gloss: phoneticMeta?.meaning ?? componentGloss(phoneticKey, hanziByChar, radicals),
          href: `/phonetic/${encodeURIComponent(phoneticKey)}`,
          anchor: phoneticMeta?.anchor ?? phoneticKey,
          pinyin: phoneticMeta?.pinyin ?? [],
        }
      : null,
    phoneticSeries,
    words: pageWords,
    topics: pageTopics,
  };
}

function buildWordPage(
  word: Word,
  hanziByChar: Map<string, Hanzi>,
  topicById: Map<string, Topic>,
): WordPage {
  const chars = word.chars.map((c) => {
    const h = hanziByChar.get(c);
    return {
      char: c,
      pinyin: h?.pinyin[0] ?? "",
      meaning: h?.meanings[0] ?? "",
      level: h?.level ?? null,
      radical: h?.radical ?? null,
    };
  });
  const pageTopics = word.topics
    .map((id) => topicById.get(id))
    .filter((t): t is Topic => Boolean(t))
    .map((t) => ({ id: t.id, label: t.label }));
  return { word, chars, topics: pageTopics };
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const cur = map.get(key);
  if (cur) {
    if (!cur.includes(value)) cur.push(value);
  } else {
    map.set(key, [value]);
  }
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

main();
