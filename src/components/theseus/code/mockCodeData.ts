/**
 * Mock fixtures for CodeExplorer development before the Ninja backend
 * endpoints (P1/P2 of SPEC-CODE-INTELLIGENCE) are wired up.
 *
 * Activated by ?mock=1 in the URL or when NODE_ENV=development and no
 * backend is reachable. See useCodeExplorer.ts for the wiring.
 */

import type {
  CodeContextResult,
  CodeImpactResult,
  CodeProcess,
  CodeSymbol,
  DriftTension,
  FixPattern,
  IngestionStats,
} from '@/lib/theseus-types';

export const MOCK_SYMBOLS: CodeSymbol[] = [
  {
    object_id: '1',
    name: 'ask_pipeline',
    entity_type: 'code_member',
    file_path: 'apps/notebook/services/ask_pipeline.py',
    line_number: 42,
    language: 'python',
    community_id: 0,
  },
  {
    object_id: '2',
    name: 'classify_answer_type',
    entity_type: 'code_member',
    file_path: 'apps/notebook/services/answer_router.py',
    line_number: 107,
    language: 'python',
    community_id: 0,
  },
  {
    object_id: '3',
    name: 'Object',
    entity_type: 'code_structure',
    file_path: 'apps/notebook/models/graph.py',
    line_number: 18,
    language: 'python',
    community_id: 1,
  },
  {
    object_id: '4',
    name: 'Edge',
    entity_type: 'code_structure',
    file_path: 'apps/notebook/models/graph.py',
    line_number: 112,
    language: 'python',
    community_id: 1,
  },
  {
    object_id: '5',
    name: 'unified_retrieval',
    entity_type: 'code_member',
    file_path: 'apps/notebook/unified_retrieval.py',
    line_number: 20,
    language: 'python',
    community_id: 0,
  },
  {
    object_id: '6',
    name: 'Tension',
    entity_type: 'code_structure',
    file_path: 'apps/notebook/models/epistemic.py',
    line_number: 88,
    language: 'python',
    community_id: 1,
  },
  {
    object_id: '7',
    name: 'compose_engine',
    entity_type: 'code_member',
    file_path: 'apps/notebook/compose_engine.py',
    line_number: 15,
    language: 'python',
    community_id: 0,
  },
  {
    object_id: '8',
    name: 'APIKeyMiddleware',
    entity_type: 'code_structure',
    file_path: 'apps/api/middleware.py',
    line_number: 22,
    language: 'python',
    community_id: 2,
  },
  {
    object_id: '9',
    name: 'theseus_ask',
    entity_type: 'code_member',
    file_path: 'mcp_server/tools/ask.py',
    line_number: 34,
    language: 'python',
    community_id: 3,
  },
  {
    object_id: '10',
    name: 'run_engine',
    entity_type: 'code_process',
    file_path: 'apps/notebook/engine.py',
    line_number: 60,
    language: 'python',
    community_id: 4,
  },
  {
    object_id: '11',
    name: 'AskExperience',
    entity_type: 'code_structure',
    file_path: 'src/components/theseus/AskExperience.tsx',
    line_number: 1,
    language: 'typescript',
    community_id: 5,
  },
  {
    object_id: '12',
    name: 'SpecificationParser',
    entity_type: 'specification',
    file_path: 'apps/notebook/compiler/spec_parser.py',
    line_number: 14,
    language: 'python',
    community_id: 2,
  },
];

export const MOCK_IMPACT: CodeImpactResult = {
  target: 'classify_answer_type',
  direction: 'both',
  depth_groups: [
    {
      depth: 1,
      symbols: [
        {
          object_id: '1',
          name: 'ask_pipeline',
          entity_type: 'code_member',
          ppr_score: 0.82,
          edge_types: ['calls'],
          processes: ['ask_flow'],
        },
        {
          object_id: '9',
          name: 'theseus_ask',
          entity_type: 'code_member',
          ppr_score: 0.74,
          edge_types: ['calls'],
          processes: ['ask_flow'],
        },
        {
          object_id: '5',
          name: 'unified_retrieval',
          entity_type: 'code_member',
          ppr_score: 0.68,
          edge_types: ['calls'],
          processes: ['ask_flow'],
        },
      ],
    },
    {
      depth: 2,
      symbols: [
        {
          object_id: '7',
          name: 'compose_engine',
          entity_type: 'code_member',
          ppr_score: 0.52,
          edge_types: ['calls', 'imports'],
          processes: ['ask_flow'],
        },
        {
          object_id: '3',
          name: 'Object',
          entity_type: 'code_structure',
          ppr_score: 0.44,
          edge_types: ['references'],
          processes: [],
        },
        {
          object_id: '11',
          name: 'AskExperience',
          entity_type: 'code_structure',
          ppr_score: 0.41,
          edge_types: ['calls'],
          processes: ['ui_render'],
        },
      ],
    },
    {
      depth: 3,
      symbols: [
        {
          object_id: '4',
          name: 'Edge',
          entity_type: 'code_structure',
          ppr_score: 0.28,
          edge_types: ['references'],
          processes: [],
        },
        {
          object_id: '6',
          name: 'Tension',
          entity_type: 'code_structure',
          ppr_score: 0.22,
          edge_types: ['references'],
          processes: [],
        },
        {
          object_id: '8',
          name: 'APIKeyMiddleware',
          entity_type: 'code_structure',
          ppr_score: 0.18,
          edge_types: ['references'],
          processes: ['request_lifecycle'],
        },
      ],
    },
  ],
  total_affected: 9,
};

