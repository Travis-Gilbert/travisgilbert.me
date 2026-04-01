'use client';

import { useEffect, useState } from 'react';
import { getModels, deleteModel } from '../../../lib/theseus-storage';
import type { SavedModel } from '../../../lib/theseus-storage';
import { ModelCard } from './ModelCard';

export function ModelGrid() {
  const [models, setModels] = useState<SavedModel[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getModels().then((m) => {
      setModels(m.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setLoaded(true);
    });
  }, []);

  async function handleDelete(id: string) {
    await deleteModel(id);
    setModels((prev) => prev.filter((m) => m.id !== id));
  }

  if (!loaded) return null;

  if (models.length === 0) {
    return (
      <p
        style={{
          textAlign: 'center',
          color: 'var(--vie-text-dim)',
          fontFamily: 'var(--vie-font-body)',
          fontSize: '14px',
          marginTop: '80px',
        }}
      >
        No saved models yet
      </p>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '16px',
        padding: '0 40px 40px',
      }}
    >
      {models.map((model) => (
        <ModelCard key={model.id} model={model} onDelete={handleDelete} />
      ))}
    </div>
  );
}
