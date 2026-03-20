import type { Metadata } from 'next';
import SectionLabel from '@/components/SectionLabel';
import ScrollReveal from '@/components/ScrollReveal';
import TheseusHero from './TheseusHero';
import GptComparison from './GptComparison';
import DomainCards from './DomainCards';
import BeliefTable from './BeliefTable';
import ForceTree from './ForceTree';
import EngineTerminal from './EngineTerminal';

export const metadata: Metadata = {
  title: 'Theseus: An Epistemic Engine',
  description:
    'An engine that discovers connections, contradictions, and gaps '
    + 'across a growing body of research. Built with Django, ONNX, '
    + 'pgvector, and a 7-pass ML pipeline.',
};

export default function TheseusPage() {
  return (
    <div className="theseus-page">
      {/* Hero: full-bleed 3D force tree */}
      <TheseusHero />

      {/* GPT vs Theseus comparison */}
      <ScrollReveal>
        <section className="theseus-section">
          <SectionLabel color="terracotta">A Different Kind of Intelligence</SectionLabel>
          <h2 className="font-title text-2xl md:text-[32px] font-bold leading-tight mb-3">
            Current AI gives you an answer. Theseus builds you a model.
          </h2>
          <p className="text-ink-muted text-[15px] max-w-[660px] mb-8 leading-relaxed font-light">
            A large language model retrieves from training data. Theseus reasons across
            <em> your</em> evidence: every source, every claim, every contradiction, traced
            to its origin.
          </p>
          <GptComparison />
        </section>
      </ScrollReveal>

      {/* Domain scenarios */}
      <div className="theseus-divider">
        <div className="h-px bg-border" />
      </div>

      <ScrollReveal>
        <section className="theseus-section">
          <SectionLabel color="teal">Who This Is For</SectionLabel>
          <h2 className="font-title text-2xl md:text-[32px] font-bold leading-tight mb-3">
            The same engine adapts to any domain that works with evidence.
          </h2>
          <p className="text-ink-muted text-[15px] max-w-[660px] mb-8 leading-relaxed font-light">
            Theseus does not know your field. It learns the structure of your evidence
            and discovers what you could not see by reading one source at a time.
          </p>
          <DomainCards />
        </section>
      </ScrollReveal>

      {/* Belief revision */}
      <div className="theseus-divider">
        <div className="h-px bg-border" />
      </div>

      <ScrollReveal>
        <section className="theseus-section">
          <SectionLabel color="terracotta">The Core Shift</SectionLabel>
          <h2 className="font-title text-2xl md:text-[32px] font-bold leading-tight mb-3">
            From storing information to tracking what you believe and why.
          </h2>
          <p className="text-ink-muted text-[15px] max-w-[660px] mb-8 leading-relaxed font-light">
            Traditional tools store documents. Theseus tracks claims, surfaces contradictions,
            and updates your belief model as evidence arrives.
          </p>
          <BeliefTable />
        </section>
      </ScrollReveal>

      {/* Architecture: D3 force tree */}
      <div className="theseus-divider">
        <div className="h-px bg-border" />
      </div>

      <ScrollReveal>
        <ForceTree />
      </ScrollReveal>

      {/* Engine terminal */}
      <div className="theseus-divider">
        <div className="h-px bg-border" />
      </div>

      <ScrollReveal>
        <section className="theseus-section">
          <SectionLabel color="terracotta">Under the Hood</SectionLabel>
          <h2 className="font-title text-2xl md:text-[32px] font-bold leading-tight mb-3">
            A multi-pass ML pipeline that learns from its own operation.
          </h2>
          <p className="text-ink-muted text-[15px] max-w-[660px] mb-8 leading-relaxed font-light">
            Six analysis passes chain together. Each signal is independent; the engine
            merges results by maximum score with dominant signal tracking.
          </p>
          <EngineTerminal />
        </section>
      </ScrollReveal>
    </div>
  );
}
