// ── Node types for force tree and 3D graph ──

export interface TheseusNode {
  id: string;
  label: string;
  detail: string;
  color: string;
  radius: number;
  size3d: number;
  isHub: boolean;
  parentId: string | null;
  annotation: string;
}

export interface TheseusEdge {
  source: string;
  target: string;
  pass: string;
  strength: number;
  edgeType?: 'supports' | 'contradicts';
}

export interface ComparisonItem {
  prompt: string;
  gptResponse: string[];
  theseusResponse: string[];
}

export interface DomainScenario {
  id: string;
  domain: string;
  color: string;
  title: string;
  teaser: string;
  scenario: string;
  outcome: string;
}

export interface BeliefRow {
  domain: string;
  color: string;
  canonical: string;
  local: string;
  result: string;
}

// ── Hub nodes with leaf children ──

export const HUBS: {
  id: string;
  label: string;
  color: string;
  size: number;
  parentId: string | null;
  info: string;
  leaves: string[];
}[] = [
  {
    id: 'root',
    label: 'Connection Engine',
    color: '#C4503C',
    size: 0.5,
    parentId: null,
    info: '7-pass pipeline in engine.py. Two-mode deployment: Railway (spaCy+BM25+TF-IDF), Local (all 7 passes), Modal (GPU). Each pass reports complete/degraded/skipped to PassRibbon.',
    leaves: [],
  },
  {
    id: 'source',
    label: 'Source',
    color: '#1A7A8A',
    size: 0.3,
    parentId: 'root',
    info: 'Ingests PDF, DOCX, PPTX, images (OCR via SAM-2), code (tree-sitter AST). SHA-256 fingerprint via <code>_generate_sha()</code>.',
    leaves: [
      'PDF/DOCX/PPTX parser',
      'OCR via SAM-2 (Modal)',
      'tree-sitter AST',
      'SHA-256 addressing',
      'Component metadata',
      'URL/author extraction',
    ],
  },
  {
    id: 'concept',
    label: 'Concept',
    color: '#7050A0',
    size: 0.3,
    parentId: 'root',
    info: 'Auto-created by Adaptive NER. <code>adaptive_ner.py</code> PhraseMatcher learns from graph. Vocabulary grows with knowledge base.',
    leaves: [
      'Adaptive PhraseMatcher',
      'Graph-learned vocab',
      'Frequency promotion',
      'spaCy pipeline',
      'Cross-notebook matching',
    ],
  },
  {
    id: 'hunch',
    label: 'Hunch',
    color: '#C07040',
    size: 0.25,
    parentId: 'root',
    info: 'Low-confidence speculation. NLI detects support (entailment > 0.65). Auto-creates supports edges. Promotes to Claim on evidence.',
    leaves: [
      'Low-confidence capture',
      'NLI entailment > 0.65',
      'Auto supports edges',
      'Evidence scoring',
      'Promotion to Claim',
    ],
  },
  {
    id: 'note',
    label: 'Note',
    color: '#68666E',
    size: 0.25,
    parentId: 'root',
    info: 'Append-only. Immutable. retrospective_notes for additive annotation. SHA lineage across forks.',
    leaves: [
      'Append-only timeline',
      'Immutable records',
      'retrospective_notes',
      'SHA lineage',
      'Fork tracking',
    ],
  },
  {
    id: 'tension',
    label: 'Tension',
    color: '#B85C28',
    size: 0.3,
    parentId: 'root',
    info: 'NLI CrossEncoder: contradiction > 0.60. Strength = prob x similarity. _synthesize_contradiction_reason(). 4 types.',
    leaves: [
      'Contradiction > 0.60',
      'strength = prob x sim',
      'Plain-English reasons',
      'Counterargument type',
      'Publisher divergence',
      'Temporal gap (>5yr)',
      'Tag divergence',
    ],
  },
  {
    id: 'claim',
    label: 'Claim',
    color: '#3858B8',
    size: 0.3,
    parentId: 'root',
    info: 'Extracted via claim_decomposition.py. Deduplicated. Status lifecycle: candidate to accepted/contested. Pairwise NLI.',
    leaves: [
      'claim_decomposition.py',
      'Dedup by text',
      'claim_index ordering',
      'Status: candidate',
      'Status: accepted',
      'Status: contested',
      'Pairwise NLI',
    ],
  },
  {
    id: 'rule',
    label: 'Rule',
    color: '#A08020',
    size: 0.25,
    parentId: 'root',
    info: 'Compiled executable knowledge. Declarative, versioned, testable, provenance-linked.',
    leaves: [
      'Executable knowledge',
      'Declarative DSL',
      'Versioned + testable',
      'Provenance-linked',
      'captured to learned_from',
    ],
  },
  {
    id: 'passes',
    label: 'Engine Passes',
    color: '#C4503C',
    size: 0.3,
    parentId: 'root',
    info: '7 signals chained. Results merge by max score. Per-Notebook engine_config. Novelty Dial: 0.0 to 1.0.',
    leaves: [
      'Pass 1: NER (spaCy + adaptive)',
      'Pass 2: Shared entity edges',
      'Pass 3: BM25 lexical scoring',
      'Pass 4: SBERT semantic (ONNX)',
      'Pass 5: NLI stance detection',
      'Pass 6: KGE RotatE (PyKEEN)',
      'Pass 7: Causal DAG construction',
    ],
  },
  {
    id: 'infra',
    label: 'Infrastructure',
    color: '#4A7A5A',
    size: 0.3,
    parentId: 'root',
    info: 'ONNX Runtime on Railway worker. PyTorch on Modal GPU. PostgreSQL + pgvector + PostGIS. Redis + RQ queues.',
    leaves: [
      'Railway: Django + DRF web',
      'ONNX worker (no PyTorch)',
      'Modal: GPU compute',
      'PostgreSQL + pgvector',
      'PostGIS spatial',
      'Redis + RQ queues',
      'Silent degradation',
    ],
  },
];

