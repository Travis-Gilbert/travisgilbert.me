import type { Metadata } from 'next';
import ReadmeHeader from './ReadmeHeader';
import ReadmeSection from './ReadmeSection';
import PatentSection, { PatentLabel } from './PatentSection';
import MarginSchematic from './MarginSchematic';
import ClaimsList from './ClaimsList';
import PriorArtGrid from './PriorArtGrid';
import LimitationsGrid from './LimitationsGrid';
import InstallBlock from './InstallBlock';
import {
  ABSTRACT_PARAGRAPHS,
  DESCRIPTION_PARAGRAPHS,
  HOW_I_THINK_PARAGRAPHS,
  LOOKING_FOR_PARAGRAPHS,
  SHOWCASE_SCHEMATICS,
  CLAIMS,
  PRIOR_ART,
  LIMITATIONS,
} from './readme-data';

export const metadata: Metadata = {
  title: 'README.md | Travis Gilbert',
  description:
    'Writer, researcher, self-taught developer. I build tools that think about information and I make videos about whatever makes me curious.',
  openGraph: {
    title: 'Travis Gilbert / README.md',
    description: 'Writer, researcher, self-taught developer.',
  },
};

export default function ReadmePage() {
  return (
    <div
      className="readme-page"
      style={{
        background: 'var(--color-readme-bg)',
        /* Break out of main's max-w-4xl + padding constraints */
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        marginTop: '-32px',
        marginBottom: '-32px',
        paddingLeft: 'max(24px, calc(50vw - 380px))',
        paddingRight: 'max(24px, calc(50vw - 380px))',
        paddingBottom: '48px',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <ReadmeHeader />

      {/* Abstract (patent) with Theseus schematic in right margin */}
      <PatentSection schematicData={SHOWCASE_SCHEMATICS[0]}>
        <PatentLabel>United States Patent Application, 2026/0322</PatentLabel>
        <h2
          style={{
            fontFamily: 'var(--font-code)',
            fontSize: '16px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.04em',
            marginBottom: '18px',
          }}
        >
          Abstract
        </h2>
        {ABSTRACT_PARAGRAPHS.map((text, i) => (
          <p
            key={i}
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: '13px',
              lineHeight: 1.8,
              marginBottom: '14px',
              maxWidth: '600px',
            }}
          >
            {text}
          </p>
        ))}
      </PatentSection>

      {/* Description (readme) with Index-API schematic in right margin */}
      <ReadmeSection schematicData={SHOWCASE_SCHEMATICS[1]}>
        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '25px',
            fontWeight: 700,
            marginBottom: '18px',
          }}
        >
          Description
        </h2>
        {DESCRIPTION_PARAGRAPHS.map((para, i) => (
          <p
            key={i}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15.5px',
              marginBottom: '14px',
              maxWidth: '580px',
              lineHeight: 1.7,
              color: para.muted
                ? 'var(--color-readme-text-muted)'
                : undefined,
            }}
          >
            {para.text}
          </p>
        ))}
      </ReadmeSection>

      {/* How I Think (readme) with CommonPlace schematic in right margin */}
      <ReadmeSection schematicData={SHOWCASE_SCHEMATICS[2]}>
        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '25px',
            fontWeight: 700,
            marginBottom: '18px',
          }}
        >
          How I Think
        </h2>
        {HOW_I_THINK_PARAGRAPHS.map((para, i) => (
          <p
            key={i}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15.5px',
              marginBottom: '14px',
              maxWidth: '580px',
              lineHeight: 1.7,
              color: para.muted
                ? 'var(--color-readme-text-muted)'
                : undefined,
            }}
          >
            {para.text}
          </p>
        ))}
      </ReadmeSection>

      {/* Claims (patent) with Compliance schematic in right margin */}
      <PatentSection schematicData={SHOWCASE_SCHEMATICS[3]}>
        <PatentLabel>Claims</PatentLabel>
        <h2
          style={{
            fontFamily: 'var(--font-code)',
            fontSize: '16px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.04em',
            marginBottom: '18px',
          }}
        >
          What is Claimed is:
        </h2>
        <ClaimsList claims={CLAIMS} />
      </PatentSection>

      {/* Prior Art (patent) with Codex Plugins schematic in right margin */}
      <PatentSection schematicData={SHOWCASE_SCHEMATICS[4]}>
        <PatentLabel>Prior Art</PatentLabel>
        <PriorArtGrid items={PRIOR_ART} />
      </PatentSection>

      {/* Known Limitations (readme) */}
      <ReadmeSection>
        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '25px',
            fontWeight: 700,
            marginBottom: '18px',
          }}
        >
          Known Limitations
        </h2>
        <LimitationsGrid items={LIMITATIONS} />
      </ReadmeSection>

      {/* What I'm Looking For (readme) */}
      <ReadmeSection>
        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '25px',
            fontWeight: 700,
            marginBottom: '18px',
          }}
        >
          What I&apos;m Looking For
        </h2>
        {LOOKING_FOR_PARAGRAPHS.map((para, i) => (
          <p
            key={i}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '15.5px',
              marginBottom: '14px',
              maxWidth: '580px',
              lineHeight: 1.7,
              color: para.muted
                ? 'var(--color-readme-text-muted)'
                : undefined,
            }}
          >
            {para.text}
          </p>
        ))}
      </ReadmeSection>

      {/* Installation (readme) */}
      <ReadmeSection noBorder>
        <h2
          style={{
            fontFamily: 'var(--font-title)',
            fontSize: '25px',
            fontWeight: 700,
            marginBottom: '18px',
          }}
        >
          Installation
        </h2>
        <InstallBlock />
      </ReadmeSection>
    </div>
  );
}
