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
}

export default function EngineDiscoveryFeed({ discoveries }: EngineDiscoveryFeedProps) {
  if (discoveries.length === 0) {
    return (
      <div className={styles.feed}>
        <div className={styles.empty}>No new discoveries</div>
      </div>
    );
  }

  const [first, ...rest] = discoveries;
  const compactPair = rest.length >= 3 ? rest.splice(-2, 2) : [];

  return (
    <div className={styles.feed}>
      {/* Dominant discovery: larger */}
      <DiscoveryCard discovery={first} large />

      {/* Remaining: standard size */}
      {rest.map((d) => (
        <DiscoveryCard key={d.edge_id} discovery={d} />
      ))}

      {/* Bottom pair in 2-column grid */}
      {compactPair.length === 2 && (
        <div className={styles.grid2}>
          {compactPair.map((d) => (
            <DiscoveryCard key={d.edge_id} discovery={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoveryCard({ discovery, large }: { discovery: EngineDiscovery; large?: boolean }) {
  const fromType = getObjectTypeIdentity(discovery.from_object.object_type_slug);
  const toType = getObjectTypeIdentity(discovery.to_object.object_type_slug);
  const scoreInt = Math.round(discovery.strength * 100);

  return (
    <div className={`${styles.discovery} ${large ? styles.discoveryLarge : ''}`}>
      <div className={styles.edge}>
        {/* From node */}
        <div className={styles.node}>
          <div className={styles.dot} style={{ background: fromType.color }} />
          <div
            className={`${styles.name} ${large ? styles.nameLarge : ''}`}
            style={{ color: fromType.color }}
          >
            {discovery.from_object.title}
          </div>
        </div>

        {/* Edge line with score */}
        <div className={`${styles.lineWrap} ${large ? styles.lineWrapLarge : ''}`}>
          <div
            className={styles.line}
            style={{
              background: `linear-gradient(90deg, ${fromType.color}, var(--cp-red), ${toType.color})`,
            }}
          />
          <div className={`${styles.score} ${large ? styles.scoreLarge : ''}`}>
            {scoreInt}
          </div>
          <div
            className={styles.line}
            style={{
              background: `linear-gradient(90deg, var(--cp-red), ${toType.color})`,
            }}
          />
        </div>

        {/* To node */}
        <div className={`${styles.node} ${styles.nodeRight}`}>
          <div
            className={`${styles.name} ${large ? styles.nameLarge : ''}`}
            style={{ color: toType.color }}
          >
            {discovery.to_object.title}
          </div>
          <div className={styles.dot} style={{ background: toType.color }} />
        </div>
      </div>

      {/* Reason (full for large, truncated for compact) */}
      <div className={`${styles.reason} ${large ? styles.reasonLarge : ''}`}>
        {discovery.reason}
      </div>

      {/* Engine badge */}
      <div className={styles.meta}>
        <span className={styles.engineBadge}>{discovery.engine}</span>
        {large && (
          <span className={styles.engineBadge}>
            cosine: {discovery.strength.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
