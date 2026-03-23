// ── Types ────────────────────────────────────────────────────────

export interface ReadmeBadge {
  label: string;
  value: string;
  color: 'green' | 'teal' | 'terracotta';
}

export type SchematicColor = 'terracotta' | 'teal' | 'gold' | 'purple' | 'dim';

export interface SchematicSection {
  color: SchematicColor;
  label: string;
  sub?: string;
}

export interface SchematicRow {
  name: string;
  comment?: string;
  color: SchematicColor;
  depth: number;
  redacted?: boolean;
}

export interface SchematicData {
  id: string;
  title: string;
  subtitle?: string;
  accentColor: string;
  complexityLevel: 1 | 2 | 3 | 4 | 5;
  sections: SchematicSection[];
  rows: SchematicRow[];
  footerLeft: string;
  footerRight?: string;
}

export interface ClaimData {
  number: number;
  title: string;
  description: string;
  stack: string[];
  schematic: SchematicData;
  url?: string;
}

export interface PriorArtItem {
  name: string;
  note: string;
}

export interface LimitationItem {
  label: string;
  description: string;
}

// ── Badges ───────────────────────────────────────────────────────

export const BADGES: ReadmeBadge[] = [
  { label: 'build', value: 'passing', color: 'green' },
  { label: 'subscribers', value: '30k', color: 'teal' },
  { label: 'status', value: 'building in public', color: 'terracotta' },
  { label: 'videos', value: '70+', color: 'teal' },
];

// ── Tagline ──────────────────────────────────────────────────────

export const TAGLINE =
  'Writer, researcher, self-taught developer. I build tools that think about information and I make videos about whatever makes me curious.';

export const TAGLINE_SUB =
  "I don't have a computer science degree. I do have projects.";

// ── Abstract (patent register) ───────────────────────────────────

export const ABSTRACT_PARAGRAPHS: string[] = [
  'A method and apparatus for investigating whatever is interesting, comprising: a curiosity-driven video production pipeline (70+ videos, 30,000 subscribers), an epistemic intelligence engine capable of measuring its own cognition across seven axes, a knowledge management workbench designed for a brain that does not hold still, a self-improving plugin ecosystem with Bayesian confidence updating across 250+ typed knowledge claims, a government property sales portal, a compliance tracking system that consolidated a seven-step six-software SOP into four button presses, and a community music festival serving 3,000 attendees with 30+ musical acts and 50+ vendors annually.',
  'The system operates under persistent resource constraints (see: Known Limitations) and compensates through the construction of external cognitive instruments including production pipelines, task management architectures, writing workflows, and measurement frameworks.',
  'The inventor is based in Flint, Michigan. The inventor does not have a computer science degree. The inventor does have projects.',
];

// ── Description (readme register) ────────────────────────────────

export const DESCRIPTION_PARAGRAPHS: { text: string; muted?: boolean }[] = [
  {
    text: "If there's anything I've learned about attention spans it's that most of it can be chalked up to \"X should behave like Y, BUT...\"",
  },
  { text: 'We are all incredibly interested in contradictions.' },
  {
    text: "A world that makes sense to us entirely is boring. If you sit down and watch a movie and you think of it as one logical cohesive string of events, you didn't really watch a movie. You watched the equivalent of someone's grocery list. The difference between a grocery list and a story is someone saying \"I needed to get bananas, BUT...\"",
  },
  {
    text: 'Some of you reading this will think "well Travis, what about confirmation bias and echo chambers?" To which I will say: it seems like you\'ve got the start of a good story.',
    muted: true,
  },
  {
    text: "The second important thing I've learned is that multiple things can be true at once. The world resists simplicity no matter how much I would like simple explanations. I was once told that if you can't explain a thing simply, you simply don't understand it.",
  },
  { text: 'This is complete nonsense.' },
  {
    text: 'An explanation is a model of the world, and as long as we live in a world that is complex, dynamic, ever changing, ever moving towards entropy, the world will resist simplicity. And in exchange for that simplicity (note: exchange is an oversimplification) you actually get nothing in return. What you get is a chance at understanding something much richer than simplicity, which is the world around you.',
    muted: true,
  },
];

