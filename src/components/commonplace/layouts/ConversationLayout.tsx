'use client';

/**
 * Layout C: Conversation
 *
 * Objects alternate left/right like a dialog, with paired items every 4th cycle.
 * Vertical connectors link items. Creates visual variety through position.
 *
 * Pattern (repeating every 4 items):
 *   index % 4 === 0 : left
 *   index % 4 === 1 : right
 *   index % 4 === 2 : start of pair (with index % 4 === 3)
 *   index % 4 === 3 : second of pair
 *
 * Pairs only render side-by-side at chip/card density.
 * At expanded density, paired items render as sequential left/right.
 */

import { Fragment } from 'react';
import ObjectRenderer, { type RenderableObject, type ObjectVariant } from '../objects/ObjectRenderer';
import ObjectDensityWrapper from './ObjectDensityWrapper';
import type { Density } from './ObjectList';

interface ConversationLayoutProps {
  objects: RenderableObject[];
  density?: Density;
  allowDensityCycle?: boolean;
  onClick?: (obj: RenderableObject) => void;
  onContextMenu?: (e: React.MouseEvent, obj: RenderableObject) => void;
  onPinCreated?: (parentSlug: string, childSlug: string) => void;
}

const DENSITY_TO_VARIANT: Record<Density, ObjectVariant> = {
  chip: 'chip',
  card: 'default',
  expanded: 'module',
};

const CONNECTOR_HEIGHT = 30;
const CONNECTOR_EDGE_PAD = 40;

type Position = 'left' | 'right' | 'pair-start' | 'pair-end';

function getPosition(index: number): Position {
  const mod = index % 4;
  if (mod === 0) return 'left';
  if (mod === 1) return 'right';
  if (mod === 2) return 'pair-start';
  return 'pair-end';
}

export default function ConversationLayout({
  objects,
  density = 'card',
  allowDensityCycle = false,
  onClick,
  onContextMenu,
  onPinCreated,
}: ConversationLayoutProps) {
  if (objects.length === 0) {
    return (
      <div className="cp-empty-state">
        No objects to display.
      </div>
    );
  }

  const canPair = density !== 'expanded';
  const items: ConvoItem[] = [];
  let i = 0;

  while (i < objects.length) {
    const pos = getPosition(i);

    if (pos === 'pair-start' && canPair && i + 1 < objects.length) {
      items.push({ type: 'pair', objects: [objects[i], objects[i + 1]], index: i });
      i += 2;
    } else if (pos === 'pair-start' || pos === 'pair-end') {
      // expanded density or no partner: render as alternating
      items.push({ type: 'single', object: objects[i], position: i % 2 === 0 ? 'left' : 'right', index: i });
      i += 1;
    } else {
      items.push({ type: 'single', object: objects[i], position: pos as 'left' | 'right', index: i });
      i += 1;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, idx) => (
        <Fragment key={item.index}>
          {/* Connector between items (not before first) */}
          {idx > 0 && (
            <Connector
              prevPosition={items[idx - 1].type === 'pair' ? 'left' : (items[idx - 1] as SingleItem).position}
            />
          )}

          {item.type === 'single' ? (
            <div style={{
              display: 'flex',
              justifyContent: item.position === 'right' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              ...(item.position === 'right' ? { marginLeft: 'auto' } : {}),
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ObjectDensityWrapper defaultDensity={density} enabled={allowDensityCycle}>
                  {(d) => (
                    <ObjectRenderer
                      object={item.object}
                      variant={DENSITY_TO_VARIANT[d]}
                      onClick={onClick}
                      onContextMenu={onContextMenu}
                      onPinCreated={onPinCreated}
                    />
                  )}
                </ObjectDensityWrapper>
              </div>
            </div>
          ) : (
            /* Pair: two objects side by side */
            <div style={{ display: 'flex', gap: 8 }}>
              {item.objects.map((obj) => (
                <div key={`${obj.id}-${obj.slug}`} style={{ flex: 1, minWidth: 0 }}>
                  <ObjectDensityWrapper defaultDensity={density} enabled={allowDensityCycle}>
                    {(d) => (
                      <ObjectRenderer
                        object={obj}
                        variant={DENSITY_TO_VARIANT[d]}
                        onClick={onClick}
                        onContextMenu={onContextMenu}
                        onPinCreated={onPinCreated}
                      />
                    )}
                  </ObjectDensityWrapper>
                </div>
              ))}
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

type SingleItem = { type: 'single'; object: RenderableObject; position: 'left' | 'right'; index: number };
type PairItem = { type: 'pair'; objects: [RenderableObject, RenderableObject]; index: number };
type ConvoItem = SingleItem | PairItem;

function Connector({ prevPosition }: { prevPosition: 'left' | 'right' }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: prevPosition === 'right' ? 'flex-end' : 'flex-start',
      paddingLeft: prevPosition === 'left' ? CONNECTOR_EDGE_PAD : 0,
      paddingRight: prevPosition === 'right' ? CONNECTOR_EDGE_PAD : 0,
    }}>
      <div style={{
        width: 2,
        height: CONNECTOR_HEIGHT,
        background: 'var(--cp-terracotta, #B45A2D)',
        opacity: 0.2,
        borderRadius: 1,
      }} />
    </div>
  );
}
