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
    description: 'Why something is the way it is',
  },
  causal: {
    label: 'Causal',
    color: '#B85C28',
    description: 'What causes what',
  },
  comparative: {
    label: 'Comparative',
    color: '#7050A0',
    description: 'How things differ or relate',
  },
  predictive: {
    label: 'Predictive',
    color: '#3858B8',
    description: 'What will happen given conditions',
  },
  normative: {
    label: 'Normative',
    color: '#C4503C',
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
  contested: { label: 'Contested', color: '#C4503C' },
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
  contradicts: '#C4503C',
};

export type EvidenceObjectType =
  | 'source'
  | 'hunch'
  | 'quote'
  | 'concept'
  | 'note';

export interface EvidenceLink {
  id: number;
  objectRef: number;
  objectTitle: string;
  objectType: EvidenceObjectType;
  relation: EvidenceRelation;
  confidence: number;
  isCandidate?: boolean;
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
  status: 'active' | 'completed' | 'planned';
}

/* ─────────────────────────────────────────────────
   Canonical comparison
   ───────────────────────────────────────────────── */

export type AgreementLevel = 'agrees' | 'partial' | 'disagrees';

export interface CanonicalReference {
  id: number;
  objectRef: number;
  objectTitle: string;
  objectType: string;
  agreement: AgreementLevel;
  summary: string;
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
   Full model
   ───────────────────────────────────────────────── */

export interface EpistemicModelSummary {
  id: number;
  title: string;
  thesis: string;
  modelType: ModelType;
  assumptionCount: number;
  methodCount: number;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EpistemicModelDetail extends EpistemicModelSummary {
  question: string;
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
  compare: { label: 'Compare', accentColor: '#7050A0' },
  falsify: { label: 'Falsify', accentColor: '#C4503C' },
  narratives: { label: 'Narratives', accentColor: '#2E8A3E' },
};

/* ─────────────────────────────────────────────────
   Demo data
   ───────────────────────────────────────────────── */

const DEMO_ASSUMPTIONS: Assumption[] = [
  {
    id: 1,
    claimId: 101,
    text: 'Upzoning in high-demand areas leads to measurable increases in housing unit construction within 3 years.',
    status: 'supported',
    confidence: 0.78,
    positionIndex: 0,
    evidence: [
      {
        id: 1,
        objectRef: 201,
        objectTitle: 'Minneapolis 2040 Plan Impact Study',
        objectType: 'source',
        relation: 'supports',
        confidence: 0.85,
      },
      {
        id: 2,
        objectRef: 202,
        objectTitle: 'Jane Jacobs on incremental density',
        objectType: 'quote',
        relation: 'supports',
        confidence: 0.62,
      },
      {
        id: 3,
        objectRef: 203,
        objectTitle: 'SB 9 California permit data',
        objectType: 'source',
        relation: 'contradicts',
        confidence: 0.71,
      },
    ],
  },
  {
    id: 2,
    claimId: 102,
    text: 'New construction at market rate eventually filters down to reduce rents at lower price points.',
    status: 'contested',
    confidence: 0.45,
    positionIndex: 1,
    evidence: [
      {
        id: 4,
        objectRef: 204,
        objectTitle: 'Filtering in U.S. Housing Markets (Rosenthal, 2014)',
        objectType: 'source',
        relation: 'supports',
        confidence: 0.73,
      },
      {
        id: 5,
        objectRef: 205,
        objectTitle: 'Luxury construction displaces before it filters',
        objectType: 'hunch',
        relation: 'contradicts',
        confidence: 0.55,
      },
    ],
  },
  {
    id: 3,
    claimId: 103,
    text: 'Community opposition is the primary barrier to zoning reform, not technical or legal constraints.',
    status: 'proposed',
    confidence: 0.6,
    positionIndex: 2,
    evidence: [
      {
        id: 6,
        objectRef: 206,
        objectTitle: 'Einstein & Glick (2017) on NIMBY politics',
        objectType: 'source',
        relation: 'supports',
        confidence: 0.8,
      },
    ],
  },
  {
    id: 4,
    claimId: 104,
    text: 'Environmental review requirements (CEQA/NEPA) create delay costs that reduce housing production more than density limits.',
    status: 'gap',
    confidence: 0.3,
    positionIndex: 3,
    evidence: [],
  },
];

const DEMO_TENSIONS: Tension[] = [
  {
    id: 1,
    text: 'A1 claims upzoning increases construction, but A2 questions whether new units actually reduce rents. If filtering fails, more units may not solve affordability.',
    severity: 'high',
    linkedAssumptionIds: [1, 2],
  },
  {
    id: 2,
    text: 'A3 and A4 both concern barriers, but they point to different root causes (political vs. regulatory). Different interventions follow from each.',
    severity: 'medium',
    linkedAssumptionIds: [3, 4],
  },
];

const DEMO_METHODS: Method[] = [
  {
    id: 1,
    title: 'Difference-in-differences analysis of upzoning policy changes',
    description:
      'Compare permit issuance rates in upzoned vs. control areas before and after policy change. Requires at least 3 years post-intervention data.',
    status: 'active',
  },
  {
    id: 2,
    title: 'Hedonic rent model with new construction proximity',
    description:
      'Estimate the price effect of new market-rate construction on existing nearby units at various price points.',
    status: 'planned',
  },
];

const DEMO_REFERENCES: CanonicalReference[] = [
  {
    id: 1,
    objectRef: 301,
    objectTitle: 'Glaeser & Gyourko: The Impact of Zoning on Housing Affordability',
    objectType: 'source',
    agreement: 'agrees',
    summary: 'Core argument aligns: zoning restrictions are the primary driver of housing cost differentials across metros.',
  },
  {
    id: 2,
    objectRef: 302,
    objectTitle: 'Fischel: The Homevoter Hypothesis',
    objectType: 'source',
    agreement: 'partial',
    summary: 'Agrees on the political economy diagnosis but emphasizes homeowner risk aversion rather than pure NIMBY opposition.',
  },
];

const DEMO_FALSIFICATION: FalsificationCriterion[] = [
  {
    id: 1,
    text: 'If upzoned areas show no statistically significant increase in permits over 5 years, A1 is falsified.',
    status: 'untested',
  },
  {
    id: 2,
    text: 'If rents in neighborhoods near new construction increase rather than decrease, filtering (A2) is falsified.',
    status: 'untested',
  },
];

const DEMO_NARRATIVES: Narrative[] = [
  {
    id: 1,
    title: 'The Supply-Side Urbanism Narrative',
    objectRef: 401,
  },
  {
    id: 2,
    title: 'Progressive NIMBY: When Good Intentions Block Housing',
    objectRef: 402,
  },
];

const DEMO_MODEL_DETAIL: EpistemicModelDetail = {
  id: 1,
  title: 'Zoning Reform and Housing Affordability',
  thesis:
    'Relaxing single-family zoning in high-demand metropolitan areas will increase housing supply sufficiently to stabilize or reduce real rents within a decade.',
  modelType: 'explanatory',
  question:
    'Does upzoning actually increase housing production, and does new construction reduce rents through filtering?',
  assumptionCount: 4,
  methodCount: 2,
  questionCount: 1,
  createdAt: '2026-02-15T10:00:00Z',
  updatedAt: '2026-03-10T14:30:00Z',
  assumptions: DEMO_ASSUMPTIONS,
  tensions: DEMO_TENSIONS,
  methods: DEMO_METHODS,
  canonicalReferences: DEMO_REFERENCES,
  falsificationCriteria: DEMO_FALSIFICATION,
  narratives: DEMO_NARRATIVES,
};

const DEMO_MODELS: EpistemicModelSummary[] = [
  {
    id: 1,
    title: 'Zoning Reform and Housing Affordability',
    thesis:
      'Relaxing single-family zoning in high-demand metropolitan areas will increase housing supply sufficiently to stabilize or reduce real rents within a decade.',
    modelType: 'explanatory',
    assumptionCount: 4,
    methodCount: 2,
    questionCount: 1,
    createdAt: '2026-02-15T10:00:00Z',
    updatedAt: '2026-03-10T14:30:00Z',
  },
  {
    id: 2,
    title: 'Network Effects in Knowledge Management',
    thesis:
      'Personal knowledge graphs become exponentially more useful after crossing a threshold of approximately 200 interconnected objects.',
    modelType: 'predictive',
    assumptionCount: 2,
    methodCount: 1,
    questionCount: 2,
    createdAt: '2026-01-20T08:00:00Z',
    updatedAt: '2026-03-01T11:00:00Z',
  },
  {
    id: 3,
    title: 'Documentary Storytelling Structure',
    thesis:
      'The most compelling investigative documentaries use a three-act structure where the middle act systematically eliminates alternative explanations.',
    modelType: 'process',
    assumptionCount: 3,
    methodCount: 0,
    questionCount: 1,
    createdAt: '2026-03-05T16:00:00Z',
    updatedAt: '2026-03-12T09:00:00Z',
  },
];

const DEMO_ENGINE_LOG: EngineLogEntry[] = [
  {
    id: 'e1',
    timestamp: '2026-03-15T09:12:04Z',
    pass: 'sbert',
    message: 'Embedding 12 new claims, similarity threshold 0.72',
    modelId: 1,
  },
  {
    id: 'e2',
    timestamp: '2026-03-15T09:12:08Z',
    pass: 'nli',
    message: 'NLI scored 8 claim pairs: 3 support, 1 contradict, 4 neutral',
    modelId: 1,
  },
  {
    id: 'e3',
    timestamp: '2026-03-15T09:12:15Z',
    pass: 'stress',
    message: 'Stress test complete: drift 0.12, 2 unlinked assumptions',
    modelId: 1,
  },
  {
    id: 'e4',
    timestamp: '2026-03-15T09:12:18Z',
    pass: 'promote',
    message: 'Promoting 1 candidate: "Auckland Unitary Plan outcomes" → A1',
    modelId: 1,
  },
  {
    id: 'e5',
    timestamp: '2026-03-15T09:15:00Z',
    pass: 'kge',
    message: 'KGE embedding update: 340 triples, RotatE loss 0.023',
  },
];

const DEMO_STRESS_RESULT: StressResult = {
  drift: 0.12,
  unlinkedCount: 2,
  findings: [
    {
      id: 1,
      severity: 'high',
      text: 'A2 (filtering) has no direct empirical evidence from the last 5 years. Consider recent data.',
      linkedAssumptionId: 2,
    },
    {
      id: 2,
      severity: 'medium',
      text: 'A4 (environmental review) has only one evidence link. Gap risk if that source is retracted.',
      linkedAssumptionId: 4,
    },
    {
      id: 3,
      severity: 'low',
      text: 'Narrative coverage is complete. All assumptions appear in at least one narrative.',
    },
  ],
};

const DEMO_CANDIDATES: EngineCandidate[] = [
  {
    id: 1,
    objectRef: 501,
    objectTitle: 'Auckland Unitary Plan: 5-Year Housing Outcomes',
    objectType: 'source',
    suggestedAssumptionId: 1,
    relation: 'supports',
    confidence: 0.82,
    status: 'pending',
  },
  {
    id: 2,
    objectRef: 502,
    objectTitle: 'Gentrification accelerates before filtering in tight markets',
    objectType: 'hunch',
    suggestedAssumptionId: 2,
    relation: 'contradicts',
    confidence: 0.61,
    status: 'pending',
  },
];

/* ─────────────────────────────────────────────────
   API functions (demo; swap to real fetch later)
   ───────────────────────────────────────────────── */

export async function fetchModels(): Promise<EpistemicModelSummary[]> {
  return DEMO_MODELS;
}

export async function fetchModelDetail(
  id: number,
): Promise<EpistemicModelDetail> {
  if (id === 1) return DEMO_MODEL_DETAIL;
  const summary = DEMO_MODELS.find((m) => m.id === id);
  if (!summary) {
    throw new Error(`Model ${id} not found`);
  }
  return {
    ...summary,
    question: 'What is the central question?',
    assumptions: DEMO_ASSUMPTIONS.slice(0, 2),
    tensions: [],
    methods: [],
    canonicalReferences: [],
    falsificationCriteria: [],
    narratives: [],
  };
}

export async function fetchEngineLog(
  modelId?: number,
): Promise<EngineLogEntry[]> {
  if (modelId) {
    return DEMO_ENGINE_LOG.filter(
      (e) => e.modelId === modelId || !e.modelId,
    );
  }
  return DEMO_ENGINE_LOG;
}

export async function fetchStressResult(
  _modelId: number,
): Promise<StressResult> {
  return DEMO_STRESS_RESULT;
}

export async function fetchCandidates(
  _modelId: number,
): Promise<EngineCandidate[]> {
  return DEMO_CANDIDATES;
}