// ── How I Think (readme register) ────────────────────────────────

export const HOW_I_THINK_PARAGRAPHS: { text: string; muted?: boolean }[] = [
  {
    text: "Mostly, in terms of constraints. It's a curse but occasionally fruitful.",
  },
  {
    text: 'When life hands me a set of problems to solve, my immediate thought process is something like: "Given my resources (historically, unimpressive) (Constraint #001), how can I reduce and mitigate damages and buy time?"',
  },
  {
    text: "I also build tools that compensate for my own cognitive limitations. I have ADHD, OCD, and dyslexia. My working memory is unreliable. My ability to hold complex systems in my head is, for some reason, not. So I build external infrastructure: production pipelines, task management architectures, writing workflows, measurement frameworks.",
  },
  {
    text: "These aren't workarounds. They're cognitive instruments, and designing them is a discipline I take seriously.",
  },
];

// ── What I'm Looking For (readme register) ───────────────────────

export const LOOKING_FOR_PARAGRAPHS: { text: string; muted?: boolean }[] = [
  {
    text: 'Mentally stimulating work. Reasonable people. Fair compensation.',
  },
  {
    text: "I want to work on problems where the tools don't exist yet, where the answer isn't obvious, and where building the right instrument for the job is part of the job. I'm looking for teams that value clarity over ceremony, that understand the difference between rigor and rigidity, and that let people do their best thinking.",
    muted: true,
  },
  {
    text: "If you have something that fits, I'd like to hear about it.",
    muted: true,
  },
];

// ── Color mapping for schematics ─────────────────────────────────

export const SCHEMATIC_COLOR_MAP: Record<SchematicColor, string> = {
  terracotta: 'var(--color-terracotta)',
  teal: 'var(--color-teal)',
  gold: 'var(--color-gold)',
  purple: '#6B4F7A',
  dim: 'var(--color-readme-text-dim)',
};

export const SCHEMATIC_COLOR_LIGHT: Record<SchematicColor, string> = {
  terracotta: 'var(--color-terracotta-light)',
  teal: 'var(--color-teal-light)',
  gold: 'var(--color-gold-light)',
  purple: '#9B84AD',
  dim: 'var(--color-readme-text-dim)',
};

// ── Five showcase schematics ─────────────────────────────────────

