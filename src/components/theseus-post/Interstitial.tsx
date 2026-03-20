'use client';

// Interstitial.tsx: MODE: OPEN breathing sections between editorial content.
// The maze is the content. A single floating phrase with paper-glow text-shadow.
// 40-60vh of scroll height, centered text, no backdrop.

import { forwardRef } from 'react';

interface InterstitialProps {
  id: string;
  text: string;
}

const Interstitial = forwardRef<HTMLDivElement, InterstitialProps>(
  function Interstitial({ id, text }, ref) {
    return (
      <div
        ref={ref}
        id={id}
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          padding: '80px 24px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
            fontStyle: 'italic',
            fontSize: 'clamp(20px, 2.8vw, 28px)',
            fontWeight: 400,
            color: '#2A2420',
            textAlign: 'center',
            maxWidth: 600,
            lineHeight: 1.5,
            textShadow: '0 0 40px rgba(244, 243, 240, 0.95), 0 0 80px rgba(244, 243, 240, 0.8)',
            fontFeatureSettings: "'kern' 1, 'liga' 1, 'calt' 1",
          }}
        >
          {text}
        </p>
      </div>
    );
  },
);

export default Interstitial;
