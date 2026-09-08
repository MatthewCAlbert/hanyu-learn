# Lexical Relations Playbook

How to author **hanzi↔word contribution**, **textbook vs everyday usage**,
and **sense-specific synonyms / antonyms / real-life alternatives**.

Read [RESEARCH-PLAYBOOK.md](RESEARCH-PLAYBOOK.md) first for etymology, formation,
and the batch protocol. This file is the extra contract for relations. **Unsourced
beats wrong.** A confident, interchangeable-looking synonym pair that is not
actually interchangeable is worse than a blank.

---

## 1. Invocation contract

> "Tag synonym/register relations for HSK 1 words" ·
> "Add character contributions for HSK 1 words" ·
> "Fill real-life alternatives for HSK 2" ·
> "Add Extra spoken/chat lexemes" ·
> "Add spoken/chat forms that are not HSK words"

On that request:

1. Read this playbook and the source table in [DATA-SOURCES.md](DATA-SOURCES.md).
2. Find the backlog: high-frequency words at **that level only**, then
   `docs/hsk/level-N/relations.md` (generated; do not edit).
3. Work in **frequency order**. Frequent words repay usage notes the most.
4. Work in batches of **≤25 entries**, then validate and commit (same gate as
   the research playbook).

For Extra spoken/chat lexemes specifically:

1. Read this playbook. Do **not** add forms to `extra-vocabulary.json`.
2. Review surface: `docs/extra/lexemes.md` (generated; do not edit).
3. Skip any form that is already an HSK or Extra **word**. If it is already an
   HSK **hanzi** (e.g. a slang sense of 牛), write it on the hanzi page.
4. Prefer a `register-set` with a textbook counterpart when one exists.
5. Do not label a form “slang” unless that is the attested register. Keep
   register, context, region, and currency as separate fields.

Never batch two levels together. Candidate generation may cover the whole corpus;
only **reviewed** claims are learner-facing.

---

## 2. Three layers that must not be mixed

| Layer | Answers | Where it lives | Who may invent it |
|---|---|---|---|
| **Containment** | Which words contain this character? | Derived at build (`Hanzi.words`) | Nobody — it is mechanical |
| **Semantic contribution** | What does this character do *in this word*? | Optional `chars:` on `content/words/<word>.md` | Reviewed interpretation, cited |
| **Lexical relation** | Which other forms contrast with this sense? | `content/relations/<id>.md` | Reviewed interpretation, cited |

Containment is not meaning. 东 is inside 东西; that does not make 东 “thing.”
HSK membership is not everyday frequency. A dictionary gloss overlap is not
synonymy.

### Character contribution (the edge)

On a word file, each character may carry:

| Field | Values | Meaning |
|---|---|---|
| `role` | `semantic` · `grammatical` · `phonetic` · `transliteration` | What the character is *doing* |
| `transparency` | `transparent` · `shifted` · `fossilized` · `unknown` | How honestly that role still shows |
| `contribution` | short prose | The sense it supplies here |
| `salience` | `primary` · `secondary` · `none` | Teaching priority under that hanzi |

**`opaque` is not a role.** Word-level `transparency: opaque` already means
“the word is not derivable.” A character inside an opaque word is usually
`fossilized` or `unknown`, still with a real role (semantic, grammatical, …).

Do not require a bulk migration. Words without `chars:` stay derived-only.

Zero contribution notes is a correct answer when the combination is already
fully explained under `## Why this combination` and nothing extra would help.

### Real-life forms outside HSK

Spoken, chat, slang, or regional forms that are **not** corpus words go in
`content/lexemes/<form>.md`. They may sit on a relation without changing pinned
HSK counts. Do **not** force 啥 through `extra-vocabulary.json` (that list is
multi-character names the HSK hanzi set can already spell).

---

## 3. Evidence labels

Every reviewed usage or relation claim is one of:

| Code | Name | What it is allowed to support |
|---|---|---|
| O | Orthographic | Containment, script mapping |
| N | Normative | Official HSK / education lists |
| C | Corpus | Count, collocation, KWIC — **usage, not meaning** |
| L | Lexicographic | Curated definition or sense relation |
| M | Model-derived | Segmentation, embedding, sememe similarity — **candidates only** |
| R | Reviewed | This repo’s conclusion, citing the above |

**Hard boundaries**

