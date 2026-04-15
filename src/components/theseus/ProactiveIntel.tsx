'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAmbientGraphSignal } from '@/lib/theseus-ambient';

type CardType = 'hypothesis' | 'tension' | 'gap';

interface IntelCard {
  type: CardType;
  label: string;
  title: string;
  subtitle?: string;
  claimA?: string;
  claimB?: string;
  confidence?: number;
  query: string;
}

const ACCENT: Record<CardType, string> = {
  hypothesis: 'var(--vie-amber)',
  tension: 'var(--vie-terra)',
  gap: 'var(--vie-teal)',
};

export function ProactiveIntel() {
  const router = useRouter();
  const { weather, hypotheses, loaded } = useAmbientGraphSignal();
  const [visible, setVisible] = useState(false);

  const cards = useMemo<IntelCard[]>(() => {
    const items: IntelCard[] = [];

    for (const h of hypotheses.slice(0, 2)) {
      items.push({
        type: 'hypothesis',
        label: 'hypothesis',
        title: h.title,
        confidence: h.confidence,
        query: h.title,
      });
    }

    if (weather && weather.health_score < 0.7 && weather.total_clusters > 1) {
      items.push({
        type: 'gap',
        label: 'structural gap',
        title: `${weather.total_clusters} clusters with weak bridging connections`,
        query: 'What structural gaps exist in my knowledge?',
      });
    }

    return items.slice(0, 3);
  }, [hypotheses, weather]);

  useEffect(() => {
    if (!loaded || cards.length === 0) return;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [loaded, cards.length]);

  if (cards.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '500px',
        gap: '12px',
      }}
    >
      {cards.map((card, i) => (
        <button
          key={`${card.type}-${i}`}
          onClick={() =>
            router.push(`/theseus/ask?q=${encodeURIComponent(card.query)}`)
          }
          style={{
            display: 'block',
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderLeft: `2px solid ${ACCENT[card.type]}`,
            padding: '12px 16px',
            textAlign: 'left',
            cursor: 'pointer',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity 0.4s ease ${i * 200}ms, transform 0.4s ease ${i * 200}ms`,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--vie-font-mono)',
              fontSize: '10px',
              color: ACCENT[card.type],
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {card.label}
          </span>

          <p
            style={{
              fontFamily: 'var(--vie-font-body)',
              fontSize: '14px',
              color: 'var(--vie-text)',
              margin: '4px 0 0',
              lineHeight: 1.4,
            }}
          >
            {card.title}
          </p>

          {card.type === 'hypothesis' && card.confidence !== undefined && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '6px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '3px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round(card.confidence * 100)}%`,
                    height: '100%',
                    background: ACCENT.hypothesis,
                    borderRadius: '2px',
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: '11px',
                  color: 'var(--vie-text-dim)',
                }}
              >
                {(card.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {card.type === 'tension' && card.claimA && card.claimB && (
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginTop: '6px',
                fontFamily: 'var(--vie-font-body)',
                fontSize: '12px',
                color: 'var(--vie-text-muted)',
              }}
            >
              <span style={{ flex: 1 }}>{card.claimA}</span>
              <span style={{ flex: 1 }}>{card.claimB}</span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
