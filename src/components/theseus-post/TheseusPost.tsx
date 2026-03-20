'use client';

// TheseusPost.tsx: Client root for the Theseus x CommonPlace explainer page.
// Owns scroll state, zone tracking, and renders all 14 sections.
// Composes all five visual modes: OPEN, EDITORIAL, SPLIT, TECHNICAL, FLOATING.

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { MazeZone } from './MazeWalls';
import './theseus-post.css';
import { createZoneTracker } from './mazeZones';
import MazeBackground from './MazeBackground';
import ContentSection from './ContentSection';
import Interstitial from './Interstitial';
import SplitSection from './SplitSection';
import TechnicalSection from './TechnicalSection';
import FloatingAnnotation from './FloatingAnnotation';
import MarginNote from './MarginNote';
import PipelinePass from './PipelinePass';
import LevelRow from './LevelRow';

// Pipeline data (from theseus-data.ts, adapted for this page)
const PASSES = [
  { num: 1, name: 'Named Entity Recognition', tech: 'spaCy + graph-learned phrases', desc: 'Extracts people, organizations, places, and domain concepts. A custom PhraseMatcher learns new entities from the graph itself.' },
  { num: 2, name: 'Shared Entity Edges', tech: 'entity co-occurrence', desc: 'If two objects mention the same person, place, or concept, they share an edge. Simple, reliable, fast.' },
  { num: 3, name: 'Lexical Scoring', tech: 'BM25 retrieval', desc: 'Finds documents with overlapping terminology. Fast, interpretable, catches exact-match relationships semantic models miss.' },
  { num: 4, name: 'Semantic Similarity', tech: 'SBERT via ONNX Runtime', desc: 'Embeds every object into a vector space. "Walkability" connects to "pedestrian infrastructure" without shared terms.' },
  { num: 5, name: 'Stance Detection', tech: 'NLI CrossEncoder', desc: 'Classifies whether claims support, contradict, or ignore each other. Contradiction tracking depends on this pass.' },
  { num: 6, name: 'Structural Similarity', tech: 'RotatE via PyKEEN', desc: 'Embeds graph structure into vector space. Finds entities in similar structural positions. Detects analogies across domains.' },
  { num: 7, name: 'Causal DAG', tech: 'temporal precedence', desc: 'Builds a directed acyclic graph of influence. Earlier sources that shaped later work get credit. Provenance becomes navigable.' },
];

// Roadmap levels
const LEVELS: { level: number; name: string; desc: string; status: 'shipped' | 'in-progress' | 'planned' | 'research' }[] = [
  { level: 1, name: 'Tool Inference', desc: 'Pre-trained models via ONNX Runtime. spaCy NER, SBERT embeddings, NLI classification. No user data required.', status: 'shipped' },
  { level: 2, name: 'Learned Scoring', desc: 'User feedback trains edge weights. The engine learns which connections matter to you, not just what the models detect.', status: 'shipped' },
  { level: 3, name: 'Hypothesis Generation', desc: 'Fine-tuned language model proposes new links grounded in graph evidence. Not hallucination: grounded generation.', status: 'in-progress' },
  { level: 4, name: 'Emergent Ontology', desc: 'Categories nobody defined. The graph discovers its own structure. Object types emerge from clustering, not from schemas.', status: 'in-progress' },
  { level: 5, name: 'Self-Modifying Pipeline', desc: 'The engine reweights its own passes per domain. Scientific corpora need different signals than legal discovery.', status: 'planned' },
  { level: 6, name: 'Multi-Agent Reasoning', desc: 'Advocate, Critic, and Judge debate explanations. Adversarial verification of claims. Ensemble confidence scoring.', status: 'planned' },
  { level: 7, name: 'Counterfactual Simulation', desc: '"What if this source is removed?" Dependency cascades, fragility analysis, alternative graph states.', status: 'research' },
  { level: 8, name: 'Creative Hypothesis', desc: 'Graph neural networks generate novel connections no pass would find. The engine proposes what should be known next.', status: 'research' },
];

