# Research Playbook

How to fill in hanzi and word content for this app. **Read this in full before
writing a single entry.** The app's whole value is that its explanations are
trustworthy; a confident, well-written, wrong etymology is worse than a blank.

---

## 1. Invocation contract

> "Fill in hanzi content for HSK 1" · "Fill in word content for HSK 2" ·
> "Fill in grammar lessons for HSK 1"

On that request:

1. Read this playbook.
2. Find the backlog: entries at **that level only** with `status: stub`.
   ```bash
   pnpm data:build          # ensure generated data is current
   grep -c '⬜ stub' docs/hsk/level-1/hanzi.md
   ```
3. Work in **frequency order** (most frequent first) — the lists are sorted for
   this. Frequent characters repay explanation the most.
4. Work in batches of **≤25 entries**, then validate and commit (§8).

Never batch two levels together in one authoring pass. The app can *display*
both at once (`/hsk/1,2`), but research and commits stay per level so the
backlog and the diffs remain legible.

---

## 2. The hard rule: etymology is not mnemonic

Every hanzi file has two distinct sections. They never blend.

| `## Etymology` | `## Mnemonic` |
|---|---|
| What the character **actually is**, historically | An **invented** memory aid |
| Must be supported by a cited source | Needs no source; is not a claim |
| If you cannot source it, say so and set `confidence: low` | Free to be vivid and silly |

Most "hanzi etymology" in circulation is invention — Victorian missionary
guesswork, or modern reverse-engineering from the simplified shape. It is
usually memorable and often wrong. Putting it under `## Etymology` poisons the
exact thing this app exists to do.

**When you don't know, write "Not securely attested." and set
`confidence: low`.** That is a complete, acceptable answer.

---

## 3. Source hierarchy

