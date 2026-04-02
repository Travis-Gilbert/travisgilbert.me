'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { askTheseus } from '@/lib/theseus-api';
import type {
  DataAcquisitionSection,
  HypothesisSection,
  NarrativeSection,
  ObjectsSection,
  StructuralGapSection,
  TheseusObject,
  TheseusResponse,
  TensionSection,
} from '@/lib/theseus-types';
import type { DataProcessingStatus } from '@/lib/theseus-data/types';
import type { ColumnDescriptor, DataShape } from '@/lib/theseus-viz/SceneSpec';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import { directScene } from '@/lib/theseus-viz/SceneDirector';
import { buildObjectLookup } from '@/components/theseus/renderers/rendering';
import RenderRouter from '@/components/theseus/renderers/RenderRouter';
import { getModel } from '@/lib/theseus-storage';
import { useIsMobile } from '@/hooks/useIsMobile';

type AskState = 'IDLE' | 'THINKING' | 'MODEL' | 'CONSTRUCTING' | 'EXPLORING';

interface ProcessedDataset {
  data: Record<string, unknown>[];
  dataShape: DataShape | null;
}

async function processDataAcquisition(
  section: DataAcquisitionSection,
  onStatus: (status: DataProcessingStatus) => void,
): Promise<ProcessedDataset | null> {
  onStatus({ phase: 'initializing' });

  const { loadDataSource } = await import('@/lib/theseus-data/DataLoader');
  const { runQuery, toObjectArray } = await import('@/lib/theseus-data/QueryRunner');

  onStatus({
    phase: 'loading',
    source: section.sources.map((source) => source.table_name).join(', '),
    progress: { loaded_bytes: 0, total_bytes: 0 },
  });

  const loadResults = await Promise.all(
    section.sources.map((source) => loadDataSource(source, (progress) => {
      onStatus({ phase: 'loading', source: source.table_name, progress });
    })),
  );
  const loadError = loadResults.find((result): result is Exclude<typeof result, string> => typeof result !== 'string');
  if (loadError) {
    onStatus({ phase: 'error', message: loadError.message, fallback: section.fallback_description });
    return null;
  }

  onStatus({ phase: 'processing', query_index: 0, total: section.queries.length });
  const queryResults = await Promise.all(section.queries.map((sql) => runQuery(sql)));
  const queryError = queryResults.find((result): result is Exclude<typeof result, { columns: string[] }> => 'code' in result);
  if (queryError) {
    onStatus({ phase: 'error', message: queryError.message, fallback: section.fallback_description });
    return null;
  }

  const primaryResult = queryResults.find(
    (result): result is Exclude<typeof result, { code: string }> => !('code' in result) && result.row_count > 0,
  ) ?? queryResults[0];

  if (!primaryResult || 'code' in primaryResult) {
    onStatus({ phase: 'complete' });
    return { data: [], dataShape: null };
  }

  const dataset = toObjectArray(primaryResult);
  onStatus({ phase: 'complete' });

  return {
    data: dataset,
    dataShape: inferDataShape(primaryResult),
  };
}

function inferDataShape(result: {
  columns: string[];
  types: string[];
  rows: unknown[][];
  row_count: number;
}): DataShape {
  const columns: ColumnDescriptor[] = result.columns.map((columnName, index) => {
    const values = result.rows.map((row) => row[index]);
    const uniqueCount = new Set(values.map((value) => String(value ?? ''))).size;
    return {
      name: columnName,
      type: inferColumnType(columnName, result.types[index], values, uniqueCount),
      unique_count: uniqueCount,
    };
  });

  return {
    columns,
    row_count: result.row_count,
    has_geographic: columns.some((column) => column.type === 'geographic'),
    has_temporal: columns.some((column) => column.type === 'temporal'),
    has_categorical: columns.some((column) => column.type === 'categorical'),
    has_numeric: columns.some((column) => column.type === 'numeric'),
  };
}

