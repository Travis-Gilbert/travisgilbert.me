'use client';

/**
 * Layout A: List
 *
 * Default vertical stack. Density-aware gap and arrangement:
 * - chip: horizontal flow, wrapping (flex-wrap)
 * - card: responsive grid (auto-fill, minmax 280px)
 * - expanded: single-column vertical stack
 */

import ObjectRenderer, { type RenderableObject, type ObjectVariant } from '../objects/ObjectRenderer';
import ObjectDensityWrapper from './ObjectDensityWrapper';

export type Density = 'chip' | 'card' | 'expanded';

interface ObjectListProps {
  objects: RenderableObject[];
  density?: Density;
  /** Allow per-object click-to-cycle density */
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

export default function ObjectList({
  objects,
  density = 'card',
  allowDensityCycle = false,
  onClick,
  onContextMenu,
  onPinCreated,
}: ObjectListProps) {
  const containerStyle = getContainerStyle(density);

  if (objects.length === 0) {
    return (
      <div className="cp-empty-state">
        No objects to display.
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {objects.map((obj) => (
        <ObjectDensityWrapper
          key={`${obj.id}-${obj.slug}`}
          defaultDensity={density}
          enabled={allowDensityCycle}
        >
          {(currentDensity) => (
            <ObjectRenderer
              object={obj}
              variant={DENSITY_TO_VARIANT[currentDensity]}
              onClick={onClick}
              onContextMenu={onContextMenu}
              onPinCreated={onPinCreated}
            />
          )}
        </ObjectDensityWrapper>
      ))}
    </div>
  );
}

function getContainerStyle(density: Density): React.CSSProperties {
  switch (density) {
    case 'chip':
      return { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 };
    case 'card':
      return {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 10,
      };
    case 'expanded':
      return { display: 'flex', flexDirection: 'column', gap: 14 };
  }
}

export { DENSITY_TO_VARIANT };
