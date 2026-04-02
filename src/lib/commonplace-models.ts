/**
 * CommonPlace Model View: types, demo data, and API surface.
 *
 * All types mirror the planned Django EpistemicModel + ModelClaimRole
 * structure (spec Batch 5). Demo data stands in until real endpoints
 * exist. The API functions return Promises so the swap is mechanical.
 */

/* ─────────────────────────────────────────────────
   Model types
   ───────────────────────────────────────────────── */

export type ModelType =
  | 'explanatory'
  | 'causal'
  | 'comparative'
  | 'predictive'
  | 'normative'
  | 'process';

export const MODEL_TYPE_META: Record<
  ModelType,
  { label: string; color: string; description: string }
> = {
  explanatory: {
    label: 'Explanatory',
    color: '#1A7A8A',
    description: 'Why something is the case',
  },
  causal: {
    label: 'Causal',
    color: '#B85C28',
    description: 'What caused what',
  },
  comparative: {
    label: 'Comparative',
    color: '#7050A0',
    description: 'How things differ',
  },
  predictive: {
    label: 'Predictive',
    color: '#3858B8',
    description: 'What will happen if',
  },
  normative: {
    label: 'Normative',
    color: '#B8623D',
    description: 'What should be the case',
  },
  process: {
    label: 'Process',
    color: '#607080',
    description: 'How something works step by step',
  },
};

/* ─────────────────────────────────────────────────
   Assumption status
   ───────────────────────────────────────────────── */

export type AssumptionStatus =
  | 'supported'
  | 'contested'
  | 'accepted'
  | 'proposed'
  | 'falsified'
  | 'gap';

export const ASSUMPTION_STATUS_META: Record<
  AssumptionStatus,
  { label: string; color: string }
> = {
  supported: { label: 'Supported', color: '#1A7A8A' },
  contested: { label: 'Contested', color: '#B8623D' },
  accepted: { label: 'Accepted', color: '#2E8A3E' },
  proposed: { label: 'Proposed', color: '#7050A0' },
  falsified: { label: 'Falsified', color: '#A8A6AE' },
  gap: { label: 'Gap', color: '#D4944A' },
};

/* ─────────────────────────────────────────────────
   Evidence
   ───────────────────────────────────────────────── */

export type EvidenceRelation = 'supports' | 'contradicts';

export const EVIDENCE_RELATION_COLOR: Record<EvidenceRelation, string> = {
  supports: '#1A7A8A',
  contradicts: '#B8623D',
};

export type EvidenceObjectType =
  | 'source'
  | 'hunch'
  | 'quote'
  | 'concept'
  | 'note';

/** Color per evidence object type (for domain labels, pips, borders) */
export const EVIDENCE_TYPE_COLOR: Record<EvidenceObjectType, string> = {
  source: '#1A7A8A',
  hunch: '#C07040',
  quote: '#A08020',
  concept: '#7050A0',
  note: '#68666E',
};

export interface EvidenceLink {
  id: number;
  objectRef: number;
  objectTitle: string;
  objectType: EvidenceObjectType;
  relation: EvidenceRelation;
  confidence: number;
  isCandidate?: boolean;
  /** The finding or content text (what the evidence says) */
  contentText?: string;
  /** Source domain (e.g. "city.gov", "arxiv.org") */
  domain?: string;
  /** Date string (e.g. "Feb 28", "engine") */
  date?: string;
  /** Attribution for quotes */
  attribution?: string;
}

/* ─────────────────────────────────────────────────
   Assumption (backed by Claim + ModelClaimRole)
   ───────────────────────────────────────────────── */

export interface Assumption {
  id: number;
  claimId: number;
  text: string;
  status: AssumptionStatus;
  confidence: number;
  positionIndex: number;
  evidence: EvidenceLink[];
}

/* ─────────────────────────────────────────────────
   Tension
   ───────────────────────────────────────────────── */

export type TensionSeverity = 'high' | 'medium' | 'low';

export interface Tension {
  id: number;
  text: string;
  severity: TensionSeverity;
  linkedAssumptionIds: number[];
}

/* ─────────────────────────────────────────────────
   Method
   ───────────────────────────────────────────────── */

export interface Method {
  id: number;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'planned' | 'draft' | 'reviewed';
  runs?: number;
}

/* ─────────────────────────────────────────────────
   Canonical comparison
   ───────────────────────────────────────────────── */

export type AgreementLevel =
  | 'agrees'
  | 'partial'
  | 'disagrees'
  | 'supportive'
  | 'mixed';