// ── GPT vs Theseus comparisons ──

export const COMPARISONS: ComparisonItem[] = [
  {
    prompt:
      'Based on my research, does polymer X degrade faster in humid environments?',
    gptResponse: [
      'Based on general knowledge, polymers can degrade faster in humid environments due to hydrolysis.',
      'Studies suggest moisture accelerates chain scission in many polymer types.',
      'The specific rate depends on composition and conditions.',
      '<em>Note: I don\'t have access to your research data.</em>',
    ],
    theseusResponse: [
      '<span class="tag-contradiction">Contradiction</span> Your lab data (entries 47, 112, 183) shows accelerated degradation at >60% RH, but Smith et al. (2023) and Park et al. (2021) report stable performance.',
      '<span class="tag-connection">Connection</span> Both cited papers used climate-controlled chambers. Your lab runs ambient humidity. This methodological difference was not flagged.',
      '<span class="tag-gap">Gap</span> No source tests polymer X at >80% RH. Structural hole between your humidity cluster and aging cluster.',
      '<span class="tag-provenance">Provenance</span> 3 support, 2 contradict, 1 methodological tension. Every claim links to source material.',
    ],
  },
  {
    prompt:
      'What connections exist between my interview sources and the permit records?',
    gptResponse: [
      'I can help analyze connections if you share the documents.',
      'Common methods include entity resolution and timeline analysis.',
      'Look for shared names, dates, or addresses.',
      '<em>Note: I can only work with what you paste here.</em>',
    ],
    theseusResponse: [
      '<span class="tag-connection">Entity match</span> "The consultant" in Deposition B shares a phone number with J. Marcus, signatory on Contract C-12.',
      '<span class="tag-contradiction">Timeline conflict</span> Deposition A: project ended March 2022. Email E-4401: active correspondence through August 2022.',
      '<span class="tag-connection">Cluster</span> 14 documents group around one LLC referenced by three different names.',
      '<span class="tag-provenance">Traced</span> All connections link to source pages. Exportable as evidence brief.',
    ],
  },
  {
    prompt:
      'Where does my evidence disagree with the published consensus?',
    gptResponse: [
      'You would need to systematically compare your findings with published literature.',
      'A literature review is the standard approach.',
      'I can help structure a comparison if you describe your findings.',
      '<em>Note: I do not retain information between conversations.</em>',
    ],
    theseusResponse: [
      '<span class="tag-contradiction">3 active contradictions</span> between your evidence (142 objects) and canonical sources (28 references).',
      'Strongest: field observations contradict corridor plan walkability claims (7 observations vs. 1 plan).',
      '<span class="tag-gap">2 structural gaps</span>. No evidence addresses drainage or nighttime pedestrian counts.',
      '<span class="tag-provenance">Belief model</span> updated. 4 claims moved to "contested." Counterfactual available: "What if Source 12 is removed?"',
    ],
  },
];

