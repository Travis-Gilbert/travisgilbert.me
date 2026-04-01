'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { askTheseus } from '../../../lib/theseus-api';
import type { TheseusResponse, DataAcquisitionSection } from '../../../lib/theseus-types';
import type { DataProcessingStatus } from '../../../lib/theseus-data/types';

type AskState = 'IDLE' | 'THINKING' | 'MODEL' | 'CONSTRUCTING' | 'EXPLORING';

async function processDataAcquisition(
  section: DataAcquisitionSection,
  onStatus: (status: DataProcessingStatus) => void,
): Promise<Record<string, unknown>[][] | null> {
  onStatus({ phase: 'initializing' });

  const { loadDataSource } = await import('../../../lib/theseus-data/DataLoader');
  const { runQuery, toObjectArray } = await import('../../../lib/theseus-data/QueryRunner');

  // Load all sources in parallel (DuckDB singleton is thread-safe)
  onStatus({ phase: 'loading', source: section.sources.map((s) => s.table_name).join(', '), progress: { loaded_bytes: 0, total_bytes: 0 } });
  const loadResults = await Promise.all(
    section.sources.map((source) => loadDataSource(source, (progress) => {
      onStatus({ phase: 'loading', source: source.table_name, progress });
    })),
  );
  const loadError = loadResults.find((r): r is Exclude<typeof r, string> => typeof r !== 'string');
  if (loadError) {
    onStatus({ phase: 'error', message: loadError.message, fallback: section.fallback_description });
    return null;
  }

  // Execute all queries in parallel (semaphore in QueryRunner caps at 5)
  onStatus({ phase: 'processing', query_index: 0, total: section.queries.length });
  const queryResults = await Promise.all(section.queries.map((sql) => runQuery(sql)));
  const queryError = queryResults.find((r): r is Exclude<typeof r, { columns: string[] }> => 'code' in r);
  if (queryError) {
    onStatus({ phase: 'error', message: queryError.message, fallback: section.fallback_description });
    return null;
  }

  const data = queryResults.map((r) => toObjectArray(r as Exclude<typeof r, { code: string }>));
  onStatus({ phase: 'complete' });
  return data;
}

function AskContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q');
  const [state, setState] = useState<AskState>(q ? 'THINKING' : 'IDLE');
  const [response, setResponse] = useState<TheseusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<DataProcessingStatus | null>(null);
  const cancelledRef = useRef(false);

  const handleDataStatus = useCallback((status: DataProcessingStatus) => {
    if (!cancelledRef.current) setDataStatus(status);
  }, []);

  useEffect(() => {
    if (!q) return;

    cancelledRef.current = false;

    async function run() {
      setState('THINKING');
      const result = await askTheseus(q!);
      if (cancelledRef.current) return;

      if (!result.ok) {
        setError(result.message);
        setState('IDLE');
        return;
      }

      setState('MODEL');
      setResponse(result);

      const dataSection = result.sections.find(
        (s): s is DataAcquisitionSection => s.type === 'data_acquisition',
      );

      await new Promise((r) => setTimeout(r, 800));
      if (cancelledRef.current) return;

      setState('CONSTRUCTING');

      if (dataSection) {
        await processDataAcquisition(dataSection, handleDataStatus);
        if (cancelledRef.current) return;
      }

      setState('EXPLORING');
    }

    run();
    return () => {
      cancelledRef.current = true;
    };
  }, [q, handleDataStatus]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '0 24px',
        fontFamily: 'var(--vie-font-body)',
      }}
    >
      {state === 'IDLE' && !error && (
        <p style={{ color: 'var(--vie-text-muted)' }}>
          No query provided. Go back to search.
        </p>
      )}

      {error && (
        <div style={{ color: 'var(--vie-terra-light)', textAlign: 'center' }}>
          <p style={{ fontSize: '1.125rem', marginBottom: '8px' }}>Something went wrong</p>
          <p style={{ color: 'var(--vie-text-dim)', fontSize: '0.875rem' }}>{error}</p>
        </div>
      )}

      {state === 'THINKING' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--vie-teal-light)', fontSize: '1.25rem', marginBottom: '8px' }}>
            Thinking...
          </p>
          <p style={{ color: 'var(--vie-text-dim)', fontFamily: 'var(--vie-font-mono)', fontSize: '0.875rem' }}>
            {q}
          </p>
        </div>
      )}

      {state === 'MODEL' && (
        <p style={{ color: 'var(--vie-amber-light)', fontSize: '1.25rem' }}>
          Building model...
        </p>
      )}

      {state === 'CONSTRUCTING' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--vie-amber)', fontSize: '1.25rem', marginBottom: '8px' }}>
            Constructing scene...
          </p>
          {dataStatus && dataStatus.phase !== 'complete' && (
            <p style={{
              color: 'var(--vie-text-dim)',
              fontFamily: 'var(--vie-font-mono)',
              fontSize: '0.75rem',
            }}>
              {dataStatus.phase === 'initializing' && 'Initializing data engine...'}
              {dataStatus.phase === 'loading' && `Loading data: ${dataStatus.source}...`}
              {dataStatus.phase === 'processing' && `Processing query ${dataStatus.query_index + 1}/${dataStatus.total}...`}
              {dataStatus.phase === 'error' && dataStatus.fallback}
            </p>
          )}
        </div>
      )}

      {state === 'EXPLORING' && response && (
        <div style={{ textAlign: 'center', maxWidth: '640px' }}>
          <p style={{
            fontFamily: 'var(--vie-font-title)',
            fontSize: '1.5rem',
            color: 'var(--vie-text)',
            marginBottom: '16px',
          }}>
            {response.query}
          </p>
          <p style={{
            color: 'var(--vie-text-muted)',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: '0.875rem',
            marginBottom: '24px',
          }}>
            Confidence: {Math.round(response.confidence.combined * 100)}%
            {' · '}{response.sections.length} sections
          </p>
          {response.sections
            .filter((s): s is Extract<typeof s, { type: 'narrative' }> => s.type === 'narrative')
            .map((s, i) => (
              <p key={i} style={{ color: 'var(--vie-text)', lineHeight: 1.7, marginBottom: '16px' }}>
                {s.content}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

export default function TheseusAskPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--vie-text-dim)',
          fontFamily: 'var(--vie-font-body)',
        }}>
          Loading...
        </div>
      }
    >
      <AskContent />
    </Suspense>
  );
}
