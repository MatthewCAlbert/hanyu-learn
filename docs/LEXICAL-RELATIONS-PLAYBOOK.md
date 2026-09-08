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
> "Fill real-life alternatives for HSK 2"

On that request:

1. Read this playbook and the source table in [DATA-SOURCES.md](DATA-SOURCES.md).
2. Find the backlog: high-frequency words at **that level only**, then
   `docs/hsk/level-N/relations.md` (generated; do not edit).
3. Work in **frequency order**. Frequent words repay usage notes the most.
4. Work in batches of **≤25 entries**, then validate and commit (same gate as
   the research playbook).

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
