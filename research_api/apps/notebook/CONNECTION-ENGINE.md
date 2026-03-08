# The CommonPlace Connection Engine

A plain-English guide to how CommonPlace discovers, explains, and stores
relationships between your knowledge Objects.

---

## What the engine does

When you capture a note, source, hunch, or any other Object, the connection
engine runs in the background. It reads the Object's content, scans your
existing knowledge graph, and creates **Edges** -- labeled, explained
connections between that new Object and others that relate to it.

Every Edge has three things:

1. **A type** -- what kind of relationship this is (`shared_topic`, `semantic`, `contradicts`, etc.)
2. **A reason** -- a plain-English sentence explaining *why* the connection exists
3. **A strength** -- a float from 0.0 to 1.0 indicating confidence

The engine also creates a **Node** on your Timeline for every new Edge it
discovers, so your connection history is immutably timestamped.

---

## The seven passes

The engine runs up to seven passes on every Object, in order. Each pass uses a
different technique and catches a different class of relationship. They are
additive -- later passes find connections that earlier ones miss, not duplicates.

```
Object saved
     |
     v
Pass 1: spaCy NER -- extract named entities
     |
     v
Pass 2: Shared entities -- who else mentions the same people, places, orgs?
     |
     v
Pass 3: Jaccard keywords -- what else overlaps in vocabulary?
     |
     v
Pass 4: TF-IDF corpus -- what else shares rare, distinctive terminology?
     |
     v
Pass 5: SBERT semantic -- what else means the same thing in different words?
     |
     v
Pass 6: NLI -- does this contradict or support anything already in the graph?
     |
     v
Pass 7: KGE structural -- what else plays the same role in the graph?
     |
     v
Connection Nodes written to Timeline
```

---

## Pass 1: Named entity extraction (spaCy NER)

**What it does:** Reads the Object's title, body, and all Component values.
Runs spaCy's `en_core_web_sm` NER model to identify named entities.

**Entity types it recognizes:**
`PERSON`, `ORG`, `GPE` (places), `LOC`, `EVENT`, `WORK_OF_ART`, `DATE`

**What it produces:**
- `ResolvedEntity` records linking entities to their source Object
- Edges of type `mentions` if the entity matches an existing Object in the graph

**Example:**

You capture a Hunch:

> *"Jane Jacobs was right about Robert Moses -- the highways destroyed more
> communities than they connected."*

spaCy extracts:
- `Jane Jacobs` (PERSON)
- `Robert Moses` (PERSON)

If you already have a Person Object for Jane Jacobs, the engine creates:

```
Edge: Hunch --> Person: Jane Jacobs
  type: mentions
  reason: "This note mentions Jane Jacobs (person)."
  strength: 0.7
  engine: spacy
```

If Robert Moses doesn't exist yet, Pass 1 sets up the entity record.
Auto-objectification (part of Pass 1) then creates a new Person Object for him.

---

## Pass 2: Shared entity connections

**What it does:** Looks at every entity extracted from this Object and finds
all *other* Objects that contain the same entity. Creates `shared_entity` Edges
between them.

**Logic:** If Object A and Object B both mention "Jane Jacobs," they are
probably connected -- regardless of whether they share any other vocabulary.

**Example:**

You have three existing Objects:

- Source: *"The Death and Life of Great American Cities"* -- mentions Jane Jacobs
- Note: *"Street-level retail and foot traffic"* -- mentions Jane Jacobs
- Quote: *"Cities have the capability of providing something for everybody..."* -- by Jane Jacobs

Your new Hunch (from Pass 1 above) also mentions Jane Jacobs. Pass 2 creates:

```
Edge: Hunch --> Source: "Death and Life..."
  type: shared_entity
  reason: "Both mention Jane Jacobs, the same person."
  strength: 0.6

Edge: Hunch --> Note: "Street-level retail..."
  type: shared_entity
  reason: "Both mention Jane Jacobs, the same person."
  strength: 0.6

Edge: Hunch --> Quote: "Cities have the capability..."
  type: shared_entity
  reason: "Both mention Jane Jacobs, the same person."
  strength: 0.6
```

Three connections, zero text overlap required.

---

## Pass 3: Jaccard keyword similarity

**What it does:** Extracts significant keywords (3+ characters, not stop words)
from the Object's full text. Computes Jaccard similarity against the same keyword
set for every other Object in the corpus. Creates `shared_topic` Edges for
pairs that exceed the threshold.