export const AGREEMENT_STYLE: Record<
  AgreementLevel,
  { label: string; color: string }
> = {
  agrees: { label: 'agrees', color: '#2E8A3E' },
  supportive: { label: 'supportive', color: '#2E8A3E' },
  partial: { label: 'partial', color: '#D4944A' },
  mixed: { label: 'mixed', color: '#D4944A' },
  disagrees: { label: 'disagrees', color: '#B8623D' },
};

export interface CanonicalReference {
  id: number;
  objectRef: number;
  objectTitle: string;
  objectType: string;
  agreement: AgreementLevel;
  summary: string;
  /** Publication info (e.g. "Brookings, 2023") */
  source?: string;
}

/* ─────────────────────────────────────────────────
   Falsification criterion
   ───────────────────────────────────────────────── */

export interface FalsificationCriterion {
  id: number;
  text: string;
  status: 'untested' | 'holds' | 'failed';
}

/* ─────────────────────────────────────────────────
   Narrative
   ───────────────────────────────────────────────── */

export interface Narrative {
  id: number;
  title: string;
  objectRef: number;
  narrativeType?: string;
  narrativeStatus?: string;
}

/* ─────────────────────────────────────────────────
   Engine log entry
   ───────────────────────────────────────────────── */

export type EnginePassName = 'sbert' | 'nli' | 'kge' | 'stress' | 'promote';

export const ENGINE_PASS_COLOR: Record<EnginePassName, string> = {
  sbert: '#CCAA44',
  nli: '#CCAA44',
  kge: '#CCAA44',
  stress: '#CC6644',
  promote: '#6AAA6A',
};

export interface EngineLogEntry {
  id: string;
  timestamp: string;
  pass: EnginePassName;
  message: string;
  modelId?: number;
}

/* ─────────────────────────────────────────────────
   Stress test finding
   ───────────────────────────────────────────────── */

export interface StressFinding {
  id: number;
  severity: TensionSeverity;
  text: string;
  linkedAssumptionId?: number;
}

export interface StressResult {
  drift: number;
  unlinkedCount: number;
  findings: StressFinding[];
}

/* ─────────────────────────────────────────────────
   Engine candidate
   ───────────────────────────────────────────────── */

export interface EngineCandidate {
  id: number;
  objectRef: number;
  objectTitle: string;
  objectType: string;
  suggestedAssumptionId: number;
  relation: EvidenceRelation;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
}

/* ─────────────────────────────────────────────────
   Engine operational status
   ───────────────────────────────────────────────── */

export type EngineStatus = 'idle' | 'recalculating' | 'error';

export interface EngineStatusInfo {
  status: EngineStatus;
  /** Number of board items the engine is processing */
  itemCount?: number;
  /** ISO timestamp of last successful calculation */
  lastUpdated?: string;
  /** Error message when status is 'error' */
  errorMessage?: string;
}

/* ─────────────────────────────────────────────────
   Full model
   ───────────────────────────────────────────────── */

export interface EpistemicModelSummary {
  id: number;
  slug: string;
  title: string;
  thesis: string;
  modelType: ModelType;
  assumptionCount: number;
  methodCount: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  modelStatus?: string;
  modelConfidence?: number;
}

export interface EpistemicModelDetail extends EpistemicModelSummary {
  question: string | null;
  scope?: string;
  domains?: string[];
  summary?: string;
  assumptions: Assumption[];
  tensions: Tension[];
  methods: Method[];
  canonicalReferences: CanonicalReference[];
  falsificationCriteria: FalsificationCriterion[];
  narratives: Narrative[];
}

/* ─────────────────────────────────────────────────
   Module visibility
   ───────────────────────────────────────────────── */

export type ModuleId =
  | 'tensions'
  | 'methods'
  | 'compare'
  | 'falsify'
  | 'narratives';

export const MODULE_META: Record<
  ModuleId,
  { label: string; accentColor: string }
> = {
  tensions: { label: 'Tensions', accentColor: '#D4944A' },
  methods: { label: 'Methods', accentColor: '#1A7A8A' },
  compare: { label: 'Canonical Compare', accentColor: '#7050A0' },
  falsify: { label: 'Falsification Criteria', accentColor: '#B8623D' },
  narratives: { label: 'Narratives', accentColor: '#2E8A3E' },
};

/* ─────────────────────────────────────────────────
   Demo data
   ───────────────────────────────────────────────── */