export const SHOWCASE_SCHEMATICS: SchematicData[] = [
  // 1. Theseus Engine (5/5)
  {
    id: 'theseus',
    title: 'Theseus Engine',
    subtitle: 'IQ 17.6 \u2192 35.7',
    accentColor: 'var(--color-terracotta)',
    complexityLevel: 5,
    sections: [
      { color: 'terracotta', label: 'PIPELINE', sub: '7 passes' },
      { color: 'dim', label: '[REDACTED]', sub: 'Level 4\u20138 capabilities' },
      { color: 'teal', label: 'OUTPUT' },
      { color: 'gold', label: 'COMPUTE' },
    ],
    rows: [
      { name: '1', comment: '# SBERT embedding', color: 'terracotta', depth: 0 },
      { name: '2', comment: '# BM25 lexical', color: 'terracotta', depth: 0 },
      { name: '3', comment: '# NLI classification', color: 'terracotta', depth: 0 },
      { name: '[REDACTED]', comment: '# structural similarity', color: 'dim', depth: 0, redacted: true },
      { name: '5', comment: '# spaCy NER', color: 'terracotta', depth: 0 },
      { name: '6', comment: '# community detection', color: 'terracotta', depth: 0 },
      { name: '7', comment: '# IQ measurement', color: 'terracotta', depth: 0 },
      // [REDACTED] section rows
      { name: '[REDACTED]', comment: '# GNN link prediction', color: 'dim', depth: 0, redacted: true },
      { name: '[REDACTED]', comment: '# counterfactual sim', color: 'dim', depth: 0, redacted: true },
      // OUTPUT rows
      { name: 'knowledge_graph', comment: '# neurons + weights', color: 'teal', depth: 0 },
      // COMPUTE rows
      { name: 'ONNX Runtime', comment: '# frequent inference', color: 'gold', depth: 0 },
      { name: 'Modal GPU', comment: '# training jobs', color: 'gold', depth: 0 },
      { name: '[REDACTED]', comment: '# LoRA fine-tuning', color: 'dim', depth: 0, redacted: true },
    ],
    footerLeft: 'Objects = Neurons, Edges = Weights',
  },
  // 2. Index-API (4/5)
  {
    id: 'index-api',
    title: 'Index-API',
    subtitle: 'knowledge backend',
    accentColor: 'var(--color-teal)',
    complexityLevel: 4,
    sections: [
      { color: 'teal', label: 'APPS', sub: 'Django + DRF' },
      { color: 'terracotta', label: 'EPISTEMIC' },
      { color: 'gold', label: 'INFRA' },
    ],
    rows: [
      { name: 'commonplace/', comment: '# core models', color: 'teal', depth: 0 },
      { name: 'connections/', comment: '# edge manager', color: 'teal', depth: 0 },
      // EPISTEMIC rows
      { name: 'claims', comment: '# extracted assertions', color: 'terracotta', depth: 0 },
      { name: 'epistemic_models', comment: '# belief structures', color: 'terracotta', depth: 0 },
      { name: 'questions', comment: '# open threads', color: 'terracotta', depth: 0 },
      { name: 'tensions', comment: '# stored contradictions', color: 'terracotta', depth: 0 },
      // INFRA rows
      { name: 'pgvector', comment: '# semantic search', color: 'gold', depth: 0 },
      { name: 'PostGIS', comment: '# geographic queries', color: 'gold', depth: 0 },
      { name: 'Redis / RQ', comment: '# task queues', color: 'gold', depth: 0 },
    ],
    footerLeft: 'Railway, PostgreSQL',
  },
  // 3. CommonPlace (4/5)
  {
    id: 'commonplace',
    title: 'CommonPlace',
    subtitle: 'knowledge workbench',
    accentColor: 'var(--color-teal)',
    complexityLevel: 4,
    sections: [
      { color: 'terracotta', label: 'FRONTEND', sub: 'Next.js + React 19' },
      { color: 'teal', label: 'API', sub: 'Index-API (Django + DRF)' },
      { color: 'gold', label: 'DESIGN' },
    ],
    rows: [
      { name: 'Library/', comment: '# cluster cards, D3 graphs', color: 'terracotta', depth: 0 },
      { name: 'ObjectRenderer/', comment: '# polymorphic by type', color: 'terracotta', depth: 0 },
      { name: 'Compose/', comment: '# authoring + engine terminal', color: 'terracotta', depth: 0 },
      { name: 'Sidebar/', comment: '# Cmd+K, Resurface', color: 'terracotta', depth: 0 },
      // API rows
      { name: 'objects/', comment: '# notes, sources, hunches', color: 'teal', depth: 0 },
      { name: 'connections/', comment: '# Theseus-generated edges', color: 'teal', depth: 0 },
      { name: 'epistemic/', comment: '# models, claims, tensions', color: 'teal', depth: 0 },
      // DESIGN rows
      { name: 'rough.js', comment: '# hand-drawn elements', color: 'gold', depth: 0 },
      { name: 'D3 force', comment: '# cluster visualization', color: 'gold', depth: 0 },
      { name: 'DotGrid', comment: '# spring-physics canvas', color: 'gold', depth: 0 },
    ],
    footerLeft: 'Tailwind v4, Vercel + Railway',
  },
  // 4. Compliance.Thelandbank.org (2/5)
  {
    id: 'compliance',
    title: 'Compliance System',
    subtitle: 'compliance.thelandbank.org',
    accentColor: 'var(--color-teal)',
    complexityLevel: 2,
    sections: [
      { color: 'teal', label: 'DJANGO' },
      { color: 'gold', label: 'INTEGRATION' },
    ],
    rows: [
      { name: 'compliance/', comment: '# tracking engine', color: 'teal', depth: 0 },
      { name: 'models.py', comment: '# 2K+ homes', color: 'teal', depth: 0 },
      { name: 'views.py', comment: '# SOP automation', color: 'teal', depth: 0 },
      // INTEGRATION rows
      { name: 'filemaker/', comment: '# fixed connection', color: 'gold', depth: 0 },
      { name: 'postgresql', comment: '', color: 'dim', depth: 0 },
    ],
    footerLeft: '7 steps to 4 buttons',
  },
  // 5. Codex Plugins (4/5)
  {
    id: 'codex-plugins',
    title: 'Codex Plugins',
    subtitle: 'epistemic ML',
    accentColor: 'var(--color-terracotta)',
    complexityLevel: 4,
    sections: [
      { color: 'terracotta', label: 'TWO-SURFACE ARCHITECTURE' },
      { color: 'teal', label: 'EPISTEMIC LAYER' },
      { color: 'purple', label: 'PLUGINS', sub: '11 specialists' },
    ],
    rows: [
      { name: 'chat_skills/', comment: '# planning surface', color: 'terracotta', depth: 0 },
      { name: 'claude_code/', comment: '# implementation surface', color: 'terracotta', depth: 0 },
      // EPISTEMIC rows
      { name: 'knowledge/', comment: '# claims.jsonl + tensions', color: 'teal', depth: 0 },
      { name: 'confidence', comment: '# Bayesian updating', color: 'teal', depth: 0 },
      { name: 'session_log/', comment: '# per-session observations', color: 'teal', depth: 0 },
      // PLUGIN rows
      { name: 'ml-pro', comment: '# PyTorch + GNNs', color: 'purple', depth: 0 },
      { name: 'scipy-pro', comment: '# NLP + graph theory', color: 'purple', depth: 0 },
      { name: 'ui-design-pro', comment: '# 140 claims @ 0.667 conf', color: 'purple', depth: 0 },
      { name: 'django-engine-pro', comment: '# 111 claims', color: 'purple', depth: 0 },
      { name: 'd3-pro', comment: '# Observable canon', color: 'purple', depth: 0 },
      { name: 'animation-pro', comment: '# spring physics', color: 'purple', depth: 0 },
    ],
    footerLeft: 'Self-improving development tools',
  },
];

