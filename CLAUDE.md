# Working in this repo

See [README.md](README.md) for what the project is, the command list and the
stack. This file is the operating manual: the rules that are not obvious from
reading the code.

## Never edit by hand

| Path | Committed? | Regenerate with |
|---|---|---|
| `app/data/generated/**` | **No** — gitignored | `pnpm data:build` (automatic on install/dev/build) |
| `docs/hsk/level-N/**` | Yes | `pnpm data:md` (run it explicitly after a batch) |

Both are overwritten wholesale, so edits there are silently lost.

`app/data/generated/` is derived and undiffable (single-line JSON; one tagged word
rewrites 4.5MB), so it is gitignored and rebuilt on demand.
`docs/hsk/` is the committed, line-diffable projection of the same data — it is the
review surface for a content batch, which is why `pnpm data:md` belongs in the
batch protocol.

Authored input lives in `content/` and vendored input in `data/sources/`. Those
are the only two places to change data.

## Writing content

When asked to *"fill in hanzi/word content for HSK N"* or *"tag HSK N by topic"*,
**read [docs/RESEARCH-PLAYBOOK.md](docs/RESEARCH-PLAYBOOK.md) first and follow
it.** The rules most easily got wrong:

- `## Etymology` (attested, cited) and `## Mnemonic` (invented) are separate
  sections and never blend. **Unsourced beats wrong** — "Not securely attested"
  with `confidence: low` is a complete answer.
- For a pictophonetic character the phonetic component carries **sound only**.
  Do not invent a meaning for it.
- Eight characters (举 商 场 满 爷 蛋 边 过) lost their phonetic in
  simplification. Leave `phonetic:` empty and explain the loss in prose;
  `check:content` rejects a component the character does not contain.
- Topic membership goes in `content/topics/<id>.md`, which lists its members —
  not on the entry. The set of files is the controlled vocabulary. Zero topics is
  a correct answer for function words.
- **Batches of ≤25, one level at a time**, then `pnpm check:content` and commit.
  A 25-entry diff is reviewable; a 300-entry diff is not, and this content is
  only worth anything if it is actually checked.

## Invariants the tests enforce

Breaking any of these fails `pnpm test`, so fix the cause rather than the
assertion:

- **A hanzi belongs to exactly one level** — the lowest that introduces it,
  whether standalone or inside a word. The level sets are disjoint.
- **An example sentence never contains a character above its level.** This is the
  whole premise of the sentence feature.
- **Radicals group by canonical Kangxi number, not by written form.** 亻 and 人
  are one group (#9). Grouping by the written variant let one outlier (买, written
  with 大 but indexed under 乙) rename a whole group.
- **Per-level counts are pinned** as a regression alarm on the upstream wordlist.

## Two things that surprise people

- **Levels are multi-select in the UI but never merged in the data.** The
  selection lives in the path as a comma list (`/hsk/1,2`) so it stays
  bookmarkable. Content is still authored one level at a time.
- **Topics are many-to-many.** 飞机 is both `travel` and `technology` and appears
  under both headings, so section counts sum to more than the entry count. The UI
  reports placements and distinct entries separately rather than conflating them.
