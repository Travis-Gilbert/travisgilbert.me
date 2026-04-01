'use client';

import Link from 'next/link';
import { ModelGrid } from '../../../components/theseus/library/ModelGrid';

export default function TheseusLibrary() {
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ padding: '40px 40px 24px' }}>
        <Link
          href="/theseus"
          style={{
            fontFamily: 'var(--vie-font-body)',
            fontSize: '13px',
            color: 'var(--vie-text-dim)',
            textDecoration: 'none',
            marginBottom: '16px',
            display: 'inline-block',
          }}
        >
          ← Back to Theseus
        </Link>
        <h1
          style={{
            fontFamily: 'var(--vie-font-title)',
            fontSize: '24px',
            fontWeight: 400,
            color: 'var(--vie-text)',
            margin: 0,
          }}
        >
          Library
        </h1>
      </div>

      <ModelGrid />
    </div>
  );
}
