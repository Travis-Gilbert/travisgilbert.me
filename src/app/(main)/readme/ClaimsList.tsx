'use client';

import SchematicMini from './SchematicMini';
import type { ClaimData } from './readme-data';

interface ClaimsListProps {
  claims: ClaimData[];
}

export default function ClaimsList({ claims }: ClaimsListProps) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {claims.map((claim) => (
        <li
          key={claim.number}
          className="readme-claim-item"
          style={{
            padding: '24px 0',
            borderBottom: '1px solid var(--color-patent-border)',
            display: 'grid',
            gridTemplateColumns: '36px 1fr 180px',
            gap: '14px',
            alignItems: 'start',
          }}
        >
          {/* Claim number */}
          <span
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-terracotta)',
              paddingTop: '2px',
            }}
          >
            {claim.number}.
          </span>

          {/* Claim body */}
          <div>
            {claim.url ? (
              <a
                href={claim.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-patent-text)',
                  textDecoration: 'none',
                  display: 'block',
                  marginBottom: '5px',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = 'var(--color-terracotta)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = 'var(--color-patent-text)')
                }
              >
                {claim.title}
              </a>
            ) : (
              <h4
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-patent-text)',
                  marginBottom: '5px',
                }}
              >
                {claim.title}
              </h4>
            )}
            <p
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: '11.5px',
                lineHeight: 1.75,
                color: 'var(--color-patent-text-secondary)',
                marginBottom: '8px',
                maxWidth: '440px',
              }}
            >
              {claim.description}
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap' as const,
                gap: '4px',
              }}
            >
              {claim.stack.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontFamily: 'var(--font-code)',
                    fontSize: '9.5px',
                    padding: '2px 7px',
                    borderRadius: '3px',
                    background: 'rgba(42,36,32,0.04)',
                    color: 'var(--color-patent-text-tertiary)',
                    border: '1px solid var(--color-patent-border)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Mini schematic (hidden below 800px via CSS class) */}
          <div className="readme-claim-schematic">
            <SchematicMini data={claim.schematic} />
          </div>
        </li>
      ))}
    </ol>
  );
}