const DEMO_ASSUMPTIONS: Assumption[] = [
  {
    id: 1, claimId: 101, positionIndex: 0,
    text: 'Disinvestment is measurable through permit activity, vacancy rates, and assessed value trends',
    status: 'supported', confidence: 0.85,
    evidence: [
      { id: 1, objectRef: 201, objectTitle: 'Building Dept. FOIA response', objectType: 'source', relation: 'supports', confidence: 0.85, domain: 'city.gov', contentText: 'Permit filings dropped 68% between 2010 and 2016', date: 'Feb 28' },
      { id: 2, objectRef: 202, objectTitle: 'County Assessor data extract', objectType: 'source', relation: 'supports', confidence: 0.82, domain: 'county.gov', contentText: 'Assessed values fell 34% relative to citywide average', date: 'Mar 1' },
      { id: 3, objectRef: 203, objectTitle: 'Strategic land banking', objectType: 'hunch', relation: 'contradicts', confidence: 0.55, contentText: 'Some vacancy is strategic land banking, not disinvestment', date: 'Mar 3' },
    ],
  },
  {
    id: 2, claimId: 102, positionIndex: 1,
    text: 'The infrastructure plan was reactive to already-established decline, not proactive',
    status: 'contested', confidence: 0.48,
    evidence: [
      { id: 4, objectRef: 204, objectTitle: '2017 Corridor Plan, p.12', objectType: 'source', relation: 'supports', confidence: 0.75, domain: 'planning.city.gov', contentText: "Plan document references 'reversing decline' as primary goal", date: 'Feb 26' },
      { id: 5, objectRef: 205, objectTitle: 'Council member statement', objectType: 'quote', relation: 'contradicts', confidence: 0.68, contentText: 'This plan was years in the making before we saw the downturn', attribution: 'Council minutes, 2016-11-14', date: 'Mar 4' },
      { id: 6, objectRef: 206, objectTitle: 'Municipal budget archives', objectType: 'source', relation: 'contradicts', confidence: 0.72, domain: 'finance.city.gov', contentText: 'Capital budget allocation appears in 2014, two years before peak vacancy', date: 'Mar 5' },
    ],
  },
  {
    id: 3, claimId: 103, positionIndex: 2,
    text: 'Infrastructure spending alone cannot reverse corridor decline once anchor tenants have left',
    status: 'accepted', confidence: 0.78,
    evidence: [
      { id: 7, objectRef: 207, objectTitle: 'Field survey, Q3 2024', objectType: 'note', relation: 'supports', confidence: 0.7, contentText: 'Post-improvement vacancy remained above 40% for 3 years after streetscape completion', date: 'Mar 1' },
      { id: 8, objectRef: 208, objectTitle: 'Infrastructure in declining corridors', objectType: 'source', relation: 'supports', confidence: 0.82, domain: 'brookings.edu', contentText: 'Diminishing returns in corridors that lost more than 50% of anchor tenants', date: 'Feb 20' },
      { id: 9, objectRef: 209, objectTitle: 'Comparison case study', objectType: 'note', relation: 'supports', confidence: 0.65, contentText: 'Adjacent corridor with similar improvements but retained anchors recovered in 18 months', date: 'Mar 6' },
    ],
  },
  {
    id: 4, claimId: 104, positionIndex: 3,
    text: 'Traffic pattern changes actively accelerated pedestrian decline',
    status: 'proposed', confidence: 0,
    evidence: [
      { id: 10, objectRef: 210, objectTitle: 'IDOT traffic count data', objectType: 'source', relation: 'supports', confidence: 0.72, domain: 'idot.illinois.gov', contentText: 'Vehicle speeds up 22% after one-way conversion; pedestrian counts down 41%', date: 'engine', isCandidate: true },
      { id: 11, objectRef: 211, objectTitle: 'Induced demand', objectType: 'concept', relation: 'supports', confidence: 0.6, contentText: 'Road widening generates additional vehicle traffic rather than reducing congestion', date: 'engine', isCandidate: true },
    ],
  },
];

const DEMO_TENSIONS: Tension[] = [
  { id: 1, text: 'Timeline contradiction on plan origin', severity: 'high', linkedAssumptionIds: [2] },
  { id: 2, text: 'Land banking vs. disinvestment', severity: 'medium', linkedAssumptionIds: [1] },
  { id: 3, text: 'Infrastructure timing ambiguity', severity: 'medium', linkedAssumptionIds: [2] },
];