// ── 12 Claims ────────────────────────────────────────────────────

export const CLAIMS: ClaimData[] = [
  {
    number: 1,
    title: 'Theseus: Epistemic Intelligence Engine',
    description:
      'An epistemic intelligence engine comprising a seven-pass pipeline that discovers semantic, structural, and logical connections across heterogeneous knowledge objects, with self-measurement across seven axes. IQ: 17.6 to 35.7 in a single activation session. Named for Claude Shannon\'s maze-navigating mouse.',
    stack: ['spaCy', 'SBERT', 'BM25', 'NLI', 'KGE/RotatE', 'ONNX', 'PyTorch', 'Modal'],
    schematic: {
      id: 'cl-theseus',
      title: 'Theseus',
      accentColor: 'var(--color-terracotta)',
      complexityLevel: 5,
      sections: [
        { color: 'terracotta', label: 'PIPELINE' },
        { color: 'teal', label: 'OUTPUT' },
      ],
      rows: [
        { name: '1..7', comment: 'SBERT \u2192 BM25 \u2192 NLI \u2192 KGE \u2192 NER \u2192 CD \u2192 IQ', color: 'terracotta', depth: 0 },
        { name: 'knowledge_graph', comment: '', color: 'teal', depth: 0 },
      ],
      footerLeft: 'ONNX + Modal',
    },
  },
  {
    number: 2,
    title: 'Index-API: Knowledge Backend',
    description:
      'A Django REST Framework API serving 22 endpoints with 190 tests, comprising object management, epistemic model CRUD, claim extraction, tension tracking, and spaCy-powered connection engine. API-key gated with middleware authentication.',
    stack: ['Django', 'DRF', 'spaCy', 'pgvector', 'PostGIS', 'Redis', 'RQ'],
    schematic: {
      id: 'cl-index-api',
      title: 'Index-API',
      accentColor: 'var(--color-teal)',
      complexityLevel: 4,
      sections: [
        { color: 'teal', label: 'APPS' },
        { color: 'gold', label: 'INFRA' },
      ],
      rows: [
        { name: 'notebook/', comment: '12 models', color: 'teal', depth: 0 },
        { name: 'api/', comment: '22 endpoints', color: 'teal', depth: 0 },
        { name: 'PostgreSQL', comment: 'Railway', color: 'gold', depth: 0 },
      ],
      footerLeft: '190 tests',
    },
  },
  {
    number: 3,
    title: 'CommonPlace: Knowledge Management Interface',
    description:
      'A split-pane knowledge workbench with recursive binary tree layout, polymorphic object rendering (10 types), D3 force-directed cluster visualization, and real-time API integration with the Index-API backend.',
    stack: ['Next.js', 'React 19', 'D3', 'rough.js', 'Tailwind v4'],
    schematic: {
      id: 'cl-commonplace',
      title: 'CommonPlace',
      accentColor: 'var(--color-teal)',
      complexityLevel: 4,
      sections: [
        { color: 'terracotta', label: 'FRONTEND' },
        { color: 'teal', label: 'API' },
      ],
      rows: [
        { name: 'Library/', comment: 'clusters + D3', color: 'terracotta', depth: 0 },
        { name: 'Compose/', comment: 'authoring', color: 'terracotta', depth: 0 },
        { name: 'objects/', comment: '10 types', color: 'teal', depth: 0 },
      ],
      footerLeft: 'Vercel + Railway',
    },
  },
  {
    number: 4,
    title: 'Codex Plugins: Epistemic ML Development Tools',
    description:
      'A self-improving plugin ecosystem for Claude Code with Bayesian confidence updating across 250+ typed knowledge claims, session-level observation logging, and 11 specialist plugins spanning ML, NLP, graph theory, and UI design.',
    stack: ['Claude Code', 'Bayesian', 'JSONL', 'Markdown', 'YAML'],
    schematic: {
      id: 'cl-codex',
      title: 'Codex',
      accentColor: 'var(--color-terracotta)',
      complexityLevel: 4,
      sections: [
        { color: 'terracotta', label: 'SURFACES' },
        { color: 'purple', label: 'PLUGINS' },
      ],
      rows: [
        { name: 'chat + code', comment: '2 surfaces', color: 'terracotta', depth: 0 },
        { name: '11 specialists', comment: '250+ claims', color: 'purple', depth: 0 },
      ],
      footerLeft: 'Self-improving',
    },
  },
  {
    number: 5,
    title: 'Publishing API: Writing Studio Backend',
    description:
      'A Django content management system with HTMX editor, markdown toolbar, visual pipeline (Draft to Published), and GitHub Contents API integration for automated deployment. Includes video production pipeline with 7 batch phases.',
    stack: ['Django', 'HTMX', 'Pillow', 'GitHub API', 'Tailwind'],
    schematic: {
      id: 'cl-publishing',
      title: 'Studio',
      accentColor: 'var(--color-teal)',
      complexityLevel: 3,
      sections: [
        { color: 'teal', label: 'DJANGO' },
        { color: 'terracotta', label: 'EDITOR' },
      ],
      rows: [
        { name: 'content/', comment: 'pipeline', color: 'teal', depth: 0 },
        { name: 'HTMX', comment: 'split-pane', color: 'terracotta', depth: 0 },
      ],
      footerLeft: 'GitHub API deploy',
    },
  },
  {
    number: 6,
    title: 'GitHub-MCP: Custom MCP Server',
    description:
      'A Model Context Protocol server bridging GitHub API operations (issues, PRs, commits, releases) into Claude Code tooling. Handles authentication, pagination, and rate limiting transparently.',
    stack: ['TypeScript', 'MCP SDK', 'GitHub API', 'OAuth'],
    schematic: {
      id: 'cl-github-mcp',
      title: 'GitHub-MCP',
      accentColor: 'var(--color-purple)',
      complexityLevel: 2,
      sections: [{ color: 'purple', label: 'MCP' }],
      rows: [
        { name: 'tools/', comment: 'CRUD ops', color: 'purple', depth: 0 },
        { name: 'auth', comment: 'OAuth + rate limit', color: 'dim', depth: 0 },
      ],
      footerLeft: 'Model Context Protocol',
    },
  },
  {
    number: 7,
    title: 'GCLBA Property Sales Portal',
    description:
      'A public-facing property sales portal for the Genesee County Land Bank Authority. Dynamic forms per program type, application scoring, document upload and tracking, reCAPTCHA v3 integration.',
    stack: ['Django', 'HTMX', 'PostgreSQL', 'Railway'],
    url: 'https://apply.thelandbank.org',
    schematic: {
      id: 'cl-gclba',
      title: 'GCLBA Portal',
      accentColor: 'var(--color-teal)',
      complexityLevel: 3,
      sections: [{ color: 'teal', label: 'DJANGO' }],
      rows: [
        { name: 'programs/', comment: '4 types', color: 'teal', depth: 0 },
        { name: 'forms/', comment: 'dynamic', color: 'teal', depth: 0 },
      ],
      footerLeft: 'apply.thelandbank.org',
    },
  },
  {
    number: 8,
    title: 'Compliance.Thelandbank.org',
    description:
      'A compliance tracking system that consolidated a seven-step, six-software SOP into four button presses. Manages 2,000+ property records with automated workflow, FileMaker integration, and PostgreSQL backend.',
    stack: ['Django', 'FileMaker', 'PostgreSQL'],
    url: 'https://compliance.thelandbank.org',
    schematic: {
      id: 'cl-compliance',
      title: 'Compliance',
      accentColor: 'var(--color-teal)',
      complexityLevel: 2,
      sections: [{ color: 'teal', label: 'DJANGO' }],
      rows: [
        { name: 'tracking/', comment: '2K+ homes', color: 'teal', depth: 0 },
        { name: 'filemaker/', comment: 'bridge', color: 'gold', depth: 0 },
      ],
      footerLeft: '7 steps to 4 buttons',
    },
  },
  {
    number: 9,
    title: 'Compliance Inspection Tracker',
    description:
      'A mobile-first inspection tracking tool for field compliance officers. Offline-capable photo capture, GPS tagging, and sync-on-reconnect architecture for areas with unreliable connectivity.',
    stack: ['Django', 'PWA', 'IndexedDB', 'Service Worker'],
    schematic: {
      id: 'cl-inspection',
      title: 'Inspector',
      accentColor: 'var(--color-teal)',
      complexityLevel: 2,
      sections: [{ color: 'teal', label: 'PWA' }],
      rows: [
        { name: 'offline/', comment: 'sync-on-reconnect', color: 'teal', depth: 0 },
        { name: 'capture/', comment: 'GPS + photo', color: 'gold', depth: 0 },
      ],
      footerLeft: 'Mobile-first',
    },
  },
  {
    number: 10,
    title: 'travisgilbert.me',
    description:
      'This website. A Next.js 16 static site with App Router, rough.js hand-drawn elements, deterministic PRNG generative art, five content collections with Zod validation, and seven custom fonts. Server Components by default, client only when needed.',
    stack: ['Next.js 16', 'React 19', 'rough.js', 'Tailwind v4', 'Zod'],
    url: 'https://travisgilbert.me',
    schematic: {
      id: 'cl-website',
      title: 'travisgilbert.me',
      accentColor: 'var(--color-terracotta)',
      complexityLevel: 3,
      sections: [
        { color: 'terracotta', label: 'FRONTEND' },
      ],
      rows: [
        { name: 'app/', comment: '5 collections', color: 'terracotta', depth: 0 },
        { name: 'rough.js', comment: 'hand-drawn', color: 'gold', depth: 0 },
      ],
      footerLeft: 'Vercel SSG',
    },
  },
  {
    number: 11,
    title: 'Curious Tangents: YouTube Channel',
    description:
      '30,000 subscribers, 70+ videos investigating how design decisions shape human outcomes. Covers topics from urban planning to information architecture. Full production pipeline: research, scripting, recording, editing, publishing.',
    stack: ['DaVinci Resolve', 'Ulysses', 'TickTick', 'YouTube API'],
    url: 'https://youtube.com/@curioustangents',
    schematic: {
      id: 'cl-youtube',
      title: 'Curious Tangents',
      accentColor: 'var(--color-terracotta)',
      complexityLevel: 2,
      sections: [{ color: 'terracotta', label: 'PIPELINE' }],
      rows: [
        { name: 'P0..P7', comment: 'research to publish', color: 'terracotta', depth: 0 },
        { name: '70+ videos', comment: '30K subs', color: 'gold', depth: 0 },
      ],
      footerLeft: 'Investigation-driven',
    },
  },
  {
    number: 12,
    title: 'Porchfest: Community Music Festival',
    description:
      'A community music festival serving 3,000 attendees annually with 30+ musical acts and 50+ vendors. Coordination of logistics, vendor management, scheduling, volunteer organization, and public communications.',
    stack: ['Event Planning', 'Logistics', 'Community'],
    schematic: {
      id: 'cl-porchfest',
      title: 'Porchfest',
      accentColor: 'var(--color-gold)',
      complexityLevel: 1,
      sections: [{ color: 'gold', label: 'EVENT' }],
      rows: [
        { name: '30+ acts', comment: '50+ vendors', color: 'gold', depth: 0 },
        { name: '3,000', comment: 'attendees', color: 'dim', depth: 0 },
      ],
      footerLeft: 'Annual, Flint MI',
    },
  },
];