// ── Domain scenarios ──

export const DOMAINS: DomainScenario[] = [
  {
    id: 'science',
    domain: 'Scientific Research',
    color: '#2D5F6B',
    title: 'Finding contradictions buried in 200 papers',
    teaser:
      'A materials scientist discovers her lab data contradicts two cited papers she never connected.',
    scenario:
      'She has three years of experiments and 200+ papers. The engine runs six ML signals across all of it and flags: her humidity conditions differ from the cited studies. Two papers she\'d never connected share methodology that explains the discrepancy.',
    outcome:
      'She writes a paper in half the time with stronger evidence chains. The contradiction was always there. No human could hold 200 sources in working memory.',
  },
  {
    id: 'medicine',
    domain: 'Emergency Medicine',
    color: '#C4503C',
    title: 'Drug interactions that clinical databases miss',
    teaser:
      'A hospital\'s adverse event reports contain a three-drug interaction no single system tracks.',
    scenario:
      'An ER pharmacist notices a cluster of reactions. The engine connects adverse event reports with case studies and dispensing logs. It surfaces a three-drug interaction: each pair is safe individually, but the triple combination is not flagged anywhere.',
    outcome:
      'The interaction is reported, protocols updated. The pattern was spread across three separate systems.',
  },
  {
    id: 'archaeology',
    domain: 'Archaeology',
    color: '#C49A4A',
    title: 'Connecting fieldwork separated by decades',
    teaser:
      'Two dig sites share pottery techniques that suggest trade routes nobody has proposed.',
    scenario:
      'The engine ingests field reports from six Mediterranean sites spanning 40 years. Semantic similarity finds kiln temperature descriptions from a 1987 Turkish site match a 2019 Cypriot excavation. The knowledge graph reveals a cluster of shared techniques with no documented trade connection.',
    outcome:
      'A new hypothesis about Bronze Age trade routes, supported by evidence no single archaeologist had seen together.',
  },
  {
    id: 'climate',
    domain: 'Climate Science',
    color: '#6B4F7A',
    title: 'When local measurements diverge from regional models',
    teaser:
      'A research station\'s 15 years of soil moisture data tells a different story than the satellite model.',
    scenario:
      'The engine surfaces a tension: soil moisture readings diverged from the model in 2018 and never reconverged. Gap analysis reveals no publication addresses the divergence. Maintenance logs show a sensor recalibration that same year.',
    outcome:
      'Two hypotheses surfaced: sensor drift or genuine microclimate anomaly. Provenance tracing helped design the right follow-up study.',
  },
  {
    id: 'legal',
    domain: 'Legal Discovery',
    color: '#4A7A5A',
    title: 'Finding the email that connects two depositions',
    teaser:
      '50,000 documents. The connection is between page 847 and page 12,400.',
    scenario:
      'NER identifies that "the consultant" in one deposition shares a phone number with a contract signatory. NLI flags that deposition testimony about timelines contradicts dates in the email chain.',
    outcome:
      'The legal team finds their strongest impeachment evidence. Entity resolution and contradiction detection across 50,000 pages surfaced it.',
  },
  {
    id: 'supply',
    domain: 'Supply Chain Risk',
    color: '#4A6A8A',
    title: 'Seeing the cascade before it happens',
    teaser:
      'Three "independent" suppliers share a single sub-supplier for a critical component.',
    scenario:
      'Community detection reveals the hidden dependency. Counterfactual simulation (L7) answers: "What happens to production if this sub-supplier fails?" The dependency cascade spans four tiers.',
    outcome:
      'The manufacturer diversifies before the disruption. The hidden dependency was always in the data. Graph analysis made it visible.',
  },
];

