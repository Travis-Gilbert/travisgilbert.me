export type AgentId = 'retrieval' | 'evaluator' | 'writer' | 'walker';

export interface AgentConfig {
  name: string;
  color: string;
  animationClass: string;
}

export const AGENTS: Record<AgentId, AgentConfig> = {
  retrieval: { name: 'Retrieval', color: 'var(--cw-teal)', animationClass: 'agent-dart' },
  evaluator: { name: 'Evaluator', color: 'var(--cw-amber)', animationClass: 'agent-pulse' },
  writer:    { name: 'Writer',    color: 'var(--cw-green)', animationClass: 'agent-flow' },
  walker:    { name: 'Graph Walker', color: 'var(--cw-terra)', animationClass: 'agent-ripple' },
};

export interface CodeFile {
  path: string;
  language: string;
  isModified?: boolean;
}

export interface StreamingEdit {
  lineNum: number;
  action: 'add' | 'modify' | 'delete';
  text: string;
  timestamp?: number;
}

export interface Suggestion {
  type: 'tension' | 'pattern' | 'insight' | 'next';
  title: string;
  body: string;
  action: string;
  color: string;
}

export interface Plugin {
  id: string;
  name: string;
  icon: string;
  color: string;
  active: boolean;
}

export type ChatMessageType = 'user' | 'theseus' | 'system' | 'agents';

export interface ChatMessage {
  type: ChatMessageType;
  text?: string;
  agents?: AgentId[];
}

/** Mock files for initial static display */
export const MOCK_FILES: CodeFile[] = [
  { path: 'apps/notebook/services/ask_pipeline.py', language: 'python' },
  { path: 'apps/notebook/services/answer_router.py', language: 'python' },
  { path: 'apps/notebook/unified_retrieval.py', language: 'python' },
  { path: 'apps/notebook/models/graph.py', language: 'python' },
  { path: 'apps/notebook/models/epistemic.py', language: 'python' },
  { path: 'apps/notebook/access_control.py', language: 'python' },
  { path: 'apps/api/middleware.py', language: 'python' },
  { path: 'mcp_server/tools/ask.py', language: 'python' },
];

export const MOCK_CODE = `"""
Answer type classification for visual answer construction.

Two-phase architecture:
  Phase 1 (keywords): Classify the answer TYPE.
  Phase 2 (E4B): Extract the ENTITY.
"""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

_VALID_ANSWER_TYPES = frozenset({
    'geographic', 'portrait', 'diagram',
    'comparison', 'timeline', 'hierarchy', 'explanation',
})

_GEOGRAPHIC_SIGNALS = [
    'neighborhood', 'neighbourhoods', 'district',
    'borough', 'suburb', 'quarter', 'zone',
    'best place', 'where to live', 'walkable',
]

_PORTRAIT_SIGNALS = [
    'who is', 'who was', 'who are',
    'biography', 'life of', 'biography of',
]

_DIAGRAM_SIGNALS = [
    'how does', 'how do',
    'mechanism of', 'process of', 'structure of',
]

_COMPARISON_SIGNALS = [
    'compare', ' vs ', ' versus ',
    'difference between', 'differences between',
]


def classify_answer_type(query: str) -> dict:
    """Classify a query into an answer type."""
    keyword_result = _classify_keywords(query)
    if keyword_result is not None:
        answer_type = keyword_result['answer_type']
        if not keyword_result.get('extracted_entity'):
            entity = _extract_entity_e4b(query, answer_type)
            if entity:
                keyword_result['extracted_entity'] = entity
        return keyword_result

    e4b_result = _classify_with_e4b(query)
    if e4b_result is not None:
        return e4b_result

    return {
        'answer_type': 'explanation',
        'confidence': 0.5,
        'reasoning': 'No signals matched',
    }


def _classify_keywords(query: str) -> dict | None:
    """Fast keyword-based classification."""
    q = query.lower()
    for signal in _GEOGRAPHIC_SIGNALS:
        if signal in q:
            return _build_result('geographic', query, signal)
    for signal in _PORTRAIT_SIGNALS:
        if signal in q:
            return _build_result('portrait', query, signal)
    return None`;

export const MOCK_EDITS: StreamingEdit[] = [
  { lineNum: 17, action: 'add', text: "    'code', 'architecture', 'dependency'," },
  { lineNum: 18, action: 'add', text: "    'impact', 'refactor', 'debug'," },
  { lineNum: 39, action: 'add', text: '' },
  { lineNum: 40, action: 'add', text: '_CODE_SIGNALS = [' },
  { lineNum: 41, action: 'add', text: "    'bug', 'error', 'fix', 'debug', 'traceback'," },
  { lineNum: 42, action: 'add', text: "    'refactor', 'implement', 'code review'," },
  { lineNum: 43, action: 'add', text: "    'what depends on', 'impact of changing'," },
  { lineNum: 44, action: 'add', text: "    'blast radius', 'architecture'," },
  { lineNum: 45, action: 'add', text: ']' },
];

export const MOCK_SUGGESTIONS: Suggestion[] = [
  { type: 'tension', title: 'Missing code routing', body: 'classify_answer_type handles 6 visual types but has no path for code queries. 17 MCP tool calls go through this.', action: 'Fix this', color: 'var(--cw-terra)' },
  { type: 'pattern', title: 'Similar to Apr 8 fix', body: 'The igraph lazy import fix used the same pattern: new code path in an existing router.', action: 'View pattern', color: 'var(--cw-purple)' },
  { type: 'insight', title: '8 downstream callers', body: 'Changes here propagate to ask_theseus, theseus_ask (MCP), and 6 views.', action: 'View impact', color: 'var(--cw-amber)' },
];

export const DEFAULT_PLUGINS: Plugin[] = [
  { id: 'github', name: 'GitHub', icon: 'GH', color: 'var(--cw-text)', active: true },
  { id: 'terminal', name: 'Terminal', icon: 'T', color: 'var(--cw-green)', active: false },
  { id: 'tests', name: 'Tests', icon: 'Ts', color: 'var(--cw-amber)', active: false },
  { id: 'graph', name: 'Graph Explorer', icon: 'Gx', color: 'var(--cw-teal)', active: false },
  { id: 'drift', name: 'Drift Detection', icon: 'Dd', color: 'var(--cw-terra)', active: false },
  { id: 'patterns', name: 'Pattern Memory', icon: 'Pm', color: 'var(--cw-purple)', active: false },
];
