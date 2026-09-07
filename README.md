# Hanyu Learn App

A personal Mandarin learning app. Browse the full HSK 3.0 corpus — **2,970 hanzi
and 9,443 words** across levels 1–9 — organised by radical, by topic or by
frequency, with authored explanations of _why_ each character is built the way it
is and _why_ each word means what it means.

Most HSK apps give you 汉字 → pinyin → gloss and stop. This one adds two layers:

- **Radical-first organisation.** 妈, 她, 好 and 姐 are learned as one family
  under 女 rather than four unrelated shapes. Every character links to its
  decomposition tree, with the semantic component highlighted and the phonetic
  marked as sound-only. Dictionary radical, meaning component, and sound
  component are shown as separate facts: they often do not coincide.
- **Written explanations.** Per hanzi: what the etymology actually is, separated
  from an invented mnemonic. Per word: the literal reading, the real meaning, and
  the reason for the gap — 爱好 is "love + good" until you notice 好 is _hào_.
- **Phonetic series pages.** Characters that share a visible sound component
  (`/phonetic/马`, `/phonetic/礻`) so a learner can see how 妈 mā / 吗 ma / 骂 mà
  get their reading — without mixing that family into the radical page. Browse
  them from `/hsk/:level/phonetics`.

## Quick start

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Requires Node 22+ and pnpm. No database, no API keys, no network at build time —
all source data is committed.

`pnpm install` derives `app/data/generated/` (~8s) from the committed sources;
`dev` and `build` refresh it automatically if `content/` has changed since. It is
not committed — see [Generated data](#generated-data).

## Commands

```bash
pnpm dev              # dev server
pnpm build            # production build (static SPA)
pnpm start            # preview the static client build
pnpm typecheck        # react-router typegen && tsc
pnpm test             # dataset invariants + unit tests
pnpm check:content    # validate content/ against the dataset
pnpm data:build       # regenerate app/data/generated/ from sources + content
pnpm data:md          # regenerate the docs/hsk/ study lists
pnpm data:tatoeba     # re-fetch and rejoin Tatoeba sentences (rare)
```

## What's in it

|              |                                                                                     |
| ------------ | ----------------------------------------------------------------------------------- |
| Hanzi        | 2,970 across 7 level bands (300 per level through 6; 1,171 in the 7–9 band)         |
| Words        | 9,443 multi-character entries                                                       |
| Radicals     | 205, grouped by canonical Kangxi number                                             |
| Topics       | 42 themes; an entry carries zero, one or many                                       |
| Sentences    | 50,416 Tatoeba pairs, filtered so an example never uses a character above its level |
| Stroke order | All 2,970 characters, animated                                                      |

### Features

- **Search across three systems at once** — type `好`, `hao`, `hǎo`, `hao3` or
  `good`. Searching a component (`女`) finds every character containing it.
- **Multi-select levels** in the path (`/hsk/1`, `/hsk/1,2`), so any selection is
  bookmarkable.
- **Group by radical, topic or frequency**; filter by radical, topic, status and
  the older HSK standards. A Phonetics tab lists sound families in the selected
  levels.
- **i+1 example sentences** — every example at a level uses _only_ characters
  learned at or below it. Enforced by a test, not by hope.
- Stroke-order animation, dark mode, and windowed lists (1,000 rows, +100 on
  scroll) so 9,443 words stay responsive.

## Layout

| Path                  |                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------- |
| `data/sources/`       | Vendored upstream data, committed. See [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) |
| `content/`            | **Authored** explanations and topic membership. The valuable part                   |
| `app/`                | React Router app                                                                    |
| `scripts/`            | Data pipeline: build, MD lists, validation                                          |
| `app/data/generated/` | Build artefacts — **gitignored**, rebuilt automatically                             |
| `docs/hsk/level-N/`   | Generated study lists — **never edit by hand**                                      |

Detail routes: `/hanzi/:char`, `/words/:word`, `/radicals/:radical`,
`/phonetic/:component`, `/topics/:topic`. Compare two of them side by side at
`/compare` (or press VS on a detail page). Level indexes:
`/hsk/:level/hanzi` (also `words`, `topics`, `radicals`, `phonetics`).
Phonetic pages are generated from visible sound components; they are not
another Kangxi grouping.

## Where the data comes from

Content is derived from four open sources — HSK wordlists, makemeahanzi
decompositions, Unicode Unihan radicals, and Tatoeba sentences. Licences and
required attribution are recorded in [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md);
the three that require it are named in the UI footer and on `/credits`.

## Writing content

The explanations are hand-written, level by level. Coverage today:

|                                   | Written | Total  |
| --------------------------------- | ------- | ------ |
| Prose (etymology, word formation) | 94      | 12,413 |
| Topic-tagged                      | 28      | 12,413 |

These move as batches land — `docs/hsk/level-N/` and the Topics tab carry the
current figures.

To extend it, ask Claude Code to _"fill in hanzi content for HSK 1"_. It follows
[docs/RESEARCH-PLAYBOOK.md](docs/RESEARCH-PLAYBOOK.md), which exists because most
hanzi etymology in circulation is Victorian invention: attested etymology and
invented mnemonics are kept in separate sections, claims need sources, and
`pnpm check:content` rejects a component the character does not actually contain.

A `Unihan kRSUnicode: N.extra` source must match
`data/sources/radical-index.json` — that is the dictionary radical, which is not
always the meaning component. Shuowen’s 部 is a separate citation; do not copy
it into the Unihan line (视 is Shuowen 見部, Unihan `113.4` 示). After a batch,
paste:

> Audit Unihan kRSUnicode citations for the HSK _N_ hanzi files just written.
> Formal grouping is Unihan (`data/sources/radical-index.json`), not Shuowen.
> For each `Unihan kRSUnicode: N.extra` source, radical and residual strokes
> must equal the index (apostrophe optional). If they disagree, fix **only**
> that source line — keep Shuowen, etymology, `semantic`, and `phonetic`. Do
> not edit `radical-index.json` or override grouping. Semantic ≠ dictionary
> radical is valid (视, 酒, 到). Then `pnpm check:content` and `pnpm data:md`.
> One level, ≤25 files.

`?topic=untagged` is the tagging backlog; the Topics tab shows coverage per level.

## Generated data

`app/data/generated/` is **not committed**. It is derived from `data/sources/` and
`content/` by `pnpm data:build`, which takes ~8s and needs no network.

It holds two projections of the same corpus:

- **Full JSON** (`hanzi.json`, `words.json`, …) for tests and content checks.
- **Web shards** (`web/`) for the running app: per-level indexes, 64 hash
  buckets of detail pages and stroke data, plus a tiny manifest. The browser
  fetches only the files a route needs; versioned URLs are immutable on the CDN.

Three reasons the generated tree stays out of git:

- It is large, and the stroke shards duplicate the `hanzi-writer-data` package.
- It is **single-line minified JSON**, so tagging three words rewrites a 4.5MB
  blob. Across hundreds of content batches that is gigabytes of undiffable history.
- The reviewable projection of the same data is **`docs/hsk/`**, which _is_
  committed and diffs line by line — the same three-word change shows up there as
  six readable lines.

`scripts/ensure-dataset.ts` rebuilds it when missing or stale, and runs on
`pnpm install`, `pnpm dev` and `pnpm build`. When nothing has changed it exits in
under half a second.

## Stack

React Router v8 (framework mode, `ssr: false`) · React 19 · Vite 8 · Tailwind v4 ·
react-virtuoso · Vitest · pnpm.

Static SPA: one HTML shell, data loaded in the browser from versioned JSON shards.
No runtime server. Deep links rewrite to `index.html`.