export const MOCK_CONTEXT: CodeContextResult = {
  symbol: MOCK_SYMBOLS[1],
  incoming: [
    { symbol: MOCK_SYMBOLS[0], edge_type: 'calls', strength: 0.9 },
    { symbol: MOCK_SYMBOLS[8], edge_type: 'calls', strength: 0.7 },
  ],
  outgoing: [
    { symbol: MOCK_SYMBOLS[6], edge_type: 'calls', strength: 0.6 },
    { symbol: MOCK_SYMBOLS[2], edge_type: 'references', strength: 0.3 },
  ],
  processes: [
    { id: 'p1', title: 'Ask flow: user query to answer', step_count: 14 },
    { id: 'p2', title: 'Answer type classification', step_count: 3 },
  ],
  cluster: { id: 0, label: 'Ask pipeline', member_count: 12 },
};

export const MOCK_PROCESSES: CodeProcess[] = [
  {
    id: 'p1',
    title: 'Ask flow: user query to answer',
    entry_point: 'theseus_ask (MCP)',
    steps: [
      { object_id: '9', name: 'theseus_ask', order: 0 },
      { object_id: '1', name: 'ask_pipeline', order: 1 },
      { object_id: '2', name: 'classify_answer_type', order: 2 },
      { object_id: '5', name: 'unified_retrieval', order: 3 },
      { object_id: '7', name: 'compose_engine', order: 4 },
    ],
    language: 'python',
  },
];

export const MOCK_DRIFT: DriftTension[] = [
  {
    id: 'd1',
    title: 'Missing code routing in classify_answer_type',
    severity: 0.82,
    tension_type: 'spec_drift',
    spec_expectation:
      'classify_answer_type must handle the "code" answer type by matching _CODE_SIGNALS before falling through to E4B.',
    code_reality:
      'The function only checks 6 visual types. No code signals are inspected. Code queries fall through to the explanation default.',
    spec_object_id: 's1',
    code_object_id: '2',
    status: 'active',
  },
  {
    id: 'd2',
    title: 'Undocumented: APIKeyMiddleware bypasses /api/v2/',
    severity: 0.45,
    tension_type: 'spec_drift',
    spec_expectation:
      'EXEMPT_PREFIXES should include every public UI endpoint, enumerated explicitly.',
    code_reality:
      'The current exemption uses a prefix match on /api/v2/ which is broader than specified. New endpoints inherit the exemption without review.',
    spec_object_id: 's2',
    code_object_id: '8',
    status: 'active',
  },
];

export const MOCK_PATTERNS: FixPattern[] = [
  {
    id: 'fp1',
    title: 'Add new branch to classify_answer_type',
    problem: 'New answer type needed in a 6-way classifier with 8 callers.',
    root_cause:
      'The classifier is keyword-first with an E4B fallback. Adding a type without touching callers means appending signals and extending _VALID_ANSWER_TYPES.',
    fix_summary:
      'Append the new type to _VALID_ANSWER_TYPES, define its signals list, and add a keyword-match branch before the E4B fallback. Interface stays stable.',
    reasoning_steps: [
      'Grep for all callers of classify_answer_type to confirm interface stability matters',
      'Inspect existing branches for the signal-list pattern',
      'Add new type + signals in the same shape',
    ],
    feedback_label: 'solves_problem',
    files_involved: [
      'apps/notebook/services/answer_router.py',
      'apps/notebook/services/ask_pipeline.py',
    ],
    created_at: '2026-04-08T14:22:00Z',
    ppr_score: 0.91,
  },
  {
    id: 'fp2',
    title: 'Lazy-import heavy dependencies in engine entry points',
    problem: 'Cold-start import cost of igraph, spaCy, or torch poisons quick endpoints.',
    root_cause:
      'Top-level imports run at module load. Any view that imports the engine module pays the cost even for unrelated endpoints.',
    fix_summary:
      'Move heavy imports inside the function that uses them. Cache the module reference in a module-level dict after first call.',
    reasoning_steps: [
      'Profile cold-start to identify offenders',
      'Wrap imports in a _lazy_import() helper',
      'Memoize on the module global',
    ],
    feedback_label: 'solves_problem',
    files_involved: ['apps/notebook/engine.py', 'apps/notebook/unified_retrieval.py'],
    created_at: '2026-04-08T09:15:00Z',
    ppr_score: 0.76,
  },
];

export const MOCK_INGESTION_STATS: IngestionStats = {
  objects_created: 184,
  edges_created: 412,
  processes_detected: 6,
  languages: ['python', 'typescript'],
  duration_ms: 18_400,
};