const DEMO_METHODS: Method[] = [
  { id: 1, title: 'corridor-decline-scoring', description: 'Composite scoring method for corridor health indicators', status: 'draft', runs: 0 },
  { id: 2, title: 'anchor-vacancy-threshold', description: 'Determine the anchor tenant vacancy tipping point', status: 'reviewed', runs: 3 },
];

const DEMO_REFERENCES: CanonicalReference[] = [
  { id: 1, objectRef: 301, objectTitle: 'Retail Corridor Recovery Framework', objectType: 'source', agreement: 'partial', summary: 'Agrees on anchor-loss threshold but not traffic-pattern effects', source: 'Brookings, 2023' },
  { id: 2, objectRef: 302, objectTitle: 'Infrastructure Investment and Neighborhood Change', objectType: 'source', agreement: 'mixed', summary: 'Claims infrastructure CAN reverse decline with tenant retention programs', source: 'J. Urban Economics, 2022' },
];

const DEMO_FALSIFICATION: FalsificationCriterion[] = [
  { id: 1, text: 'If permit activity was already declining before 2010, the timeline thesis fails', status: 'untested' },
  { id: 2, text: 'If a corridor with similar anchor loss recovered through infrastructure alone, A3 is weakened', status: 'untested' },
];

const DEMO_NARRATIVES: Narrative[] = [
  { id: 1, title: 'Corridor North: An Autopsy of Good Intentions', objectRef: 401, narrativeType: 'memo', narrativeStatus: 'draft' },
];

const DEMO_MODEL_DETAIL: EpistemicModelDetail = {
  id: 1, slug: 'corridor-decline',
  title: 'Corridor decline persists because disinvestment preceded the infrastructure plan, not the other way around',
  thesis: 'The corridor was already failing before the city intervened.',
  modelType: 'explanatory',
  question: 'Why is this corridor failing despite multiple improvement plans?',
  scope: 'Downtown north corridor, 2008-present',
  domains: ['built_environment', 'civic_policy'],
  summary: 'The corridor was already failing before the city intervened. The infrastructure plan addressed symptoms rather than causes. Spending alone cannot reverse decline once the commercial ecosystem has collapsed past a threshold.',
  modelStatus: 'active',
  modelConfidence: 0.62,
  assumptionCount: 4,
  methodCount: 2,
  questionCount: 1,
  createdAt: '2026-02-15T10:00:00Z',
  updatedAt: '2026-03-13T14:30:00Z',
  assumptions: DEMO_ASSUMPTIONS,
  tensions: DEMO_TENSIONS,
  methods: DEMO_METHODS,
  canonicalReferences: DEMO_REFERENCES,
  falsificationCriteria: DEMO_FALSIFICATION,
  narratives: DEMO_NARRATIVES,
};

const DEMO_MODELS: EpistemicModelSummary[] = [
  {
    id: 1, slug: 'corridor-decline',
    title: 'Corridor decline persists because disinvestment preceded the infrastructure plan, not the other way around',
    thesis: 'The corridor was already failing before the city intervened.',
    modelType: 'explanatory', modelStatus: 'active', modelConfidence: 0.62,
    assumptionCount: 4, methodCount: 2, questionCount: 1,
    createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-03-13T14:30:00Z',
  },
  {
    id: 2, slug: 'stigmergy-engine',
    title: 'Stigmergy explains why the connection engine improves with use without explicit training',
    thesis: 'The engine behaves like a stigmergic system.',
    modelType: 'explanatory', modelStatus: 'active', modelConfidence: 0.55,
    assumptionCount: 3, methodCount: 1, questionCount: 1,
    createdAt: '2026-01-20T08:00:00Z', updatedAt: '2026-03-14T11:00:00Z',
  },
  {
    id: 3, slug: 'tiptap-save-bug',
    title: 'The Tiptap save bug is a state management race condition, not a backend issue',
    thesis: 'Race condition between state update and serialization.',
    modelType: 'causal', modelStatus: 'draft', modelConfidence: 0.71,
    assumptionCount: 1, methodCount: 0, questionCount: 0,
    createdAt: '2026-03-05T16:00:00Z', updatedAt: '2026-03-12T09:00:00Z',
  },
];