**Jaccard similarity** = overlapping keywords / all keywords (union)

Default threshold: 0.30. At high novelty settings: 0.10.

**Example:**

Your new Note:

> *"Parking minimums in American cities force developers to dedicate land to car
> storage, raising housing costs and making walkable neighborhoods financially
> impossible to build."*

Keywords extracted: `parking`, `minimums`, `american`, `cities`, `force`,
`developers`, `dedicate`, `land`, `car`, `storage`, `raising`, `housing`,
`costs`, `walkable`, `neighborhoods`, `financially`, `impossible`, `build`

Existing Hunch in your graph:

> *"What if parking lots could be converted to housing? The land exists,
> the infrastructure exists, cities just need to stop requiring so much storage."*

Keywords: `parking`, `lots`, `converted`, `housing`, `land`, `exists`,
`infrastructure`, `cities`, `stop`, `requiring`, `storage`

Overlap: `parking`, `land`, `housing`, `cities`, `storage` -- 5 words
Union: 24 words
Jaccard: 5/24 = 0.21

At default threshold (0.30) this misses. At high novelty (0.10) it creates:

```
Edge: Note --> Hunch: "What if parking lots..."
  type: shared_topic
  reason: "Both explore parking, housing, land and storage."
  strength: 0.42  (min(0.21 * 2, 1.0))
  engine: spacy
```

---

## Pass 4: TF-IDF corpus similarity

**What it does:** Builds a TF-IDF matrix over all Objects in the corpus
(up to 2,000 most recent). Computes cosine similarity between the new Object's
vector and every other row in the matrix. Creates `shared_topic` Edges for
pairs above threshold.

**Why this catches things Jaccard misses:** TF-IDF downweights terms that
appear in many Objects (common words) and upweights terms that appear in few
Objects (rare, distinctive words). A note that uses the word "induced demand"
will score highly against another note that uses the same phrase, even if they
share no other vocabulary, because "induced demand" is rare enough that IDF
amplifies it.

Default TF-IDF threshold: 0.25

**Example:**

Two Objects in your graph that Jaccard scored at 0.08 (missed):

Object A -- Source:
> *"Highway expansion consistently fails to reduce congestion. As road capacity
> increases, latent demand activates and fills it. This phenomenon -- induced
> demand -- has been documented in dozens of metropolitan studies."*

Object B -- Note:
> *"Every time they add a lane to the 405, it's full within a year.
> The fundamental problem with American transportation planning is that
> supply creates its own demand. We keep building our way into gridlock."*

Jaccard misses this because they share very few exact words. TF-IDF catches it
because "demand," "capacity," "congestion," and "lane" are rare enough in your
corpus to register. Cosine similarity: 0.34.

```
Edge: Source --> Note: "Every time they add a lane..."
  type: shared_topic
  reason: "This source and this note share significant vocabulary and
           terminology (TF-IDF similarity: 34%)."
  strength: 0.34
  engine: tfidf
```

The TF-IDF corpus is cached in memory. It rebuilds automatically when the
corpus grows by 50+ Objects or after one hour, whichever comes first.

---

## Pass 5: SBERT semantic similarity

**What it does:** Encodes the Object's full text into a 384-dimensional vector
using `sentence-transformers/all-MiniLM-L6-v2`. Searches the FAISS ANN index
(or falls back to batch encoding all candidates) for Objects with cosine
similarity above threshold.

**Why this catches things TF-IDF misses:** SBERT encodes *meaning*, not
vocabulary. Two Objects can use completely different words and still be close
in semantic space if they describe the same concept. This is the engine's most
powerful pass for finding non-obvious conceptual connections.

Default SBERT threshold: 0.45

**Example:**

Two Objects that share zero keywords:

Object A -- Concept:
> *"Desire paths are the informal trails worn into grass by pedestrians ignoring
> the official paved walkways. They reveal the gap between designed systems
> and how people actually want to move."*

Object B -- Hunch:
> *"I keep thinking about how nobody uses the front door of their house anymore.
> We all come in through the garage. The architects design for formality;
> residents optimize for habit."*

No shared vocabulary beyond common words. Jaccard: 0.04. TF-IDF: 0.09.
But semantically, both Objects are about the same thing: the gap between
designed intention and lived behavior. SBERT similarity: 0.67.