// Connector pills for Index-API section
const CONNECTORS = [
  'Firecrawl', 'PDF ingestion', 'DOCX parser', 'RSS feeds',
  'Zotero', 'Readwise', 'BibTeX', 'OCR (SAM-2)',
  'Web scraping', 'Email', 'Obsidian export',
];

export default function TheseusPost() {
  const reducedMotion = usePrefersReducedMotion();
  const [activeZones, setActiveZones] = useState<Set<MazeZone>>(new Set());
  const [pipelineVisible, setPipelineVisible] = useState(false);

  // Refs for zone tracking
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const registerSection = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      sectionRefs.current.set(id, el);
    }
  }, []);

  // Zone tracker
  useEffect(() => {
    const tracker = createZoneTracker((zones) => {
      setActiveZones(zones);
    });

    // Register all sections
    for (const [id, el] of sectionRefs.current.entries()) {
      tracker.observe(id, el);
    }

    return () => tracker.disconnect();
  }, []);

  // Pipeline section observer for staggered reveal
  useEffect(() => {
    const pipelineEl = sectionRefs.current.get('pipeline');
    if (!pipelineEl) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPipelineVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '-20% 0px' },
    );

    obs.observe(pipelineEl);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {/* Fixed maze background */}
      <MazeBackground activeZones={activeZones} reducedMotion={reducedMotion} />

      {/* Scrollable content */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ─── 1. HERO (MODE: OPEN) ─── */}
        <div
          ref={(el) => registerSection('hero', el)}
          id="hero"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '40px 24px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ maxWidth: 800 }}>
            <h1
              style={{
                fontSize: 'clamp(32px, 4.5vw, 48px)',
                lineHeight: 1.1,
                marginBottom: 0,
                textShadow: '0 0 40px rgba(244, 243, 240, 0.95), 0 0 80px rgba(244, 243, 240, 0.8)',
                fontFeatureSettings: "'kern' 1, 'liga' 1, 'calt' 1",
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                gap: 'clamp(10px, 1.5vw, 18px)',
                flexWrap: 'nowrap',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  color: '#C4503C',
                  fontFamily: 'var(--font-code, "JetBrains Mono", monospace)',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                Theseus
              </span>
              <span
                style={{
                  color: '#8a8070',
                  fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
                  fontWeight: 400,
                  fontSize: 'clamp(20px, 2.5vw, 28px)',
                  letterSpacing: '0.1em',
                }}
              >
                x
              </span>
              <span
                style={{
                  color: '#1A6E7E',
                  fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
                  fontWeight: 700,
                }}
              >
                CommonPlace
              </span>
            </h1>

            <p
              style={{
                fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(17px, 2vw, 22px)',
                fontWeight: 400,
                color: '#2A2420',
                marginTop: 32,
                lineHeight: 1.6,
                textShadow: '0 0 30px rgba(244, 243, 240, 0.9)',
              }}
            >
              Your tools should know about each other.
            </p>

            <p
              style={{
                fontFamily: 'var(--font-body, "IBM Plex Sans", sans-serif)',
                fontSize: 14,
                fontWeight: 300,
                color: '#6B6560',
                marginTop: 24,
                lineHeight: 1.7,
                textShadow: '0 0 20px rgba(244, 243, 240, 0.8)',
              }}
            >
              A self-improving intelligence engine. A knowledge interface built for structure. A connection layer to the world. Two tools that become one system.
            </p>

            {/* Shannon quote */}
            <div style={{ marginTop: 48 }}>
              <p
                style={{
                  fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: '#8a8070',
                  textShadow: '0 0 20px rgba(244, 243, 240, 0.9)',
                }}
              >
                &ldquo;The maze learned from the mouse.&rdquo;
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  color: '#b0a890',
                  marginTop: 6,
                  textShadow: '0 0 20px rgba(244, 243, 240, 0.9)',
                }}
              >
                C. E. SHANNON, 1952
              </p>
            </div>

            {/* Scroll indicator */}
            <div
              style={{
                marginTop: 60,
                opacity: 0.4,
                animation: reducedMotion ? 'none' : 'maze-scroll-pulse 2s ease-in-out infinite',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 4L10 16M10 16L5 11M10 16L15 11" stroke="#6B6560" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </div>

        {/* ─── 2. THE VISION (MODE: EDITORIAL) ─── */}
        <ContentSection id="vision" ref={(el) => registerSection('vision', el)}>
          <div style={{ position: 'relative' }}>
            <Kicker color="#8a8070">The Vision</Kicker>
            <p style={proseStyle}>
              Your reading lives in one app. Your notes in another. Your bookmarks in a third. Your research database ignores your highlights. Your note-taking tool has never seen your source documents. Each tool is a silo, and the connections in your mind remain invisible to your software.
            </p>
            <p style={proseStyle}>
              Every app promises to be the one place for everything. None delivers, because the problem is not which app you choose. The problem is that your tools remain strangers to each other.
            </p>

            <div style={{ position: 'relative' }}>
              <MarginNote label="The Premise" color="#2D5F6B">
                When a source, a note, and a hunch mention the same entity, that is a connection. When two claims contradict each other, that is a tension. When a cluster of evidence stands isolated from its neighbors, that is a gap. These patterns already exist in your knowledge. No tool makes them visible.
              </MarginNote>
            </div>

            <Pullquote>
              Your tools should be aware of each other. The connections between what you know should be as navigable as the knowledge itself.
            </Pullquote>
          </div>
        </ContentSection>

        {/* ─── 3. INTERSTITIAL 1 (MODE: OPEN) ─── */}
        <Interstitial
          id="interstitial-1"
          ref={(el) => registerSection('interstitial-1', el)}
          text="The system has three layers."
        />

        {/* ─── 4. THESEUS LAYER (MODE: SPLIT-R, content right) ─── */}
        <SplitSection
          id="theseus-layer"
          ref={(el) => registerSection('theseus-layer', el)}
          contentSide="right"
        >
          <Kicker color="#C4503C">Architecture</Kicker>
          <h2 style={{ ...h2Style, color: '#C4503C' }}>
            Theseus: The Intelligence Engine
          </h2>
          <p style={proseStyle}>
            Theseus is a seven-pass connection engine. It runs everything you capture through named entity recognition, lexical scoring, semantic embedding, stance detection, structural analysis, community detection, and causal inference. Each pass finds a different kind of relationship. Results merge by signal strength.
          </p>
          <p style={proseStyle}>
            The engine generates no text. It finds structure in what you already know: contradictions between claims, gaps where evidence is thin, the influence of one idea on another over time.
          </p>
          <p style={proseStyle}>
            Theseus exposes a REST API and can power any interface. CommonPlace is its first adapter, but the engine stands alone.
          </p>
          <div style={{ position: 'relative' }}>
            <MarginNote label="The Engine Learns" color="#C4503C">
              Each time you confirm or dismiss a connection, Theseus learns. Feedback trains the scoring model. Within weeks, the engine reflects your judgment, not just its algorithms.
            </MarginNote>
          </div>
        </SplitSection>

        {/* ─── 5. INDEX-API (MODE: EDITORIAL, brief) ─── */}
        <ContentSection id="index-api" ref={(el) => registerSection('index-api', el)}>
          <Kicker color="#6B4F7A">The Bridge</Kicker>
          <h2 style={h2Style}>Index-API: The Connection Layer</h2>
          <p style={proseStyle}>
            Between your sources and the engine sits Index-API: the ingestion and retrieval layer. PDF parsing, web scraping, OCR, RSS feeds, structured imports. Every source enters through here.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {CONNECTORS.map((c) => (
              <span
                key={c}
                style={{
                  fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
                  fontSize: 10,
                  padding: '4px 10px',
                  border: '1px solid rgba(107, 79, 122, 0.3)',
                  borderRadius: 4,
                  color: '#6B4F7A',
                  background: 'rgba(107, 79, 122, 0.05)',
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </ContentSection>

        {/* ─── 6. COMMONPLACE LAYER (MODE: SPLIT-L, content left) ─── */}
        <SplitSection
          id="commonplace-layer"
          ref={(el) => registerSection('commonplace-layer', el)}
          contentSide="left"
        >
          <Kicker color="#2D5F6B">The Interface</Kicker>
          <h2 style={{ ...h2Style, color: '#2D5F6B' }}>
            CommonPlace: Where Knowledge Converges
          </h2>
          <p style={proseStyle}>
            CommonPlace is a split-pane knowledge workspace built for navigating structured knowledge: objects, connections, timelines, tensions, and gaps.
          </p>
          <p style={proseStyle}>
            The workspace shows you what Theseus finds. A source connects to a concept. A hunch contradicts a claim. A cluster of evidence stands isolated from its neighbors. These are not search results; they are the structure of what you know, made visible.
          </p>
          <p style={proseStyle}>
            CommonPlace can display knowledge from other engines. Theseus can power other interfaces. Together, they prove that knowledge tools can understand each other.
          </p>
          <div style={{ position: 'relative' }}>
            <MarginNote label="Keep What You Use" color="#2D5F6B">
              Every object in CommonPlace is immutable. Edits create new nodes linked to the original. The system remembers what you knew and when you knew it.
            </MarginNote>
          </div>
        </SplitSection>

        {/* ─── 7. INTERSTITIAL 2 (MODE: OPEN) ─── */}
        <Interstitial
          id="interstitial-2"
          ref={(el) => registerSection('interstitial-2', el)}
          text="Then Theseus runs."
        />

        {/* ─── 8. HOW IT WORKS (MODE: EDITORIAL) ─── */}
        <ContentSection id="scenario" ref={(el) => registerSection('scenario', el)}>
          <Kicker color="#C4503C">How It Works</Kicker>
          <h2 style={h2Style}>A scenario</h2>
          <p style={proseStyle}>
            You are launching a product. You have six months of user interviews, three competitive analyses, a Slack channel of internal debates, two academic papers your lead researcher flagged, and forty pages of field notes from site visits.
          </p>
          <p style={proseStyle}>
            You paste the interviews into CommonPlace. You drag the PDFs. You forward the Slack thread. Index-API ingests everything: parsing, chunking, extracting entities, fingerprinting for deduplication.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2.2vw, 24px)',
              fontWeight: 400,
              color: '#2A2420',
              textAlign: 'center',
              margin: '40px 0',
              lineHeight: 1.5,
            }}
          >
            Then Theseus runs.
          </p>
          <p style={proseStyle}>
            NER extracts 340 entities. BM25 finds lexical overlap between the academic papers and your field notes. SBERT discovers that interview subject #12 described the same pain point as the competitive analysis, in entirely different words. NLI flags a contradiction: your lead researcher&apos;s favorite paper contradicts three user interviews. The causal DAG reveals that one early Slack message seeded an assumption that propagated through six later documents.
          </p>

          {/* Terminal block */}
          <div
            style={{
              background: 'rgba(26, 28, 34, 0.92)',
              padding: '20px 24px',
              borderRadius: 6,
              marginTop: 32,
              fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
              fontSize: 12,
              lineHeight: 1.8,
              color: '#9A9488',
            }}
          >
            <span style={{ color: '#C4503C' }}>340</span> entities &middot;{' '}
            <span style={{ color: '#2D5F6B' }}>1,247</span> edges &middot;{' '}
            <span style={{ color: '#C49A4A' }}>12</span> tensions &middot;{' '}
            <span style={{ color: '#6B4F7A' }}>3</span> structural gaps
            <br />
            <span style={{ color: '#6A7080', fontStyle: 'italic' }}>
              The intelligence is in the structure.
            </span>
          </div>
        </ContentSection>

        {/* ─── 9. FEEDBACK LOOP (MODE: EDITORIAL) ─── */}
        <ContentSection id="feedback" ref={(el) => registerSection('feedback', el)}>
          <div style={{ position: 'relative' }}>
            <Kicker color="#C49A4A">The Feedback Loop</Kicker>
            <h2 style={h2Style}>The maze learns from the mouse.</h2>
            <p style={proseStyle}>
              Theseus learns from how you use it. Every time you confirm a connection, dismiss a suggestion, or explore a cluster, the engine updates its scoring model. Signals that matter to you grow stronger. Noise fades.
            </p>

            <MarginNote label="Shannon's Principle" color="#C49A4A">
              In 1952, Shannon built a mechanical mouse that solved a maze by trial and error. On the second run, the mouse solved it immediately: the maze had encoded the solution in its relay switches. The intelligence was in the walls.
            </MarginNote>

            <Pullquote>
              Within days of regular use, the engine reflects your judgment as much as its algorithms. It remembers what you have already thought, and shows you what follows.
            </Pullquote>
          </div>
        </ContentSection>

        {/* ─── 10. INTERSTITIAL 3 (MODE: OPEN) ─── */}
        <Interstitial
          id="interstitial-3"
          ref={(el) => registerSection('interstitial-3', el)}
          text="Seven passes. Each signal is independent."
        />

        {/* ─── 11. PIPELINE (MODE: TECHNICAL) ─── */}
        <TechnicalSection id="pipeline" ref={(el) => registerSection('pipeline', el)}>
          <Kicker color="#C4503C" dark>Under the Hood</Kicker>
          <h2 style={{ ...h2Style, color: '#D8D6DC' }}>The Seven-Pass Pipeline</h2>
          <p style={{ ...proseStyle, color: '#9A9488' }}>
            Each pass runs independently. Results merge by maximum score. No single signal controls the output. The engine is an ensemble, not a pipeline.
          </p>
          {PASSES.map((pass, i) => (
            <PipelinePass
              key={pass.num}
              num={pass.num}
              name={pass.name}
              tech={pass.tech}
              description={pass.desc}
              isVisible={pipelineVisible}
              delay={i * 600}
            />
          ))}
        </TechnicalSection>

        {/* ─── 12. ROADMAP (MODE: TECHNICAL) ─── */}
        <TechnicalSection id="roadmap" ref={(el) => registerSection('roadmap', el)}>
          <Kicker color="#6B4F7A" dark>The Roadmap</Kicker>
          <h2 style={{ ...h2Style, color: '#D8D6DC' }}>Eight Levels of Intelligence</h2>
          <p style={{ ...proseStyle, color: '#9A9488' }}>
            The engine improves along a defined trajectory: from pre-trained inference through learned scoring to emergent ontology and creative hypothesis.
          </p>
          {LEVELS.map((lv) => (
            <LevelRow
              key={lv.level}
              level={lv.level}
              name={lv.name}
              description={lv.desc}
              status={lv.status}
            />
          ))}
          <p
            style={{
              fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
              fontStyle: 'italic',
              fontSize: 15,
              color: '#9A9488',
              marginTop: 32,
              textAlign: 'center',
            }}
          >
            It proposes what should be known next.
          </p>
        </TechnicalSection>

        {/* ─── 13. CLOSING (MODE: FLOATING) ─── */}
        <div
          ref={(el) => registerSection('close', el)}
          id="close"
          style={{
            position: 'relative',
            zIndex: 1,
            minHeight: '100vh',
            padding: '80px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 48,
          }}
        >
          <FloatingAnnotation
            style={{ position: 'relative', textAlign: 'center' }}
          >
            <p
              style={{
                fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
                fontStyle: 'italic',
                fontSize: 15,
                fontWeight: 400,
                lineHeight: 1.7,
                color: '#2A2420',
              }}
            >
              In 1952, Claude Shannon built a mechanical mouse that could solve a maze and remember the solution. The mouse navigated by trial and error. On the second run, it solved the maze immediately. Not because the mouse was smarter. Because the maze had changed.
            </p>
          </FloatingAnnotation>

          <FloatingAnnotation
            style={{ position: 'relative', textAlign: 'center' }}
          >
            <p
              style={{
                fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
                fontWeight: 600,
                fontSize: 'clamp(18px, 2.5vw, 26px)',
                lineHeight: 1.4,
                color: '#2A2420',
              }}
            >
              The intelligence was not in the mouse. It was in the walls.
            </p>
          </FloatingAnnotation>

          <FloatingAnnotation
            style={{ position: 'relative', textAlign: 'center' }}
          >
            <p
              style={{
                fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
                fontSize: 'clamp(11px, 1.4vw, 14px)',
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: '#2A2420',
                lineHeight: 1.8,
              }}
            >
              THE ARCHITECTURE IS THE MAZE.
              <br />
              THE ENGINE IS THE MOUSE.
            </p>
          </FloatingAnnotation>

          {/* Product links */}
          <div
            style={{
              display: 'flex',
              gap: 32,
              marginTop: 24,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <a
              href="/projects/theseus"
              style={{
                fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                padding: '10px 20px',
                border: '1px solid #C4503C',
                borderRadius: 6,
                color: '#C4503C',
                textDecoration: 'none',
                textShadow: '0 0 20px rgba(244, 243, 240, 0.9)',
                background: 'rgba(244, 243, 240, 0.6)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                transition: 'background 0.25s, color 0.25s',
              }}
            >
              Learn more about Theseus
            </a>
            <a
              href="/projects/commonplace"
              style={{
                fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                padding: '10px 20px',
                border: '1px solid #2D5F6B',
                borderRadius: 6,
                color: '#2D5F6B',
                textDecoration: 'none',
                textShadow: '0 0 20px rgba(244, 243, 240, 0.9)',
                background: 'rgba(244, 243, 240, 0.6)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                transition: 'background 0.25s, color 0.25s',
              }}
            >
              Learn more about CommonPlace
            </a>
          </div>
        </div>

        {/* ─── 14. FOOTER PATENT LINE ─── */}
        <footer
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            padding: '40px 24px 60px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.14em',
              color: '#b0a890',
              textShadow: '0 0 20px rgba(244, 243, 240, 0.9)',
            }}
          >
            THESEUS x COMMONPLACE &nbsp;|&nbsp; GILBERT, T. &nbsp;|&nbsp; 2026
          </p>
        </footer>
      </div>

    </>
  );
}

// ── Shared sub-components ──

function Kicker({ color, dark, children }: { color: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase' as const,
        color: dark ? color : '#8a8070',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function Pullquote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      style={{
        fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
        fontStyle: 'italic',
        fontSize: 'clamp(16px, 1.8vw, 20px)',
        fontWeight: 400,
        lineHeight: 1.6,
        color: '#2A2420',
        borderLeft: '3px solid #C49A4A',
        paddingLeft: 20,
        margin: '32px 0',
      }}
    >
      {children}
    </blockquote>
  );
}

// Shared prose style
const proseStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body, "IBM Plex Sans", sans-serif)',
  fontSize: 15,
  fontWeight: 300,
  lineHeight: 1.7,
  color: '#6B6560',
  marginBottom: 20,
};

const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
  fontSize: 'clamp(22px, 3.2vw, 32px)',
  fontWeight: 700,
  lineHeight: 1.25,
  color: '#2A2420',
  marginBottom: 14,
};