// ── Belief revision table ──

export const BELIEF_ROWS: BeliefRow[] = [
  {
    domain: 'Pharmacology',
    color: '#2D5F6B',
    canonical: 'Drug A and B are safe to co-prescribe',
    local: 'Adverse event cluster when combined with Drug C',
    result: 'Tension flagged',
  },
  {
    domain: 'Journalism',
    color: '#C4503C',
    canonical: 'Official: "isolated incident"',
    local: 'Records show repeated pattern across 3 years',
    result: 'Contradiction surfaced',
  },
  {
    domain: 'Archaeology',
    color: '#C49A4A',
    canonical: 'No documented trade between Site A and B',
    local: 'Matching kiln techniques 32 years apart',
    result: 'Gap identified',
  },
  {
    domain: 'Climate',
    color: '#6B4F7A',
    canonical: 'Regional model predicts steady soil moisture',
    local: 'Station data diverged in 2018',
    result: 'Contradiction surfaced',
  },
  {
    domain: 'Legal',
    color: '#4A7A5A',
    canonical: 'Deponent: no involvement after 2019',
    local: 'Emails show activity through 2021',
    result: 'Contradiction surfaced',
  },
  {
    domain: 'Supply Chain',
    color: '#4A6A8A',
    canonical: 'Three independent suppliers = redundancy',
    local: 'All share one sub-supplier',
    result: 'Hidden dependency',
  },
];

// ── Engine passes ──

export const ENGINE_PASSES = [
  {
    num: 1,
    name: 'Named Entity Recognition',
    tool: 'spaCy + graph-learned phrases',
    detail:
      'Extracts people, organizations, places, and domain concepts. A custom PhraseMatcher learns new entities from the graph itself.',
  },
  {
    num: 2,
    name: 'Lexical Scoring',
    tool: 'BM25 retrieval',
    detail:
      'Finds documents with overlapping terminology. Fast, interpretable, catches exact-match relationships semantic models miss.',
  },
  {
    num: 3,
    name: 'Semantic Similarity',
    tool: 'SBERT via ONNX Runtime',
    detail:
      'Embeds every object into a vector space. "Walkability" connects to "pedestrian infrastructure" without shared terms.',
  },
  {
    num: 4,
    name: 'Stance Detection',
    tool: 'NLI classification',
    detail:
      'Classifies whether claims support, contradict, or are neutral toward each other. This makes contradiction tracking possible.',
  },
  {
    num: 5,
    name: 'Structural Similarity',
    tool: 'RotatE via PyKEEN',
    detail:
      'Embeds graph structure into vector space. Finds entities in similar structural positions. Detects analogies across domains.',
  },
  {
    num: 6,
    name: 'Community Detection',
    tool: 'Louvain + gap analysis',
    detail:
      'Discovers clusters and identifies structural holes between them. A gap between clusters means your understanding is thin.',
  },
];

export const INTELLIGENCE_LEVELS = [
  { level: 1, name: 'Tool Inference', desc: 'Pre-trained models via ONNX' },
  { level: 2, name: 'Learned Scoring', desc: 'User feedback trains weights' },
  { level: 3, name: 'Hypothesis Gen', desc: 'Fine-tuned LM proposes links' },
  {
    level: 4,
    name: 'Emergent Ontology',
    desc: 'Categories nobody defined',
  },
  {
    level: 5,
    name: 'Self-Modifying',
    desc: 'Pipeline reweights passes',
  },
  {
    level: 6,
    name: 'Multi-Agent',
    desc: 'Sessions debate explanations',
  },
  {
    level: 7,
    name: 'Counterfactual',
    desc: '"What if this source is removed?"',
  },
  {
    level: 8,
    name: 'Creative Hypothesis',
    desc: 'GNNs generate novel links',
  },
];

export const STACK_TAGS = [
  'Django + DRF',
  'PostgreSQL',
  'pgvector',
  'PostGIS',
  'Redis + RQ',
  'ONNX Runtime',
  'spaCy',
  'scikit-learn',
  'Modal (PyTorch)',
  'PyKEEN',
  'PyTorch Geometric',
];