const STIGMERGY_DETAIL: EpistemicModelDetail = {
  id: 2, slug: 'stigmergy-engine',
  title: 'Stigmergy explains why the connection engine improves with use without explicit training',
  thesis: 'The engine behaves like a stigmergic system.',
  modelType: 'explanatory', modelStatus: 'active', modelConfidence: 0.55,
  question: 'How does CommonPlace improve without explicit learning?',
  scope: 'CommonPlace, engine behavior', domains: ['computer_science'],
  summary: 'The engine behaves like a stigmergic system. Each note creates edges that influence future results. The graph gets denser and more traversable with use.',
  assumptionCount: 3, methodCount: 1, questionCount: 1,
  createdAt: '2026-01-20T08:00:00Z', updatedAt: '2026-03-14T11:00:00Z',
  assumptions: [
    { id: 5, claimId: 201, positionIndex: 0, text: 'Graph density correlates with compose-mode result quality', status: 'supported', confidence: 0.72, evidence: [
      { id: 20, objectRef: 220, objectTitle: 'Compose quality log', objectType: 'note', relation: 'supports', confidence: 0.7, contentText: 'Relevance scores improved from 0.34 to 0.61 over 200 objects', date: 'Mar 2' },
      { id: 21, objectRef: 221, objectTitle: 'Stigmergy in software systems', objectType: 'source', relation: 'supports', confidence: 0.78, domain: 'arxiv.org', contentText: 'Indirect coordination through environment modification well-documented in multi-agent systems', date: 'Feb 15' },
    ]},
    { id: 6, claimId: 202, positionIndex: 1, text: 'Edge creation during compose acts as pheromone deposit analog', status: 'proposed', confidence: 0.45, evidence: [
      { id: 22, objectRef: 222, objectTitle: 'Stigmergy', objectType: 'concept', relation: 'supports', confidence: 0.5, contentText: 'Coordination through shared environment modification', date: 'engine', isCandidate: true },
    ]},
    { id: 7, claimId: 203, positionIndex: 2, text: 'Seven-pass architecture creates multiple reinforcing signals per action', status: 'accepted', confidence: 0.8, evidence: [
      { id: 23, objectRef: 223, objectTitle: 'engine.py pass docs', objectType: 'source', relation: 'supports', confidence: 0.9, domain: 'github.com', contentText: 'NER, shared entity, keyword, TF-IDF, SBERT, NLI, KGE passes each create distinct edge types', date: 'Mar 1' },
    ]},
  ],
  tensions: [{ id: 10, text: 'Density vs. noise threshold', severity: 'medium', linkedAssumptionIds: [5] }],
  methods: [{ id: 10, title: 'compose-quality-benchmark', description: 'Benchmark compose quality vs graph density', status: 'draft', runs: 0 }],
  canonicalReferences: [{ id: 10, objectRef: 310, objectTitle: 'Stigmergy as Universal Coordination Mechanism', objectType: 'source', agreement: 'supportive', summary: 'Framework aligns; no direct software-system validation', source: 'Cognitive Systems Research, 2016' }],
  falsificationCriteria: [{ id: 10, text: 'If engine quality degrades with graph density past a threshold', status: 'untested' }],
  narratives: [],
};

const TIPTAP_DETAIL: EpistemicModelDetail = {
  id: 3, slug: 'tiptap-save-bug',
  title: 'The Tiptap save bug is a state management race condition, not a backend issue',
  thesis: 'Race condition between state update and serialization.',
  modelType: 'causal', modelStatus: 'draft', modelConfidence: 0.71,
  question: null, scope: 'Studio, save pipeline',
  summary: 'The save button sets a local timestamp but the persist call either never fires or fires before editor content is serialized.',
  assumptionCount: 1, methodCount: 0, questionCount: 0,
  createdAt: '2026-03-05T16:00:00Z', updatedAt: '2026-03-12T09:00:00Z',
  assumptions: [
    { id: 8, claimId: 301, positionIndex: 0, text: 'The save handler reads stale editor state because getJSON fires before the transaction settles', status: 'proposed', confidence: 0.71, evidence: [
      { id: 30, objectRef: 230, objectTitle: 'Console log investigation', objectType: 'note', relation: 'supports', confidence: 0.75, contentText: 'editor.getJSON() output was one keystroke behind at save time', date: 'Mar 8' },
      { id: 31, objectRef: 231, objectTitle: 'React 19 batching', objectType: 'hunch', relation: 'supports', confidence: 0.5, contentText: 'Automatic batching may delay the state update that triggers save', date: 'Mar 9' },
    ]},
  ],
  tensions: [], methods: [], canonicalReferences: [], falsificationCriteria: [], narratives: [],
};