- Corpora demonstrate usage, not synonymy.
- Lexicons describe senses, not present-day frequency.
- HSK describes pedagogy, not natural prevalence.
- Absence from one corpus is only “not observed in that snapshot.”
- OpenHowNet “same sememe” is **not** synonymy. Chinese WordNet is sense-level
  and often Taiwan/traditional — verify Mainland form and register separately.

Confidence:

| | Usage | Synonym / antonym |
|---|---|---|
| **high** | Two independent corpus families *or* a current lexicographic label plus reviewed KWIC, with contextual diversity | Sense-level curated relation **and** matching POS/register **and** a substitution/contrast check |
| **medium** | One strong source, or several older/mixed-domain sources | One strong lexicon plus a caution |
| **low** | Gloss overlap, a single hit, unclear segmentation | Candidate only — do not mark `reviewed` |

Required provenance when you cite a corpus: source, version/snapshot, access
date, licence, query, tokenizer/segmentation, genre/date filters. Store the
**query record**, not the corpus text.

---

## 4. Source hierarchy (relations and usage)

**Tier 1 — cite freely (with the licence notes in DATA-SOURCES.md)**

- Official HSK lists — **textbook status only**
- Unicode Unihan — character metadata, not word meaning
- 现代汉语词典 (current ed.) — sense, register labels, antonyms
- CC-CEDICT — gloss lead; follow through to a real source before `reviewed`

**Tier 2 — cite with attribution; do not vendor restricted text**

- Chinese Lexical Database (metrics) — GPL; isolate if redistributed
- BLCU BCC / PKU CCL — query services; commercial scrape/redistribution is not
  licensed. Record the query, not the concordance dump.
- SUBTLEX-CH — everyday-*exposure proxy* only after licence clearance; research
  use is not a redistribution licence.

**Tier 3 — a lead, never a citation**

- Wiktionary, learner forums, “native speaker reddit,” ChatGPT.
- OpenHowNet / embeddings: candidate generation only.

**Never**

- Collapse several corpora into one “real-life score.”
- Compare raw counts across corpora (different size, genre, tokenizer).
- Call 啥 universally “slang.” Register, context, region, and currency are
  four fields. 啥 is colloquial, used in speech and chat, northern-origin /
  northern-associated, and now widely understood.

---

## 5. Relation kinds

Authored in `content/relations/<id>.md`. The set of files is the vocabulary.

| `kind` | UI label | Shape |
|---|---|---|
| `register-set` | **Real-life alternatives** | 2–6 forms of one sense, different register/context/region |
| `synonym-set` | **Similar words** | 2–6 near-synonyms; **not** interchangeable by default |
| `antonym-pair` | **Opposites** | Exactly two members, opposite on a named `axis` |

Each member records:

- `form` + `kind` (`word` · `hanzi` · `lexeme`)
- optional compact UI `role`: `textbook` · `everyday` · `conversation` · `chat` · `formal` · `regional`
- `register`, `contexts`, `regions`, `currency`
- `sense` and `pos` when the form is ambiguous

`## Distinctions` is required for `reviewed`. `## Corpus evidence` is required
when any usage claim is more than a dictionary label.

Near-synonym rules:

- Note collocations (进行会议 vs 做工作).
- If you cannot say when *not* to substitute, the cluster is not ready.

Antonym rules:

- Oppose on **one** named axis (start/finish a class, not “school in general”).
- 上课 ↔ 下课 is a pair. 上课 ↔ 放学 is a different axis.

Hanzi–word teaching highlights live on `chars:.salience`, not as a fourth
relation kind. The complete containing-word list stays derived.

---

## 6. Definition of done

A **character-link** batch is done when:

- [ ] Each `chars:` row names a character actually in the word
- [ ] Role is one of the four; transparency is not `opaque`
- [ ] `salience: primary` is rare — only the compounds a learner should meet first
- [ ] `pnpm check:content` passes

A **relation** is done when:

- [ ] Filename = `relation:` id (kebab-case)
- [ ] Members exist in the corpus or as lexemes; no duplicates
- [ ] Kind cardinality holds (pair = 2; sets = 2–6)
- [ ] `reviewed` ⇒ non-empty `sources` + `## Distinctions`
- [ ] UI-facing claims use learner labels, never schema names
- [ ] `pnpm check:content` passes

A **lexeme** is done when:

- [ ] The form is **not** already an HSK/Extra word
- [ ] Register, context, region, and currency are separate
- [ ] Sources non-empty if `reviewed`