```
Edge: Concept: "Desire paths" --> Hunch: "Nobody uses the front door..."
  type: semantic
  reason: "This concept and this hunch explore related themes
           (semantic similarity: 67%)."
  strength: 0.67
  engine: sbert
```

When FAISS index is available (built after 5+ Objects), this pass uses
approximate nearest-neighbor search -- it does not encode every candidate
on every run.

---

## Pass 6: NLI contradiction and support detection

**What it does:** Uses the SBERT pass as a pre-screen to find topically similar
Objects (similarity gate: 0.40). Then runs a cross-encoder NLI model
(`cross-encoder/nli-distilroberta-base`) on each candidate pair to classify the
logical relationship as contradiction, entailment, or neutral.

**Why this matters:** Two Objects can be topically related but intellectually
opposed. NLI detects that and creates a `contradicts` Edge, surfacing genuine
tension in your thinking rather than burying it as "similar."

Contradiction threshold: 0.60 probability
Entailment threshold: 0.65 probability

**Example -- contradiction:**

Object A -- Source:
> *"Robert Moses's parkways and urban renewal projects were necessary for
> modernizing New York. The communities displaced were the unfortunate cost
> of progress and regional connectivity."*

Object B -- Note (from a Jane Jacobs biography):
> *"Moses systematically destroyed functioning, mixed-income neighborhoods
> by routing highways through them. The Cross Bronx Expressway alone displaced
> 60,000 residents, eliminating the social fabric of entire communities."*

SBERT similarity: 0.71 (passes the 0.40 gate)
NLI contradiction probability: 0.78

```
Edge: Source --> Note: "Moses systematically destroyed..."
  type: contradicts
  reason: "This source and this note discuss related topics (similarity: 71%)
           but appear to make conflicting claims (contradiction probability: 78%).
           This may represent a genuine intellectual tension worth examining."
  strength: 0.55  (0.78 * 0.71)
  engine: nli
```

**Example -- support:**

Object A -- Hunch:
> *"Parking minimums are a subsidy to car ownership, not a neutral zoning
> requirement. They transfer the cost of car storage from drivers to everyone else."*

Object B -- Source (Donald Shoup, "The High Cost of Free Parking"):
> *"Minimum parking requirements act as a massive, hidden subsidy for driving.
> They inflate construction costs, reduce density, and externalize the cost
> of car storage onto all users of a building, regardless of whether they drive."*

SBERT similarity: 0.81
NLI entailment probability: 0.74

```
Edge: Hunch --> Source: "The High Cost of Free Parking"
  type: supports
  reason: "This hunch and this source discuss related topics (similarity: 81%)
           and appear to reinforce each other (agreement probability: 74%)."
  strength: 0.60  (0.74 * 0.81)
  engine: nli
```

---

## Pass 7: KGE structural similarity

**What it does:** Loads pre-trained RotatE embeddings (trained offline via
`python manage.py export_kge_triples` + `python scripts/train_kge.py`).
Each Object has a 128-dimensional embedding learned from its position in the
Edge graph -- not from its text. Finds Objects with high cosine similarity in
embedding space.

**Why this catches things all other passes miss:** KGE encodes *structural role*,
not content. Two Objects that are consistently cited together, or that cite the
same third Objects, will be structurally close even if they are about completely
different topics. This reveals objects that play the same *function* in your
knowledge graph -- bridge concepts, recurring references, organizational anchors.

Default KGE threshold: 0.60

**Example:**

In your graph, you have:

- Source: *"A Pattern Language"* (Christopher Alexander)
- Source: *"The Death and Life of Great American Cities"* (Jane Jacobs)

Both are cited by many of your Notes and Hunches. Both are connected to your
Concepts for "urban design," "community," and "human scale." Neither mentions
the other and they share few keywords. But in the graph, they occupy nearly
identical structural positions -- highly cited generalist sources that anchor
clusters of connected ideas.

RotatE structural similarity: 0.73

```
Edge: Source: "A Pattern Language" --> Source: "Death and Life..."
  type: shared_topic
  reason: "This source and this source occupy structurally similar positions
           in the knowledge graph -- they are cited by, or cite, similar things
           (graph similarity: 73%). They may play the same conceptual role
           in different contexts."
  strength: 0.73
  engine: kge
```

This connection is invisible to every text-based pass. KGE sees it because
the graph structure encodes it.

---

## LLM explanation (optional)

