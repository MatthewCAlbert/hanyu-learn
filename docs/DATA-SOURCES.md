# Data Sources

Everything in `data/sources/` is vendored — committed verbatim so builds need no
network and upstream changes show up as reviewable diffs.

| File                           | Source                                                                                            | License                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------- |
| `complete-hsk-vocabulary.json` | [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)       | MIT                       |
| `makemeahanzi-dictionary.txt`  | [skishore/makemeahanzi](https://github.com/skishore/makemeahanzi) `dictionary.txt`                | **LGPL-3.0-or-later**     |
| `tatoeba-cmn-eng.tsv`          | [Tatoeba](https://tatoeba.org) cmn/eng exports, joined and pruned                                 | **CC-BY 2.0 FR**          |
| `radical-index.json`           | [Unicode Unihan](https://www.unicode.org/charts/unihan.html) `kRSUnicode` + Kangxi Radicals block | Unicode License           |
| stroke data (npm)              | [`hanzi-writer-data`](https://github.com/chanind/hanzi-writer)                                    | **Arphic Public License** |

## Attribution required on distribution

The UI footer and `/credits` page cover the three that require attribution
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

The `meanings` fields trace back to **CC-CEDICT** (CC-BY-SA 3.0) through the
HSK wordlist repo. That repo is MIT-licensed, but share-alike arguably reaches
through to the definition text. Irrelevant locally; worth knowing before
publishing.

## Regenerating

```bash
pnpm data:tatoeba   # re-downloads ~130MB, rejoins, rewrites the pruned TSV. Rare.
pnpm data:build     # sources + content/ -> app/data/generated/
pnpm data:md        # -> docs/hsk/
```

`data/sources/.raw/` holds the large downloads and is gitignored.

## Provenance notes

- **HSK 3.0 spine.** `level` tags are `new-*` (HSK 3.0, 2021), `old-*`
  (HSK 2.0, 2009) and `newest-*` (the 2026 revision). The app is built on
  `new-1` and `new-2`; the others are carried through as filter tags.
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
