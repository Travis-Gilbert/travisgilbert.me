'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';
import styles from './EngineDiscoveryFeed.module.css';

export interface EngineDiscovery {
  edge_id: number;
  from_object: { id: number; title: string; object_type_slug: string };
  to_object: { id: number; title: string; object_type_slug: string };
  engine: string;
  strength: number;
  reason: string;
  created_at: string;
}

interface EngineDiscoveryFeedProps {
  discoveries: EngineDiscovery[];
  onOpenObject?: (slug: string) => void;
}

export default function EngineDiscoveryFeed({ discoveries, onOpenObject }: EngineDiscoveryFeedProps) {
  if (discoveries.length === 0) {
    return (
      <div className={styles.convo}>
        <div className={styles.empty}>
          <span className={styles.emptyPrompt}>$</span> engine idle. No new connections since your last visit.
        </div>
      </div>
    );
  }

  const sorted = [...discoveries].sort((a, b) => b.strength - a.strength);
  const hero = sorted[0];
  const secondary = sorted.slice(1, 3);
  const compact = sorted.slice(3);

  return (
    <div className={styles.convo}>
      {/* Hero: large conversation row */}
      <HeroDiscovery discovery={hero} onOpenObject={onOpenObject} />

      {/* Secondary: alternating direction */}
      {secondary.map((d, i) => (
        <SecondaryDiscovery key={d.edge_id} discovery={d} flipped={i % 2 === 1} onOpenObject={onOpenObject} />
      ))}

      {/* Compact pair: tight inline row */}
      {compact.length > 0 && (
        <div className={styles.compactRow}>
          {compact.map((d) => (
            <CompactDiscovery key={d.edge_id} discovery={d} onOpenObject={onOpenObject} />
          ))}
        </div>
      )}
    </div>
  );
}

function HeroDiscovery({ discovery, onOpenObject }: { discovery: EngineDiscovery; onOpenObject?: (slug: string) => void }) {
  const fromType = getObjectTypeIdentity(discovery.from_object.object_type_slug);
  const toType = getObjectTypeIdentity(discovery.to_object.object_type_slug);
  const pct = Math.round(discovery.strength * 100);

  return (
    <div className={styles.convoRow}>
      {/* Primary bubble (from object) */}
      <div className={`${styles.bubble} ${styles.bubblePrimary}`} onClick={() => onOpenObject?.(String(discovery.from_object.id))} style={{ cursor: onOpenObject ? 'pointer' : undefined }}>
        <div className={styles.bubbleNames}>
          <div className={styles.dot} style={{ background: fromType.color }} />
          <div className={styles.bubbleName} style={{ color: fromType.color, fontSize: 15 }}>
            {discovery.from_object.title}
          </div>
        </div>
        <StrengthBar pct={pct} />
        <div className={styles.bubbleReason}>{discovery.reason}</div>
        <div className={styles.bubbleMeta}>
          <span className={styles.engineBadge}>{discovery.engine}</span>
        </div>
      </div>

      {/* Connector */}
      <div className={styles.connector}>
        <div className={styles.connectorLine} />
      </div>

      {/* Secondary bubble (to object) */}
      <div className={`${styles.bubble} ${styles.bubbleSecondary}`} onClick={() => onOpenObject?.(String(discovery.to_object.id))} style={{ cursor: onOpenObject ? 'pointer' : undefined }}>
        <div className={styles.bubbleNames}>
          <div className={styles.dot} style={{ background: toType.color }} />
          <div className={styles.bubbleName} style={{ color: toType.color, fontSize: 13 }}>
            {discovery.to_object.title}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryDiscovery({ discovery, flipped, onOpenObject }: { discovery: EngineDiscovery; flipped: boolean; onOpenObject?: (slug: string) => void }) {
  const fromType = getObjectTypeIdentity(discovery.from_object.object_type_slug);
  const toType = getObjectTypeIdentity(discovery.to_object.object_type_slug);
  const scoreInt = Math.round(discovery.strength * 100);

  const primaryObj = flipped ? discovery.to_object : discovery.from_object;
  const secondaryObj = flipped ? discovery.from_object : discovery.to_object;
  const primaryType = flipped ? toType : fromType;
  const secondaryType = flipped ? fromType : toType;

  return (
    <div className={`${styles.convoRow} ${flipped ? styles.convoRowFlipped : ''}`}>
      {/* Primary bubble */}
      <div className={styles.bubble} onClick={() => onOpenObject?.(String(primaryObj.id))} style={{ cursor: onOpenObject ? 'pointer' : undefined }}>
        <div className={`${styles.bubbleNames} ${flipped ? styles.bubbleNamesRight : ''}`}>
          <div className={styles.dot} style={{ background: primaryType.color }} />
          <div className={styles.bubbleName} style={{ color: primaryType.color, fontSize: 14 }}>
            {primaryObj.title}
          </div>
        </div>
        <StrengthBar pct={scoreInt} flipped={flipped} />
        <div className={`${styles.bubbleReason} ${flipped ? styles.textRight : ''}`}>
          {discovery.reason}
        </div>
        <div className={`${styles.bubbleMeta} ${flipped ? styles.metaRight : ''}`}>
          <span className={styles.engineBadge}>{discovery.engine}</span>
        </div>
      </div>

      {/* Connector */}
      <div className={styles.connector}>
        <div className={styles.connectorLine} />
      </div>

      {/* Secondary bubble (compact) */}
      <div className={`${styles.bubble} ${styles.bubbleSecondary}`} onClick={() => onOpenObject?.(String(secondaryObj.id))} style={{ cursor: onOpenObject ? 'pointer' : undefined }}>
        <div className={`${styles.bubbleNames} ${flipped ? '' : styles.bubbleNamesRight}`}>
          <div className={styles.dot} style={{ background: secondaryType.color }} />
          <div className={styles.bubbleName} style={{ color: secondaryType.color, fontSize: 13 }}>
            {secondaryObj.title}
          </div>
        </div>
      </div>
    </div>
  );
}

function StrengthBar({ pct, flipped, compact }: { pct: number; flipped?: boolean; compact?: boolean }) {
  return (
    <div className={`${styles.strengthBar} ${compact ? styles.strengthBarCompact : ''}`}>
      <div className={styles.strengthTrack}>
        <div
          className={styles.strengthFill}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`${styles.strengthLabel} ${flipped ? styles.textRight : ''}`}>{pct}</span>
    </div>
  );
}

function CompactDiscovery({ discovery, onOpenObject }: { discovery: EngineDiscovery; onOpenObject?: (slug: string) => void }) {
  const fromType = getObjectTypeIdentity(discovery.from_object.object_type_slug);
  const toType = getObjectTypeIdentity(discovery.to_object.object_type_slug);
  const scoreInt = Math.round(discovery.strength * 100);

  return (
    <div className={styles.compactBubble} onClick={() => onOpenObject?.(String(discovery.from_object.id))} style={{ cursor: onOpenObject ? 'pointer' : undefined }}>
      <div className={styles.compactNames}>
        <div className={styles.dot} style={{ background: fromType.color }} />
        <div className={styles.compactName} style={{ color: fromType.color }}>
          {discovery.from_object.title}
        </div>
        <span className={styles.compactSep}>&middot;</span>
        <div className={styles.compactName} style={{ color: toType.color }}>
          {discovery.to_object.title}
        </div>
        <div className={styles.dot} style={{ background: toType.color }} />
      </div>
      <StrengthBar pct={scoreInt} compact />
      <div className={styles.bubbleMeta}>
        <span className={styles.engineBadge}>{discovery.engine}</span>
      </div>
    </div>
  );
}