const DEMO_ENGINE_LOG: EngineLogEntry[] = [
  { id: 'e1', timestamp: '2026-03-15T14:23:01Z', pass: 'sbert', message: 'Computed 9 evidence embeddings. 2 new high-similarity pairs.', modelId: 1 },
  { id: 'e2', timestamp: '2026-03-15T14:23:03Z', pass: 'nli', message: 'NLI stance: e-5 vs A2 = CONTRADICTION (0.91). e-6 vs A2 = CONTRADICTION (0.84).', modelId: 1 },
  { id: 'e3', timestamp: '2026-03-15T14:23:04Z', pass: 'kge', message: "KGE: 'induced demand' linked to 4 existing transport objects.", modelId: 1 },
  { id: 'e4', timestamp: '2026-03-15T14:23:05Z', pass: 'stress', message: 'Stress test complete. Drift: -4.0%. 2 high-severity findings.', modelId: 1 },
  { id: 'e5', timestamp: '2026-03-15T14:23:06Z', pass: 'promote', message: '2 candidates queued (IDOT data, induced demand).', modelId: 1 },
];

const DEMO_STRESS_RESULT: StressResult = {
  drift: -0.04, unlinkedCount: 7,
  findings: [
    { id: 1, severity: 'high', text: 'A4 has zero accepted evidence. Only engine candidates.', linkedAssumptionId: 4 },
    { id: 2, severity: 'high', text: 'e-5 directly contradicts reactive-plan thesis. A2 confidence dropping.', linkedAssumptionId: 2 },
    { id: 3, severity: 'medium', text: '3 unlinked claims mention corridor traffic counts. May bear on A4.' },
    { id: 4, severity: 'low', text: 'e-8 (Brookings) is from 2021. Check for newer work.' },
    { id: 5, severity: 'medium', text: "Method 'anchor-vacancy-threshold' not yet run on this corridor." },
  ],
};

const DEMO_CANDIDATES: EngineCandidate[] = [
  { id: 1, objectRef: 501, objectTitle: 'IDOT traffic count data', objectType: 'source', suggestedAssumptionId: 4, relation: 'supports', confidence: 0.72, status: 'pending' },
  { id: 2, objectRef: 502, objectTitle: 'Induced demand', objectType: 'concept', suggestedAssumptionId: 4, relation: 'supports', confidence: 0.6, status: 'pending' },
];

/* ─────────────────────────────────────────────────
   API mappers (DRF snake_case → frontend camelCase)
   ───────────────────────────────────────────────── */

import { apiFetch } from '@/lib/commonplace-api';

function mapModelSummary(raw: any): EpistemicModelSummary {
  return {
    id: raw.id,
    slug: raw.slug ?? '',
    title: raw.title,
    thesis: raw.description || raw.working_summary || '',
    modelType: (raw.model_type ?? 'explanatory') as ModelType,
    modelStatus: raw.status,
    modelConfidence: raw.confidence ?? 0,
    assumptionCount:
      raw.claim_count
      ?? raw.assumption_records?.length
      ?? raw.assumption_roles?.length
      ?? raw.assumptions?.length
      ?? 0,
    methodCount: raw.method_count ?? raw.methods?.length ?? 0,
    questionCount: raw.question_count ?? raw.questions?.length ?? 0,
    createdAt: raw.created_at ?? '',
    updatedAt: raw.updated_at ?? '',
  };
}

function normalizeEvidenceRelation(raw: any): EvidenceRelation {
  const relation = raw.relation ?? raw.relation_type;
  return relation === 'contradicts' ? 'contradicts' : 'supports';
}

function normalizeEvidenceType(raw: any): EvidenceObjectType {
  const type = raw.object_type ?? raw.object_type_slug ?? raw.type ?? 'source';
  return (type in EVIDENCE_TYPE_COLOR ? type : 'source') as EvidenceObjectType;
}