// ── Prior Art ─────────────────────────────────────────────────────

export const PRIOR_ART: PriorArtItem[] = [
  {
    name: 'Claude Shannon',
    note: 'Information theory, maze-solving mouse (Theseus), the idea that information can be measured.',
  },
  {
    name: 'Vannevar Bush',
    note: '"As We May Think" (1945). The memex. Associative trails. The original knowledge workbench.',
  },
  {
    name: 'Edward Tufte',
    note: 'Data-ink ratio. Chartjunk. The conviction that visual evidence should be dense, honest, and beautiful.',
  },
  {
    name: 'Jane Jacobs',
    note: 'Eyes on the street. Systems that self-organize from local knowledge. Cities as complex adaptive systems.',
  },
];

// ── Limitations ──────────────────────────────────────────────────

export const LIMITATIONS: LimitationItem[] = [
  {
    label: 'ADHD',
    description:
      'Working memory is unreliable. Compensated through external cognitive instruments (see: every project above).',
  },
  {
    label: 'OCD',
    description:
      'Pattern recognition is weaponized against its owner. Occasionally useful for quality control.',
  },
  {
    label: 'Dyslexia',
    description:
      'Text processing is adversarial. Compensated through careful tooling and workflow design.',
  },
  {
    label: 'No CS Degree',
    description:
      'Self-taught through building. Every project above is evidence of learning by doing.',
  },
  {
    label: 'Resources',
    description:
      'Historically unimpressive. Compensated through constraint-driven design and creative problem solving.',
  },
];
