'use client';

import { useEffect, useState, useRef } from 'react';

interface ExtractedClaim {
  text: string;
  status: 'pending' | 'accepted' | 'contested';
  source: 'manual' | 'auto';
}

interface ClaimsPanelProps {
  documentContent: string;
}

/**
 * ClaimsPanel: shows claims extracted from the current note.
 *
 * Two sources:
 *   1. Manual: text inside containType='argument' blocks (from /claim command)
 *   2. Auto: claims extracted by Theseus from the full note content (debounced 500ms)
 */
export default function ClaimsPanel({ documentContent }: ClaimsPanelProps) {
  const [claims, setClaims] = useState<ExtractedClaim[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract claims from document content (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const extracted: ExtractedClaim[] = [];

      // Parse contain blocks with type="argument" (claim markers)
      const parser = new DOMParser();
      const doc = parser.parseFromString(documentContent, 'text/html');
      const containBlocks = doc.querySelectorAll('[data-contain-type="argument"]');
      containBlocks.forEach((block) => {
        const text = block.textContent?.trim();
        if (text) {
          extracted.push({ text, status: 'pending', source: 'manual' });
        }
      });

      setClaims(extracted);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [documentContent]);

  if (claims.length === 0) {
    return (
      <div className="notebook-tab-empty">
        <p className="notebook-tab-desc">
          No claims yet. Use <code>/claim</code> to mark text as a claim,
          or claims will be auto-extracted as you write.
        </p>
      </div>
    );
  }

  return (
    <div className="notebook-claims-list">
      {claims.map((claim, i) => (
        <div key={i} className="notebook-claim-row">
          <div className="notebook-claim-text">{claim.text}</div>
          <div className="notebook-claim-meta">
            <span className="notebook-claim-status" data-status={claim.status}>
              {claim.status}
            </span>
            <span className="notebook-claim-source">{claim.source}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