**Tier 1 — cite freely**
- 說文解字 Shuowen Jiezi (c. 100 CE) — via [ctext.org](https://ctext.org/shuo-wen-jie-zi)
- Unicode Unihan database (`kRSUnicode`, `kDefinition`)
- Oracle bone / bronze inscription corpora — [zdic.net](https://www.zdic.net) 字源

**Tier 2 — cite with attribution**
- Wieger, *Chinese Characters* (1915) — dated, sometimes speculative
- Karlgren, *Grammata Serica Recensa*
- Outlier Linguistics — modern, scholarly, explicitly flags folk etymology

**Tier 3 — a lead, never a citation**
- Wiktionary. Follow its sources; cite those instead.

**Never**
- Chineasy or any "every component is a picture" system. It is systematically
  wrong for the ~45% of these characters that are pictophonetic, where the
  sound component has no pictorial meaning at all.

Shuowen itself is ~1,000 years after the oracle bones and gets things wrong.
Citing it means "Shuowen says," not "it is settled."

---

## 4. Pictophonetic discipline

When the dataset marks `type: pictophonetic`, the default and usually complete
explanation is:

> **X supplies the meaning; Y supplies the sound.**

Do **not** invent a semantic story for the phonetic component.

Verify by listing other characters sharing the phonetic. If 马 appears in
妈 mā (mother), 吗 ma (question particle), 骂 mà (to scold), 码 mǎ (number) with
four unrelated senses, then 马 is carrying sound and nothing else — and the
write-up must say so explicitly. That is the single most useful thing a learner
can be told about the character.

### The phonetic may be gone

Simplification frequently destroyed the sound clue. Eight characters in
HSK 1–2 are affected: 举 商 场 满 爷 蛋 边 过.

For these the app sets `phoneticVisible: false`. In the file:

- **Leave the `phonetic:` frontmatter field empty** — `pnpm check:content`
  rejects a component that is not actually in the character.
- Explain the loss in prose. See `content/hanzi/过.md` for the worked example.

---

## 5. Confidence labelling

| | |
|---|---|
| `high` | Tier-1 sourced, sources agree |
| `medium` | Composition certain, *interpretation* contested (好, 东西) |
| `low` | Sources disagree, or the etymology holds only for the traditional form |

**Simplification is the most common reason for `low`.** 爱 lost its 心 (heart),
so any explanation invoking the heart describes 愛 and not the character on the
card. Say which form you are explaining.

---

## 6. Word formation taxonomy

Set `formation:` to the structure, and answer the question in the right column
under `## Why this combination`.

| `formation` | Example | The question to answer |
|---|---|---|
| `semantic-compound` | 电脑 electric+brain | How do the senses combine? |
| `verb-object` | 起床 rise+bed | What is the object, and can the word split? |
| `phonetic-loan` | 沙发 sofa | Which language, and are the characters meaningless here? |
| `abbreviation` | 北大 | What is the full form? |
| `loanword-calque` | 热狗 hot+dog | What was translated, morpheme by morpheme? |
| `idiom` | 东西 east+west | Why is it opaque, and is the popular story attested? |
| `reduplication` | 谢谢 | What does the doubling do — softening, aspect, plurality? |

**Verb + complement is `semantic-compound`, not `verb-object`.** Resultative and
directional complements (看到, 打开, 走进, 记住) take no object and do not split
like 起床 — 看到个… is impossible; 看得见 is potential-infix behaviour of the
complement, not object separation. File them as `semantic-compound` and explain
the complement in prose. `verb-object` is reserved for a verb with a genuine
noun object (起床, 开车, 帮忙). Polite 请 + verb formulas (请坐, 请问) and
question-word frames (怎么办) are likewise `semantic-compound`.

`transparency` drives the UI, so be honest with it:

- `transparent` — the characters give it away (电脑)
- `semi` — derivable once one point is explained (爱好, once you know 好 is *hào*)
- `opaque` — not derivable; must be memorised (东西)

An `opaque` word gets a prominent callout in the app. Marking a genuinely
opaque word `transparent` denies the learner the help they need most.

---

## 7. Definition of done

A hanzi entry is done when:

- [ ] Frontmatter valid; `semantic`/`phonetic` are **real components** of the character
- [ ] `## Etymology` present, sourced, and distinguishes attested from interpretation
- [ ] `## Mnemonic` present and clearly an invention
- [ ] `## Notes` covers the phonetic series, related characters, or simplification caveats
- [ ] `confidence` honestly set; `sources` non-empty if `status: reviewed`
- [ ] `pnpm check:content` passes

A word entry is done when:

- [ ] `literal` reads the characters one by one; `actual` gives the real meaning
- [ ] `formation` and `transparency` set per §6
- [ ] `## Why this combination` explains the gap between literal and actual
- [ ] Tone shifts noted where they carry the meaning (爱好 *hào*, 东西 neutral)
- [ ] `pnpm check:content` passes

Worked examples to imitate: `content/hanzi/{妈,好,明,人,过}.md` and
`content/words/{爱好,东西,电脑,明白,起床}.md`. They deliberately cover all three
etymology types, a lost phonetic, and four formation types.

For synonyms, antonyms, textbook-vs-everyday usage, and character contribution
inside a word, **also read [LEXICAL-RELATIONS-PLAYBOOK.md](LEXICAL-RELATIONS-PLAYBOOK.md)**
before writing a relation or a `chars:` overlay.

---

## 8. Topic tagging

Every hanzi and word carries **zero, one or several** topics. Membership is
authored in `content/topics/<id>.md`, not on the entry — tagging 200 words is one
file and one reviewable diff.

```markdown
---
topic: travel
label: Travel
hanzi: [车, 站, 票]
words: [飞机, 火车, 机场]
---

Prose describing the boundary of this topic and its easily-confused neighbours.
```

**The set of files is the vocabulary.** `pnpm check:content` rejects a member that
is not in the corpus, a duplicate within one topic, and a filename that disagrees
with `topic:`. Creating a new topic means adding a file — a deliberate act that
shows up in review.

Tagging joins the per-level batch: after writing prose for a batch, add those
entries to the relevant topic files.

### Rules that keep the vocabulary from decaying

- **Tag the meaning, not the string.** 行 belongs in `movement` for *xíng*; it does
  not belong in `business-and-economy` merely because 银行 exists. Tag what the
  entry means on its own.
- **Zero tags is a correct answer.** Function words (的, 了, 吗), pure grammar and
  bare classifiers belong to no topic. Do not reach for `abstract-concepts` just to
  avoid leaving a blank — an over-tagged corpus is less useful than an honest one.
- **Two or three is the practical ceiling.** If an entry seems to want five, either
  the topics are too narrow or the entry is too generic to tag at all.
- **Deliberate overlap is fine.** 飞机 is both `travel` and `technology`, and the app
  shows it under both headings. That is the point of many-to-many.
- Add members in frequency order so diffs stay readable.

The topics tab reports coverage per level, and the `untagged` filter is the
backlog — `/hsk/1/hanzi?topic=untagged` is the working queue.

---

## 8a. Grammar lessons

> "Fill in grammar lessons for HSK 1"

Grammar is a first-class curriculum, not a topic tag. One file per lesson in
`content/grammar/<id>.md`. Copy `content/_TEMPLATE.grammar.md`.

- **The lesson owns the links.** List related hanzi and words on the lesson.
  Do not add grammar ids to hanzi/word files — the build inverts membership.
- **Level and order.** `level` is the HSK band the lesson belongs to. `order`
  is unique within that band and is the curriculum sort key. Multi-level browse
  groups by authored level; it does not merge order across bands.
- **Prerequisites** are other lesson ids, same or lower level, with no cycles.
- **Examples are i+1.** Every character in `examples[].cmn` must already be
  known at the lesson’s level. `check:content` enforces this.
- **`## Pattern` and `## Usage` stay separate from vocabulary etymology.** A
  lesson explains a structure; it does not invent character history.
- Wikilinks: `[[是]]` for hanzi, `[[老师]]` for words, `[[grammar:ma-yes-no]]`
  for another lesson.
- Batches of **≤25 lessons, one level at a time**, then `pnpm check:content`.

Reviewed lessons need sources, a `## Pattern` section, and at least one example.

---

## 9. Batch protocol

```bash
# 1. write ≤25 entries into content/hanzi/, content/words/,
#    content/relations/, content/lexemes/, or content/grammar/
pnpm check:content     # schema, component checks, topics, and relations
pnpm data:build        # regenerate app data
pnpm data:md           # regenerate docs/hsk/ study lists
pnpm test              # dataset invariants

git add content docs
git commit -m "content: HSK 1 hanzi batch N (25 entries)"
```

Commit per batch. A 25-entry diff is reviewable; a 300-entry diff is not, and
this content is only worth anything if it is actually checked.

**Do not edit** `docs/hsk/**` or `app/data/generated/**` by hand — both are
generated, and your edits will be silently overwritten on the next build.
