'use client';

import { useState, useCallback } from 'react';
import { auditClaims, type ClaimAuditResult } from '@/lib/studio-api';

export default function ClaimAuditPanel({
  getEditorText,
  contentType,
  slug,
  sourceSlugs,
}: {
  getEditorText: () => string;
  contentType: string;
  slug: string;
  sourceSlugs: string[];
}) {
  const [result, setResult] = useState<ClaimAuditResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runAudit = useCallback(async () => {
    const text = getEditorText();
    if (text.length < 50) return;
    setLoading(true);
    try {
      const data = await auditClaims(text, sourceSlugs);
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [getEditorText, sourceSlugs]);

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--studio-text-3)',
        }}>
          Claim Audit
        </span>
        <button
          onClick={runAudit}
          disabled={loading}
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            padding: '2px 8px',
            borderRadius: '3px',
            border: '1px solid var(--studio-border)',
            backgroundColor: 'transparent',
            color: 'var(--studio-text-2)',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Auditing...' : 'Run Audit'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: '8px' }}>
          {/* Summary bar */}
          <div style={{
            display: 'flex',
            gap: '12px',
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '10px',
            color: 'var(--studio-text-2)',
            marginBottom: '8px',
          }}>
            <span>{result.summary.total} claims</span>
            <span style={{ color: '#5A7A4A' }}>
              {result.summary.supported} supported
            </span>
            <span style={{ color: 'var(--studio-tc)' }}>
              {result.summary.unsupported} unsupported
            </span>
          </div>

          {/* Claim list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {result.claims.map((claim, i) => (
              <div
                key={i}
                style={{
                  padding: '4px 8px',
                  borderLeft: `2px solid ${claim.supported ? '#5A7A4A' : 'var(--studio-tc)'}`,
                  borderRadius: '2px',
                  backgroundColor: claim.supported
                    ? 'color-mix(in srgb, #5A7A4A 6%, transparent)'
                    : 'color-mix(in srgb, var(--studio-tc) 6%, transparent)',
                }}
              >
                <div style={{
                  fontFamily: 'var(--studio-font-body)',
                  fontSize: '11px',
                  color: 'var(--studio-text)',
                  lineHeight: 1.4,
                }}>
                  {claim.text}
                </div>
                {claim.supported && claim.supportingSource && (
                  <div style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '9px',
                    color: 'var(--studio-text-3)',
                    marginTop: '2px',
                  }}>
                    Supported by: {claim.supportingSource}
                    {claim.confidence != null && ` (${Math.round(claim.confidence * 100)}%)`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
