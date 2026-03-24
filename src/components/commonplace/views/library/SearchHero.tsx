'use client';

import { useState } from 'react';
import InquiryBar from '../../capture/InquiryBar';

interface SearchHeroProps {
  onOpenObject?: (objectRef: number) => void;
  inquiryQuery?: string;
  onQueryConsumed?: () => void;
}

export default function SearchHero({
  onOpenObject,
  inquiryQuery,
  onQueryConsumed,
}: SearchHeroProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      style={{ position: 'relative', marginBottom: 32 }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      {/* Warm ambient glow behind search */}
      <div
        style={{
          position: 'absolute',
          inset: '-20px -40px',
          background:
            'radial-gradient(ellipse at center, rgba(180,90,45,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        className="cp-search-hero-wrap"
        data-focused={focused || undefined}
      >
        <InquiryBar
          gapCount={0}
          onOpenObject={onOpenObject}
          externalQuery={inquiryQuery}
          onExternalQueryConsumed={onQueryConsumed}
        />
      </div>
    </div>
  );
}
