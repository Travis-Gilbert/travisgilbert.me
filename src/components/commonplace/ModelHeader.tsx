'use client';

import type { EpistemicModelDetail } from '@/lib/commonplace-models';
import {
  ASSUMPTION_STATUS_META,
  MODEL_TYPE_META,
} from '@/lib/commonplace-models';

interface ModelHeaderProps {
  model: EpistemicModelDetail;
}

function CBar({
  value,
  color,
}: {
  value: number;
  color: string;
}): React.ReactElement {
  const pct = Math.round(value * 100);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <span
        style={{
          width: 36,
          height: 3,
          borderRadius: 2,
          background: 'var(--cp-border-faint, #ECEAE6)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 2,
            transition: 'width 0.2s ease',
          }}
        />
      </span>
      <span
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 8,
          color: 'var(--cp-text-faint, #68666E)',
          letterSpacing: '0.02em',
        }}
      >
        {pct}%
      </span>
    </span>
  );
}

export default function ModelHeader({ model }: ModelHeaderProps): React.ReactElement {
  const typeMeta = MODEL_TYPE_META[model.modelType];
  const statusKey = (model.modelStatus ?? 'proposed') as keyof typeof ASSUMPTION_STATUS_META;
  const statusMeta = ASSUMPTION_STATUS_META[statusKey] ?? ASSUMPTION_STATUS_META.proposed;
  const confidence = model.modelConfidence ?? 0;

  const totalSupports = model.assumptions.reduce(
    (sum, a) => sum + a.evidence.filter((e) => e.relation === 'supports').length,
    0,
  );
  const totalContradicts = model.assumptions.reduce(
    (sum, a) => sum + a.evidence.filter((e) => e.relation === 'contradicts').length,
    0,
  );

  return (
    <div style={{ padding: '0 20px 10px' }}>
      {/* Gradient top bar */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(to right, ${typeMeta.color}66, ${typeMeta.color}CC, #B8623D4D)`,
          marginLeft: -20,
          marginRight: -20,
          marginBottom: 10,
        }}
      />

      {/* Row 1: type badge, description, status, confidence */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          flexWrap: 'wrap',
        }}
      >
        {/* Type pill */}
        <span
          style={{
            display: 'inline-block',
            padding: '1px 7px',
            borderRadius: 9,
            border: `1px solid ${typeMeta.color}40`,
            background: `${typeMeta.color}12`,
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: typeMeta.color,
            lineHeight: '16px',
          }}
        >
          {typeMeta.label}
        </span>

        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8,
            color: 'var(--cp-text-faint, #68666E)',
            letterSpacing: '0.02em',
          }}
        >
          {typeMeta.description}
        </span>

        <span style={{ flex: 1 }} />

        {/* Status label */}
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: statusMeta.color,
          }}
        >
          {statusMeta.label}
        </span>

        <CBar value={confidence} color={statusMeta.color} />
      </div>

      {/* Title */}
      <h2
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--cp-text, #18181B)',
          margin: '0 0 6px',
          lineHeight: 1.3,
        }}
      >
        {model.title}
      </h2>

      {/* Row 3: scope, stats, domain tags */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: model.question ? 6 : 0,
          flexWrap: 'wrap',
        }}
      >
        {model.scope && (
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 8,
              color: 'var(--cp-text-faint, #68666E)',
              letterSpacing: '0.02em',
            }}
          >
            {model.scope}
          </span>
        )}

        {/* Stats */}
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 8,
            color: 'var(--cp-text-faint, #68666E)',
            letterSpacing: '0.02em',
          }}
        >
          <strong style={{ color: 'var(--cp-text-muted, #48464E)' }}>
            {model.assumptionCount}
          </strong>
          A
        </span>

        {totalSupports > 0 && (
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 8,
              color: '#1A7A8A',
              letterSpacing: '0.02em',
            }}
          >
            {totalSupports} supports
          </span>
        )}

        {totalContradicts > 0 && (
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 8,
              color: '#B8623D',
              letterSpacing: '0.02em',
            }}
          >
            {totalContradicts} contradicts
          </span>
        )}

        {/* Domain tags */}
        {model.domains && model.domains.length > 0 && (
          <>
            {model.domains.map((domain) => (
              <span
                key={domain}
                style={{
                  display: 'inline-block',
                  padding: '0 5px',
                  borderRadius: 3,
                  border: '1px solid var(--cp-border-faint, #ECEAE6)',
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 7,
                  color: 'var(--cp-text-faint, #68666E)',
                  letterSpacing: '0.02em',
                  lineHeight: '14px',
                }}
              >
                {domain}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Row 4: Question pill */}
      {model.question && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            borderRadius: 3,
            background: '#B8623D0D',
            border: '1px solid #B8623D20',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 8,
              fontWeight: 700,
              color: '#B8623D',
              letterSpacing: '0.04em',
            }}
          >
            Q
          </span>
          <span
            style={{
              fontFamily: 'var(--cp-font-body)',
              fontSize: 10,
              color: 'var(--cp-text-muted, #48464E)',
              lineHeight: 1.4,
            }}
          >
            {model.question}
          </span>
        </div>
      )}
    </div>
  );
}