function deriveDomain(raw: any): string | undefined {
  if (raw.domain) return raw.domain;

  const url = raw.artifact_source_url ?? raw.source_url;
  if (!url) return undefined;

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function normalizeAssumptionStatus(raw: any): AssumptionStatus {
  const explicit = raw.status ?? raw.claim_status;
  if (explicit && explicit in ASSUMPTION_STATUS_META) {
    return explicit as AssumptionStatus;
  }

  if (explicit === 'promoted' || raw.claim_epistemic_status === 'promoted') {
    return 'accepted';
  }

  const evidenceLinks = Array.isArray(raw.evidence_links) ? raw.evidence_links : [];
  const hasContradiction = evidenceLinks.some(
    (link: any) => normalizeEvidenceRelation(link) === 'contradicts' && link.attached_by !== 'engine',
  );
  if (hasContradiction) return 'contested';

  const hasSupport = evidenceLinks.some(
    (link: any) => normalizeEvidenceRelation(link) === 'supports' && link.attached_by !== 'engine',
  );
  if (hasSupport) return 'supported';

  if (evidenceLinks.length > 0) return 'proposed';
  return 'gap';
}

function mapAssumption(raw: any): Assumption {
  return {
    id: raw.id ?? raw.claim_id ?? raw.claim ?? raw.assumption_index ?? 0,
    claimId: raw.claim ?? raw.claim_id ?? raw.id ?? 0,
    text: raw.text ?? raw.claim_text ?? raw.title ?? '',
    status: normalizeAssumptionStatus(raw),
    confidence: raw.local_confidence ?? raw.confidence ?? raw.claim_confidence ?? 0,
    positionIndex: raw.position ?? raw.position_index ?? raw.assumption_index ?? 0,
    evidence: Array.isArray(raw.evidence_links) ? raw.evidence_links.map(mapEvidenceLink) : [],
  };
}

function mapEvidenceLink(raw: any): EvidenceLink {
  return {
    id: raw.id,
    objectRef: raw.object ?? raw.object_ref ?? raw.artifact ?? raw.artifact_id ?? 0,
    objectTitle: raw.object_title ?? raw.artifact_title ?? raw.title ?? '',
    objectType: normalizeEvidenceType(raw),
    relation: normalizeEvidenceRelation(raw),
    confidence: raw.confidence ?? 0,
    isCandidate: raw.is_candidate ?? raw.attached_by === 'engine',
    contentText: raw.content_text ?? raw.reason ?? raw.finding ?? undefined,
    domain: deriveDomain(raw),
    date: raw.date ?? undefined,
    attribution: raw.attribution ?? undefined,
  };
}

function mapInlineAssumptions(rawAssumptions: any[]): Assumption[] {
  return rawAssumptions.map((assumption, index) => {
    if (typeof assumption === 'string') {
      return mapAssumption({
        id: index + 1,
        claim_id: index + 1,
        text: assumption,
        assumption_index: index,
        status: 'proposed',
      });
    }

    return mapAssumption({
      ...assumption,
      id: assumption.id ?? index + 1,
      claim_id: assumption.claim_id ?? assumption.id ?? index + 1,
      assumption_index: assumption.assumption_index ?? assumption.position_index ?? index,
    });
  });
}

function mapFalsificationCriteria(rawCriteria: any): FalsificationCriterion[] {
  if (!Array.isArray(rawCriteria)) return [];

  return rawCriteria.map((criterion: any, index: number) => {
    if (typeof criterion === 'string') {
      return {
        id: index + 1,
        text: criterion,
        status: 'untested' as const,
      };
    }

    return {
      id: criterion.id ?? index + 1,
      text: criterion.text ?? '',
      status: criterion.status ?? 'untested',
    };
  });
}

function mapModelDetail(raw: any): EpistemicModelDetail {
  const summary = mapModelSummary(raw);
  const assumptions =
    Array.isArray(raw.assumption_roles) && raw.assumption_roles.length > 0
      ? raw.assumption_roles.map(mapAssumption)
      : Array.isArray(raw.assumption_records) && raw.assumption_records.length > 0
        ? raw.assumption_records.map(mapAssumption)
        : Array.isArray(raw.assumptions)
          ? mapInlineAssumptions(raw.assumptions)
          : [];

  return {
    ...summary,
    question:
      raw.question
      ?? (Array.isArray(raw.questions) && raw.questions.length > 0
        ? raw.questions[0]?.title ?? null
        : null),
    scope: raw.scope ?? undefined,
    domains: raw.domains ?? undefined,
    summary: raw.summary ?? raw.working_summary ?? raw.description ?? undefined,
    assumptions,
    tensions: Array.isArray(raw.tensions) ? raw.tensions.map((t: any) => ({
      id: t.id,
      text: t.text ?? t.title ?? t.description ?? '',
      severity: (t.severity ?? 'medium') as TensionSeverity,
      linkedAssumptionIds: t.linked_claims ?? t.linked_assumption_ids ?? [],
    })) : [],
    methods: Array.isArray(raw.methods) ? raw.methods.map((m: any) => ({
      id: m.id,
      title: m.title ?? m.name ?? 'Untitled method',
      description: m.description ?? [m.method_type, m.runtime_kind].filter(Boolean).join(' · '),
      status: m.status ?? 'draft',
      runs: m.runs ?? 0,
    })) : [],
    canonicalReferences: Array.isArray(raw.canonical_references) ? raw.canonical_references.map((c: any) => ({
      id: c.id,
      objectRef: c.object ?? 0,
      objectTitle: c.object_title ?? '',
      objectType: c.object_type ?? 'source',
      agreement: (c.agreement ?? 'mixed') as AgreementLevel,
      summary: c.summary ?? '',
      source: c.source ?? undefined,
    })) : [],
    falsificationCriteria: mapFalsificationCriteria(raw.falsification_criteria),
    narratives: Array.isArray(raw.narratives) ? raw.narratives.map((n: any) => ({
      id: n.id,
      title: n.title,
      objectRef: n.object ?? 0,
      narrativeType: n.narrative_type ?? undefined,
      narrativeStatus: n.status ?? undefined,
    })) : [],
  };
}

/* ─────────────────────────────────────────────────
   API functions (real API with demo fallback)
   ───────────────────────────────────────────────── */

export async function fetchModels(): Promise<EpistemicModelSummary[]> {
  try {
    const data = await apiFetch<any>('/models/');
    const results = Array.isArray(data) ? data : data.results ?? [];
    if (results.length === 0) return DEMO_MODELS;
    return results.map(mapModelSummary);
  } catch {
    return DEMO_MODELS;
  }
}

export async function fetchModelDetail(id: number): Promise<EpistemicModelDetail> {
  try {
    const data = await apiFetch<any>(`/models/${id}/`);
    return mapModelDetail(data);
  } catch {
    // Fallback to demo data
    if (id === 1) return DEMO_MODEL_DETAIL;
    if (id === 2) return STIGMERGY_DETAIL;
    if (id === 3) return TIPTAP_DETAIL;
    const summary = DEMO_MODELS.find((m) => m.id === id);
    if (!summary) throw new Error(`Model ${id} not found`);
    return { ...summary, question: null, assumptions: [], tensions: [], methods: [], canonicalReferences: [], falsificationCriteria: [], narratives: [] };
  }
}

export async function fetchEngineLog(modelId?: number): Promise<EngineLogEntry[]> {
  if (!modelId) {
    return DEMO_ENGINE_LOG;
  }

  try {
    const data = await apiFetch<any>(`/models/${modelId}/engine-log/`);
    const results = Array.isArray(data) ? data : data.entries ?? data.results ?? [];
    return results.map((e: any, index: number) => ({
      id: String(e.id ?? index + 1),
      timestamp: e.created_at ?? e.timestamp ?? '',
      pass: (e.pass_name ?? e.pass ?? e.process_type ?? 'sbert') as EnginePassName,
      message: e.message ?? e.summary ?? '',
      modelId: e.model ?? modelId,
    }));
  } catch {
    return DEMO_ENGINE_LOG.filter((e) => e.modelId === modelId || !e.modelId);
  }
}

export async function fetchStressResult(modelId: number): Promise<StressResult> {
  try {
    const data = await apiFetch<any>(`/models/${modelId}/stress-test/`, {
      method: 'POST',
      body: JSON.stringify({ trust_level: 'conservative' }),
    });
    return {
      drift: data.drift ?? 0,
      unlinkedCount: data.unlinked ?? data.unlinked_count ?? 0,
      findings: Array.isArray(data.findings) ? data.findings.map((f: any, index: number) => ({
        id: f.id ?? index + 1,
        severity: f.severity ?? 'medium',
        text: f.text ?? f.message ?? '',
        linkedAssumptionId: f.linked_claim ?? f.linked_assumption_id ?? undefined,
      })) : [],
    };
  } catch {
    return DEMO_STRESS_RESULT;
  }
}

export async function fetchCandidates(modelId: number): Promise<EngineCandidate[]> {
  try {
    const data = await apiFetch<any>(`/models/${modelId}/candidates/`);
    const results = Array.isArray(data) ? data : data.results ?? [];
    return results.map((c: any) => ({
      id: c.id,
      objectRef: c.object ?? 0,
      objectTitle: c.object_title ?? '',
      objectType: c.object_type ?? '',
      suggestedAssumptionId: c.suggested_claim ?? c.suggested_assumption_id ?? 0,
      relation: normalizeEvidenceRelation(c),
      confidence: c.confidence ?? 0,
      status: c.status ?? 'pending',
    }));
  } catch {
    return DEMO_CANDIDATES;
  }
}

export async function createModel(data: {
  title: string;
  model_type: ModelType;
  description?: string;
  notebook?: string;
}): Promise<EpistemicModelSummary> {
  const resp = await apiFetch<any>('/models/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return mapModelSummary(resp);
}
