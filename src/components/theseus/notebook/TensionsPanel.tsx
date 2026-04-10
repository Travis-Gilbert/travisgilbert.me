'use client';

import { useEffect, useState, useRef } from 'react';
import { askTheseus } from '@/lib/theseus-api';

interface DetectedTension {
  noteText: string;
  graphClaim: string;
  severity: number;
}

interface TensionsPanelProps {
  documentContent: string;
}

function severityColor(severity: number): string {
  if (severity < 0.3) return 'var(--vie-teal-light, #4A8A96)';
  if (severity < 0.6) return '#C49A4A';
  return '#C4503C';
}

/**
 * TensionsPanel: shows conflicts between the note's content
 * and existing graph knowledge.
 *
 * Updated reactively with 500ms debounce as the user types.
 * Each tension shows the user's text vs the graph's claim.
 */
export default function TensionsPanel({ documentContent }: TensionsPanelProps) {
  const [tensions, setTensions] = useState<DetectedTension[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const parser = new DOMParser();
    const doc = parser.parseFromString(documentContent, 'text/html');
    const text = doc.body.textContent?.trim() ?? '';
    if (text.length < 20) {
      setTensions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await askTheseus(`Tensions with: ${text.slice(0, 200)}`);
        if (result.ok) {
          const tensionSection = result.sections.find((s) => s.type === 'tension');
          if (tensionSection && 'items' in tensionSection && Array.isArray((tensionSection as Record<string, unknown>).items)) {
            setTensions(
              ((tensionSection as Record<string, unknown>).items as Array<{ note_text?: string; graph_claim?: string; severity?: number }>).map((t) => ({
                noteText: t.note_text ?? '',
                graphClaim: t.graph_claim ?? '',
                severity: t.severity ?? 0.5,
              })),
            );
          } else {
            setTensions([]);
          }
        }
      } catch {
        // API not available
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [documentContent]);

  if (loading) {
    return <p className="notebook-tab-loading">CHECKING TENSIONS</p>;
  }

  if (tensions.length === 0) {
    return (
      <div className="notebook-tab-empty">
        <p className="notebook-tab-desc">
          No tensions detected between your note and the knowledge graph.
        </p>
      </div>
    );
  }

  return (
    <div className="notebook-tensions-list">
      {tensions.map((tension, i) => (
        <div key={i} className="notebook-tension-card">
          <div className="notebook-tension-texts">
            <p className="notebook-tension-note">{tension.noteText}</p>
            <div className="notebook-tension-divider" />
            <p className="notebook-tension-graph">{tension.graphClaim}</p>
          </div>
          <div className="notebook-tension-severity" style={{ color: severityColor(tension.severity) }}>
            {(tension.severity * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}