When `COMMONPLACE_LLM_EXPLANATIONS=true` is set and a connection strength
exceeds 0.55, the engine calls Claude Haiku to replace the template-generated
reason with a specific, hand-crafted explanation.

**Template reason (Jaccard, Pass 3):**

> "Both explore parking, housing, land and storage."

**LLM reason (same connection):**

> "Both examine how parking minimums function as a hidden land tax that
> subsidizes car ownership at the expense of housing density and walkability."

The LLM reason is one sentence, specific to the actual content, and names
the connecting idea rather than describing the similarity. It is constrained
to 80 tokens to keep it concise.

---

## Edge types reference

| Type | Engine | What it means |
|------|--------|---------------|
| `mentions` | spaCy | Object directly references this entity |
| `shared_entity` | spaCy | Both mention the same named person, place, or org |
| `shared_topic` | Jaccard, TF-IDF, KGE | Both discuss overlapping themes or vocabulary |
| `semantic` | SBERT | Conceptually similar in meaning, possibly no shared words |
| `contradicts` | NLI | Related topics, opposing claims -- genuine intellectual tension |
| `supports` | NLI | Related topics, mutually reinforcing claims |
| `related` | Signal/manual | User-defined or component-driven relationship |
| `manual` | User | Explicitly drawn by you |

---

## How the engine decides what to run

The active passes depend on three things:

**1. Notebook engine config** -- each Notebook can override settings:
```json
{
  "engines": ["spacy", "sbert", "tfidf", "kge"],
  "topic_threshold": 0.15,
  "sbert_threshold": 0.45,
  "nli_enabled": true
}
```

**2. Corpus size** -- TF-IDF auto-activates at 500+ Objects regardless of config.
Below that, the corpus is too small for IDF to be meaningful.

**3. The novelty dial** -- a 0.0 to 1.0 slider that interpolates between a
conservative config (spaCy only, strict threshold) and an aggressive config
(all engines, loose threshold). At 0.0, you see only high-confidence connections.
At 1.0, you see everything the engine can find.

---

## What gets written to the Timeline

For every new Edge created during an engine run, a Node is added to the master
Timeline:

```
Node: connection
  title: "Desire paths <> Nobody uses the front door..."
  body: "This concept and this hunch explore related themes (semantic similarity: 67%)."
  object_ref: Concept: "Desire paths"
  tags: ["engine", "semantic"]
  occurred_at: 2026-03-08T14:32:00
```

This means your connection history is immutable and timestamped. You can look
at the Timeline and see exactly when the engine discovered that two things were
related, and what the reason was at that moment.

---

## Engine run summary (what you see in the logs)

After each run, the engine logs a results dict:

```python
{
  "engines_active": ["spacy", "tfidf", "sbert", "kge"],
  "entities_extracted": 3,
  "edges_from_entities": 2,
  "edges_from_shared": 4,
  "edges_from_topics": 1,
  "edges_from_tfidf": 2,
  "edges_from_semantic": 3,
  "edges_from_nli": 1,
  "edges_from_kge": 2,
  "objects_auto_created": 1,
  "connection_nodes_created": 13
}
```

This is also the response body of the `run_connection_engine` management command
when run on a single Object.

---

## Running the engine manually

```bash
# Run on all Objects
python manage.py run_connection_engine

# Run on a single Object by ID
python manage.py run_connection_engine --object-id 42

# Run on all Objects in a specific Notebook
python manage.py run_connection_engine --notebook housing-research

# Sync the research bridge (connects notebook Objects to research Sources)
python manage.py sync_research_bridge

# Export triples for KGE training
python manage.py export_kge_triples

# Train KGE embeddings (local only, requires PyTorch)
python scripts/train_kge.py
```

---

## Production vs. local behavior

| Pass | Production (Railway) | Local (PyTorch installed) |
|------|---------------------|--------------------------|
| 1. spaCy NER | Yes | Yes |
| 2. Shared entities | Yes | Yes |
| 3. Jaccard | Yes | Yes |
| 4. TF-IDF | Yes (auto at 500+ objects) | Yes |
| 5. SBERT | No (silent skip) | Yes (FAISS if built) |
| 6. NLI | No (silent skip) | Yes (if `nli_enabled: true`) |
| 7. KGE | No (silent skip) | Yes (if embeddings trained) |

The API response shape is identical in both modes. No errors. No warnings to the user.
Passes that cannot run are simply absent from the results dict.