function inferColumnType(
  name: string,
  sqlType: string,
  values: unknown[],
  uniqueCount: number,
): ColumnDescriptor['type'] {
  const normalizedName = name.toLowerCase();
  const normalizedType = sqlType.toLowerCase();

  if (
    normalizedName.includes('lat')
    || normalizedName.includes('lon')
    || normalizedName.includes('lng')
    || normalizedName.includes('latitude')
    || normalizedName.includes('longitude')
  ) {
    return 'geographic';
  }

  if (
    normalizedType.includes('date')
    || normalizedType.includes('time')
    || normalizedType.includes('timestamp')
  ) {
    return 'temporal';
  }

  if (
    normalizedType.includes('int')
    || normalizedType.includes('float')
    || normalizedType.includes('double')
    || normalizedType.includes('decimal')
    || normalizedType.includes('numeric')
  ) {
    return 'numeric';
  }

  const stringValues = values.filter((value): value is string => typeof value === 'string');
  const averageLength = stringValues.length === 0
    ? 0
    : stringValues.reduce((sum, value) => sum + value.length, 0) / stringValues.length;

  if (uniqueCount <= Math.max(20, Math.floor(values.length * 0.2))) {
    return 'categorical';
  }

  if (averageLength > 40) {
    return 'text';
  }

  return 'categorical';
}

function getNarratives(response: TheseusResponse): NarrativeSection[] {
  return response.sections.filter(
    (section): section is NarrativeSection => section.type === 'narrative',
  );
}

function getObjects(response: TheseusResponse): TheseusObject[] {
  return response.sections.find(
    (section): section is ObjectsSection => section.type === 'objects',
  )?.objects ?? [];
}

function getTensions(response: TheseusResponse): TensionSection[] {
  return response.sections.filter(
    (section): section is TensionSection => section.type === 'tension',
  );
}

function getGaps(response: TheseusResponse): StructuralGapSection[] {
  return response.sections.filter(
    (section): section is StructuralGapSection => section.type === 'structural_gap',
  );
}

function getHypotheses(response: TheseusResponse): HypothesisSection[] {
  return response.sections.filter(
    (section): section is HypothesisSection => section.type === 'hypothesis',
  );
}

