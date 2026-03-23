'use client';

import SchematicTree from './SchematicTree';
import type { SchematicData } from './readme-data';

interface SchematicMiniProps {
  data: SchematicData;
}

export default function SchematicMini({ data }: SchematicMiniProps) {
  return (
    <div
      style={{
        border: '1px solid var(--color-patent-border)',
        borderRadius: '4px',
        background: 'rgba(255,255,255,0.2)',
        padding: '10px 8px',
      }}
    >
      <SchematicTree data={data} variant="mini" />
    </div>
  );
}
