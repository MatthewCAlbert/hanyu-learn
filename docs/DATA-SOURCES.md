# Data Sources

Most of `data/sources/` is vendored — committed verbatim so builds need no
network and upstream changes show up as reviewable diffs. `extra-vocabulary.json`
is authored here. `audio-cmn/` keeps a pin (`SOURCE.json`); the MP3s are
gitignored and fetched at play time from `CDN_AUDIO_URL` when set.

| File                           | Source                                                                                            | License                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------- |
| `complete-hsk-vocabulary.json` | [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)       | MIT                       |
| `extra-vocabulary.json`        | Authored here — country and language names **not** on HSK 3.0                                     | —                         |
| `makemeahanzi-dictionary.txt`  | [skishore/makemeahanzi](https://github.com/skishore/makemeahanzi) `dictionary.txt`                | **LGPL-3.0-or-later**     |
| `tatoeba-cmn-eng.tsv`          | [Tatoeba](https://tatoeba.org) cmn/eng exports, joined and pruned                                 | **CC-BY 2.0 FR**          |
| `radical-index.json`           | [Unicode Unihan](https://www.unicode.org/charts/unihan.html) `kRSUnicode` + Kangxi Radicals block | Unicode License           |
| stroke data (npm)              | [`hanzi-writer-data`](https://github.com/chanind/hanzi-writer)                                    | **Arphic Public License** |
| `audio-cmn/`                   | [hugolpz/audio-cmn](https://github.com/hugolpz/audio-cmn) `24k-abr`, commit `ff9ed3d0c631`       | **CC BY-SA** (unspecified version). Pin in `SOURCE.json`; MP3s gitignored. |

## Attribution required on distribution

The UI footer and `/credits` page cover the sources that require attribution
on distribution:

- **makemeahanzi** (LGPL-3.0) — character decompositions, radicals, etymology.
  Derived from Unihan and CJKlib.
- **Tatoeba** (CC-BY 2.0 FR) — example sentences. Their asked-for form: state
  that sentences come from Tatoeba, link to <https://tatoeba.org>, and name the
  licence.
- **hanzi-writer-data** (Arphic Public License) — stroke-order graphics,
  derived from the Arphic PL KaitiM GB font. The APL is the strictest licence
  here: it requires the licence text to travel with the data and any changes to
  be documented. An unaltered copy is at `/licenses/ARPHICPL.TXT`.
- **audio-cmn** (CC BY-SA, version unspecified upstream) — pronunciation.
  Syllables by Chen Wang; HSK word clips by Yue Tan; packaging by Hugo Lopez.
  Optional CDN of the 24 kbps tree (`CDN_AUDIO_URL`; see the README). Neutral-tone
  files were removed upstream because they duplicated tone 1; this app does not
  put them back. Without the env var, playback uses the browser’s `speechSynthesis`.

The `meanings` fields trace back to **CC-CEDICT** (CC-BY-SA 3.0) through the
HSK wordlist repo. That repo is MIT-licensed, but share-alike arguably reaches
through to the definition text. Irrelevant locally; worth knowing before
publishing.

## Lexical relations and usage (not vendored)

These sources inform [docs/LEXICAL-RELATIONS-PLAYBOOK.md](LEXICAL-RELATIONS-PLAYBOOK.md).
They are **not** copied into `data/sources/` unless a licence row below says
redistribution is allowed. Authored conclusions live in `content/`; generated
candidates stay in `app/data/generated/` (gitignored). Licence decisions:

| Source | Use here | Redistribute the data? |
| --- | --- | --- |
| Official HSK lists / GF0025-2021 | Textbook membership and level | Cite and version; public download ≠ open data |
| Unicode Unihan | Character metadata | Yes, with Unicode License notice (already vendored) |
| CC-CEDICT | Gloss / headword lead | CC-BY-SA: attribution + share-alike; do not scrape the website |
| 现代汉语词典 | Sense, register, antonyms | No — quote minimally in authored prose, do not vendor |
| Chinese Lexical Database | Orthographic / frequency variables | GPL: only if isolated as a generated dataset with provenance |
| SUBTLEX-CH | Everyday-exposure *proxy* | **No** until licence is cleared; paper is research-use |
| BLCU BCC / PKU CCL | Dated query / KWIC checks | No corpus text; store query + date + version only |
| Leiden Weibo Corpus | Informal social snapshot (2012) | CC-BY-NC-SA: noncommercial; do not ship raw posts |
| Chinese WordNet | Sense-level synonym/antonym *candidates* | Academic, noncommercial; do not copy the graph |
| OpenHowNet | Sememe similarity *candidates* | MIT core data, but “same sememe” ≠ synonymy |

`data/sources/lexical-sources.json` is the machine-readable version of this
table. Candidate generation must preserve per-source metrics; never collapse
them into one “real-life score.”

## Regenerating

```bash
pnpm data:tatoeba   # re-downloads ~130MB, rejoins, rewrites the pruned TSV. Rare.
pnpm data:audio     # optional: sparse-clones audio-cmn and writes a pruned 24k tree to upload.
pnpm data:build     # sources + content/ -> app/data/generated/
pnpm data:md        # -> docs/hsk/ and docs/extra/
```

`data/sources/.raw/` holds the large downloads and is gitignored.

## Provenance notes

- **HSK 3.0 spine.** `level` tags are `new-*` (HSK 3.0, 2021), `old-*`
  (HSK 2.0, 2009) and `newest-*` (the 2026 revision). The app is built on
  `new-*`; the others are carried through as filter tags. Country names such as
  法国 and 日本 are not on that list; they live in `extra-vocabulary.json` and
  show up when the Extra band is on (`/hsk/extra`, `/hsk/1,2,extra`). Names the
  HSK hanzi set cannot spell (韩国, 澳大利亚) are omitted.
- **Character counts check out.** HSK 3.0 specifies 300 characters at Level 1
  and 600 by Level 2. The pipeline derives 300 and 598 independently from the
  word lists, which is a good sign the data is sound.
- **Radical numbers come from Unihan, not from makemeahanzi.** makemeahanzi
  gives the _variant_ form actually written (亻, 氵), which is what a learner
  sees; Unihan's `kRSUnicode` gives the canonical Kangxi number (9 人, 85 水).
  Both are kept — variant for display, number for grouping.
- **Formal radical, semantic component, and phonetic component are distinct.**
  Unihan decides which Kangxi group a character belongs to. The meaning-bearing
  component and the sound component are etymology, and they often differ from
  that group (视 is indexed under 示 but means with 见 and sounds with 礻).
  Generated phonetic pages (`phonetics.json`) list characters that share a
  visible sound component; they are not a second radical classification.
  `pnpm check:content` requires any authored `Unihan kRSUnicode: N.extra`
  citation to match the vendored index.
- **Seven CJK Radicals Supplement forms** (⺀ ⺊ ⺌ ⺗ ⺮ ⺳ ⺼) are absent from
  `kRSUnicode`, which only indexes unified ideographs. They are mapped by hand
  in `radical-index.json` under `variantToKangxi`.
- **Tatoeba mixes simplified and traditional.** No special handling needed: the
  i+1 filter only admits sentences whose every character is in the (simplified)
  HSK set, so traditional-only sentences are excluded automatically.