Worked examples: `content/words/{什么,东西,咖啡,电脑}.md`,
`content/relations/{what-question,happy-near-synonyms,doctor-register}.md`,
`content/lexemes/啥.md`.

---

## 7. Batch protocol

Same as the research playbook, plus relation files:

```bash
# 1. write ≤25 word overlays and/or relation/lexeme files
pnpm check:content
pnpm data:build
pnpm data:md
pnpm test

git add content docs
git commit -m "content: HSK 1 relations batch N"
```

Do not edit `docs/hsk/**` or `app/data/generated/**` by hand.

After the first 25-entry HSK 1 batch, stop and check: false synonym candidates,
corpus disagreement, minutes per item, prompt size, whether learners understand
**Real-life alternatives**. Freeze the taxonomy only after that review.

---

## 8. Deferred: medium-confidence HSK 5–7 pairs

A 2026 pass manually vetted 93 candidate near-synonym/register pairs for
HSK 5–7 (this band has almost no authored cross-reference wikilinks yet, so
candidate-mining per §1 barely surfaces anything there — these came from a
curated list of classic 近义词辨析 pairs checked against the corpus instead).
32 were dropped outright as false positives or too-subtle-to-source. Of the
remaining 61, only the **36 high-confidence** ones were authored (as 35
relations — two pairs sharing 互相 were merged into one three-way
`mutually-synonyms` instead of two overlapping relations). The other **25
medium-confidence pairs** were deliberately left unauthored: each has a real,
statable distinction, but the distinction is subtler, harder to cite
cleanly, or more likely to draw disagreement than the high-confidence tier.

Deferred pairs (kind, tentative axis):

| Pair | Kind | Note |
|---|---|---|
| 承诺 / 保证 | synonym | promise vs guarantee — overlap, strength differs |
| 呈现 / 展现 | synonym | passive presenting vs active showing |
| 执行 / 履行 | synonym | carry out orders vs fulfil an obligation |
| 改良 / 改进 | synonym | reform a system vs improve a method |
| 扩大 / 扩张 | synonym | neutral vs connotation of aggression/overreach |
| 扩展 / 拓展 | synonym | expand vs develop (business/market) |
| 削弱 / 减弱 | synonym | deliberate/transitive vs gradual/general weakening |
| 稳定 / 安定 | synonym | general stability vs social/political stability |
| 宽容 / 包容 | synonym | tolerant vs inclusive/embracing |
| 从容 / 镇定 | synonym | unhurried composure vs composure under pressure |
| 忧虑 / 焦虑 | synonym | worry vs clinical/intense anxiety |
| 烦恼 / 苦恼 | synonym | annoyance vs deeper distress |
| 悲痛 / 悲哀 | synonym | grief (e.g. death) vs general sorrow |
| 快乐 / 欢乐 | synonym | personal happiness vs collective/festive joy |
| 冷淡 / 冷漠 | synonym | cold toward someone vs general apathy |
| 冷漠 / 漠然 | synonym | indifferent vs literary "nonchalant" |
| 诚恳 / 诚挚 | synonym | both fairly formal, sincerity register overlap |
| 真诚 / 真挚 | synonym | sincere/genuine vs heartfelt (feelings, friendship) |
| 狡猾 / 奸诈 | synonym | cunning vs treacherous — degree/moral loading |
| 刻苦 / 努力 | synonym | enduring-hardship register vs basic "try hard" |
| 奋斗 / 拼搏 | synonym | strive vs all-out fight (sports/competition flavour) |
| 持续 / 延续 | synonym | continue vs extend/carry forward (e.g. a tradition) |
| 间断 / 中断 | synonym | discontinuous/intermittent vs a single interruption |
| 长久 / 长远 | synonym | long-lasting (duration) vs long-term (perspective) |
| 局部 / 部分 | synonym | technical/anatomical "local" vs general "part" |

**Revisit prompt:** *"Review the deferred medium-confidence pairs in
LEXICAL-RELATIONS-PLAYBOOK.md §8 — for each, decide keep (author it, citing
a real source per §3/§4) or drop (the distinction doesn't hold up / isn't
learner-useful), then update this table to remove resolved rows."* Work in
the usual ≤25 batch, and remove a row here the moment its relation is
authored or it is formally rejected — this table is a backlog, not a
permanent record.