function StatusScreen({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        textAlign: 'center',
        gap: 10,
      }}
    >
      <p
        style={{
          color: 'var(--vie-text)',
          fontFamily: 'var(--vie-font-title)',
          fontSize: '1.5rem',
          margin: 0,
        }}
      >
        {title}
      </p>
      {subtitle && (
        <p
          style={{
            color: 'var(--vie-text-dim)',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: '0.8rem',
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function AskContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');
  const savedId = searchParams.get('saved');
  const isMobile = useIsMobile();

  const [state, setState] = useState<AskState>(query ? 'THINKING' : 'IDLE');
  const [response, setResponse] = useState<TheseusResponse | null>(null);
  const [sceneDirective, setSceneDirective] = useState<SceneDirective | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [narrationReady, setNarrationReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<DataProcessingStatus | null>(null);
  const [savedSceneSpec, setSavedSceneSpec] = useState<import('@/lib/theseus-viz/SceneSpec').SceneSpec | null>(null);
  const [savedQuery, setSavedQuery] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const handleDataStatus = useCallback((status: DataProcessingStatus) => {
    if (!cancelledRef.current) {
      setDataStatus(status);
    }
  }, []);

  useEffect(() => {
    if (!savedId) return;

    getModel(savedId).then((model) => {
      if (model) {
        setSavedSceneSpec(model.scene_spec);
        setSavedQuery(model.query);
        setState('EXPLORING');
      }
    });
  }, [savedId]);

  useEffect(() => {
    if (!query || savedId) return;

    cancelledRef.current = false;
    setNarrationReady(false);
    setSceneDirective(null);
    setSelectedNodeId(null);
    setResponse(null);
    setError(null);

    async function run() {
      const activeQuery = query;
      if (!activeQuery) return;

      setState('THINKING');
      const result = await askTheseus(activeQuery);
      if (cancelledRef.current) return;

      if (!result.ok) {
        setError(result.message);
        setState('IDLE');
        return;
      }

      setState('MODEL');
      setResponse(result);

      const dataSection = result.sections.find(
        (section): section is DataAcquisitionSection => section.type === 'data_acquisition',
      );

      await new Promise((resolve) => window.setTimeout(resolve, 500));
      if (cancelledRef.current) return;

      setState('CONSTRUCTING');

      let processedDataset: ProcessedDataset | null = null;
      if (dataSection) {
        processedDataset = await processDataAcquisition(dataSection, handleDataStatus);
        if (cancelledRef.current) return;
      }

      const directive = await directScene(
        result,
        processedDataset?.data,
        processedDataset?.dataShape ?? null,
      );
      if (cancelledRef.current) return;

      setSceneDirective(directive);

      const focalNodeId = directive.salience.find((salience) => salience.is_focal)?.node_id;
      const firstObjectId = getObjects(result)[0]?.id ?? null;
      setSelectedNodeId(focalNodeId ?? firstObjectId);
      setState('EXPLORING');
    }

    run();

    return () => {
      cancelledRef.current = true;
    };
  }, [handleDataStatus, query, savedId]);

  const objectLookup = useMemo(
    () => (response ? buildObjectLookup(response) : new Map<string, TheseusObject>()),
    [response],
  );

  const selectedObject = selectedNodeId ? objectLookup.get(selectedNodeId) ?? null : null;
  const narratives = response ? getNarratives(response) : [];
  const tensions = response ? getTensions(response) : [];
  const gaps = response ? getGaps(response) : [];
  const hypotheses = response ? getHypotheses(response) : [];

  const infoPanelStyle = isMobile
    ? {
        position: 'absolute' as const,
        left: 16,
        right: 16,
        bottom: 16,
        maxHeight: '46vh',
      }
    : {
        position: 'absolute' as const,
        top: 20,
        right: 20,
        width: 380,
        maxHeight: 'calc(100vh - 40px)',
      };

  if (state === 'IDLE' && !error) {
    return <StatusScreen title="No query provided" subtitle="Go back to the Theseus homepage and ask a question." />;
  }

  if (error) {
    return <StatusScreen title="Something went wrong" subtitle={error} />;
  }

  if (savedSceneSpec && savedId) {
    return (
      <StatusScreen
        title={savedQuery ?? 'Saved model'}
        subtitle={`Legacy model view: ${savedSceneSpec.nodes.length} nodes · ${Math.round(savedSceneSpec.confidence * 100)}% confidence`}
      />
    );
  }

  if (!response || !sceneDirective || state !== 'EXPLORING') {
    const title = state === 'THINKING'
      ? 'Thinking...'
      : state === 'MODEL'
        ? 'Building model...'
        : 'Constructing scene...';

      const subtitle = state === 'CONSTRUCTING'
      ? dataStatus?.phase === 'loading'
        ? `Loading ${dataStatus.source}...`
        : dataStatus?.phase === 'processing'
          ? `Running query ${dataStatus.query_index + 1}/${dataStatus.total}...`
          : query ?? undefined
      : query ?? undefined;

    return <StatusScreen title={title} subtitle={subtitle} />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <RenderRouter
        directive={sceneDirective}
        response={response}
        onSelectNode={setSelectedNodeId}
        onCrystallizeComplete={() => setNarrationReady(true)}
      />

      <div
        style={{
          position: 'absolute',
          left: 20,
          top: 20,
          maxWidth: isMobile ? 'calc(100vw - 40px)' : 520,
          padding: '16px 18px',
          borderRadius: 18,
          background: 'rgba(15,16,18,0.66)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(18px)',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(74,138,150,0.12)',
              color: 'var(--vie-teal-light)',
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {sceneDirective.render_target.primary}
          </span>
          <span
            style={{
              color: 'var(--vie-text-dim)',
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 11,
            }}
          >
            confidence {Math.round(response.confidence.combined * 100)}%
          </span>
        </div>

        <h1
          style={{
            margin: 0,
            color: 'var(--vie-text)',
            fontFamily: 'var(--vie-font-title)',
            fontSize: isMobile ? '1.25rem' : '1.55rem',
            lineHeight: 1.2,
          }}
        >
          {response.query}
        </h1>
      </div>

      <aside
        style={{
          ...infoPanelStyle,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          padding: isMobile ? '16px' : '18px',
          borderRadius: 22,
          background: 'rgba(15,16,18,0.76)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(18px)',
          overflowY: 'auto' as const,
          zIndex: 10,
        }}
      >
        {!narrationReady ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <span
              style={{
                color: 'var(--vie-amber-light)',
                fontFamily: 'var(--vie-font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              crystallizing
            </span>
            <p
              style={{
                margin: 0,
                color: 'var(--vie-text-muted)',
                fontFamily: 'var(--vie-font-body)',
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              Theseus is finishing the construction sequence before the narration panel opens.
            </p>
          </div>
        ) : (
          <>
            {selectedObject && (
              <section>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      color: 'var(--vie-teal-light)',
                      fontFamily: 'var(--vie-font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    selected object
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--vie-text-muted)',
                      fontFamily: 'var(--vie-font-mono)',
                      fontSize: 10,
                    }}
                  >
                    {selectedObject.object_type}
                  </span>
                </div>
                <h2
                  style={{
                    margin: '0 0 6px',
                    color: 'var(--vie-text)',
                    fontFamily: 'var(--vie-font-title)',
                    fontSize: '1.1rem',
                  }}
                >
                  {selectedObject.title}
                </h2>
                {selectedObject.summary && (
                  <p
                    style={{
                      margin: 0,
                      color: 'var(--vie-text-muted)',
                      fontFamily: 'var(--vie-font-body)',
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    {selectedObject.summary}
                  </p>
                )}
              </section>
            )}

            {narratives.length > 0 && (
              <section>
                <span
                  style={{
                    color: 'var(--vie-teal-light)',
                    fontFamily: 'var(--vie-font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  narration
                </span>
                <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                  {narratives.slice(0, 2).map((narrative, index) => (
                    <p
                      key={`narrative-${index}`}
                      style={{
                        margin: 0,
                        color: 'var(--vie-text)',
                        fontFamily: 'var(--vie-font-body)',
                        fontSize: 14,
                        lineHeight: 1.65,
                      }}
                    >
                      {narrative.content}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {tensions.length > 0 && (
              <section>
                <span
                  style={{
                    color: 'var(--vie-terra-light)',
                    fontFamily: 'var(--vie-font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  tensions
                </span>
                <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                  {tensions.slice(0, 2).map((tension, index) => (
                    <div key={`tension-${index}`} style={{ display: 'grid', gap: 4 }}>
                      <strong
                        style={{
                          color: 'var(--vie-text)',
                          fontFamily: 'var(--vie-font-body)',
                          fontSize: 14,
                        }}
                      >
                        {tension.domain}
                      </strong>
                      <p style={{ margin: 0, color: 'var(--vie-text-muted)', fontSize: 13, lineHeight: 1.5 }}>
                        {tension.claim_a}
                      </p>
                      <p style={{ margin: 0, color: 'var(--vie-text-muted)', fontSize: 13, lineHeight: 1.5 }}>
                        {tension.claim_b}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {hypotheses.length > 0 && (
              <section>
                <span
                  style={{
                    color: 'var(--vie-amber-light)',
                    fontFamily: 'var(--vie-font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  hypotheses
                </span>
                <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                  {hypotheses.slice(0, 2).map((hypothesis, index) => (
                    <div key={`hypothesis-${index}`} style={{ display: 'grid', gap: 4 }}>
                      <strong
                        style={{
                          color: 'var(--vie-text)',
                          fontFamily: 'var(--vie-font-body)',
                          fontSize: 14,
                        }}
                      >
                        {hypothesis.title}
                      </strong>
                      <p style={{ margin: 0, color: 'var(--vie-text-muted)', fontSize: 13, lineHeight: 1.5 }}>
                        {hypothesis.structural_basis || hypothesis.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {gaps.length > 0 && (
              <section>
                <span
                  style={{
                    color: 'var(--vie-text-muted)',
                    fontFamily: 'var(--vie-font-mono)',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  structural gaps
                </span>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  {gaps.slice(0, 2).map((gap, index) => (
                    <p
                      key={`gap-${index}`}
                      style={{
                        margin: 0,
                        color: 'var(--vie-text-muted)',
                        fontFamily: 'var(--vie-font-body)',
                        fontSize: 13,
                        lineHeight: 1.55,
                      }}
                    >
                      {gap.message}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

export default function TheseusAskPage() {
  return (
    <Suspense
      fallback={<StatusScreen title="Loading..." subtitle="Preparing Theseus." />}
    >
      <AskContent />
    </Suspense>
  );
}
