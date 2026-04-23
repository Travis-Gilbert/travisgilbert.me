'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import CosmosGraphCanvas, {
  type CosmosGraphCanvasHandle,
} from '@/components/theseus/explorer/CosmosGraphCanvas';
import { explainNode, type ExplainNodeInteraction } from '@/lib/theseus-api';
import { attachSelectionBridge } from '@/lib/theseus/mosaic/selectionBridge';
import { initMosaicCoordinator } from '@/lib/theseus/mosaic/coordinator';
import { ingestSimulationPrimitives } from '@/lib/theseus/mosaic/ingestSimulationPrimitives';
import {
  buildBudgetChart,
  buildMetadataHistogram,
} from '@/lib/theseus/mosaic/simulationSpecs';
import type {
  ConstructionSequence,
  SimulationPayload,
  SimulationPrimitive,
  SimulationRelation,
} from '@/lib/theseus-viz/SceneDirective';

const MISSING_COLOR_SENTINEL = '__missing__';

type SimulationPayloadWithConstruction = SimulationPayload & {
  construction?: ConstructionSequence;
};

interface SimulationPartProps {
  payload: SimulationPayloadWithConstruction;
}

interface SimulationMetricRow {
  key: string;
  total: number;
  limit: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPrimitive(value: unknown): value is SimulationPrimitive {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.kind === 'string'
    && isRecord(value.metadata)
    && Array.isArray(value.provenance_object_ids)
  );
}

function isRelation(value: unknown): value is SimulationRelation {
  if (!isRecord(value)) return false;
  return (
    typeof value.from_id === 'string'
    && typeof value.to_id === 'string'
    && typeof value.relation_kind === 'string'
  );
}

function isConstructionSequence(value: unknown): value is ConstructionSequence {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.phases)) return false;
  if (typeof value.total_duration_ms !== 'number') return false;
  if (typeof value.theatricality !== 'number') return false;
  return true;
}

export function readSimulationPayload(
  value: unknown,
): SimulationPayloadWithConstruction | null {
  if (!isRecord(value)) return null;
  if (typeof value.domain !== 'string') return null;
  if (!isRecord(value.intent)) return null;
  if (!Array.isArray(value.primitives) || !value.primitives.every(isPrimitive)) return null;
  if (!Array.isArray(value.relations) || !value.relations.every(isRelation)) return null;
  if (!Array.isArray(value.metadata_slots) || !value.metadata_slots.every((item: unknown) => typeof item === 'string')) {
    return null;
  }
  if (
    value.render_target !== 'cosmograph'
    && value.render_target !== 'mosaic'
    && value.render_target !== 'r3f'
    && value.render_target !== 'mixed'
  ) {
    return null;
  }
  if (!Array.isArray(value.pattern_provenance) || !value.pattern_provenance.every((item: unknown) => typeof item === 'string')) {
    return null;
  }
  if (typeof value.scene_id !== 'string') return null;

  return {
    domain: value.domain,
    intent: value.intent,
    primitives: value.primitives,
    relations: value.relations,
    metadata_slots: value.metadata_slots,
    render_target: value.render_target,
    pattern_provenance: value.pattern_provenance,
    scene_id: value.scene_id,
    construction: isConstructionSequence(value.construction)
      ? value.construction
      : undefined,
  };
}

function labelForPrimitive(primitive: SimulationPrimitive): string {
  const title = primitive.metadata.title;
  if (typeof title === 'string' && title.trim().length > 0) {
    return title;
  }
  const name = primitive.metadata.name;
  if (typeof name === 'string' && name.trim().length > 0) {
    return name;
  }
  return primitive.kind.replace(/_/g, ' ');
}

function numericValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'n/a';
    return value % 1 === 0 ? String(value) : value.toFixed(2);
  }
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return 'n/a';
}

function summarizePrimitive(
  primitive: SimulationPrimitive | null,
  metadataSlots: string[],
): string {
  if (!primitive) return '';
  const lines = [`${labelForPrimitive(primitive)} (${primitive.kind})`];
  for (const key of metadataSlots) {
    const value = primitive.metadata[key];
    if (value === undefined) continue;
    lines.push(`${key}: ${formatValue(value)}`);
  }
  if (lines.length === 1) {
    for (const [key, value] of Object.entries(primitive.metadata)) {
      lines.push(`${key}: ${formatValue(value)}`);
    }
  }
  return lines.join('\n');
}

function buildPointDegree(
  primitiveId: string,
  relations: SimulationRelation[],
): number {
  let degree = 0;
  for (const relation of relations) {
    if (relation.from_id === primitiveId || relation.to_id === primitiveId) {
      degree += 1;
    }
  }
  return degree;
}

function inferConstraintLimit(slot: string): number | null {
  const normalized = slot.toLowerCase();
  if (normalized.includes('bom') || normalized.includes('cost') || normalized.includes('price')) {
    return 500;
  }
  if (normalized.includes('thermal') || normalized.includes('power') || normalized.includes('watt')) {
    return 30;
  }
  if (normalized.includes('minutes') || normalized.includes('distance')) {
    return 15;
  }
  return null;
}

function buildMetricRows(
  primitives: SimulationPrimitive[],
  metadataSlots: string[],
): SimulationMetricRow[] {
  const rows: SimulationMetricRow[] = [];
  for (const slot of metadataSlots) {
    let total = 0;
    let found = false;
    for (const primitive of primitives) {
      const value = numericValue(primitive.metadata[slot]);
      if (value === null) continue;
      total += value;
      found = true;
    }
    if (!found) continue;
    rows.push({
      key: slot,
      total,
      limit: inferConstraintLimit(slot),
    });
  }
  return rows;
}

function mapPrimitiveToPoint(
  primitive: SimulationPrimitive,
  relations: SimulationRelation[],
) {
  return {
    id: primitive.id,
    label: labelForPrimitive(primitive),
    type: primitive.kind,
    colorHex: MISSING_COLOR_SENTINEL,
    degree: buildPointDegree(primitive.id, relations),
    description: summarizePrimitive(primitive, []),
    metadata: primitive.metadata,
  };
}

function mapRelationToLink(relation: SimulationRelation) {
  const weight = numericValue(relation.metadata?.weight) ?? 1;
  return {
    source: relation.from_id,
    target: relation.to_id,
    weight,
    reason: relation.relation_kind,
    edge_type: relation.relation_kind,
  };
}

const SimulationPart: FC<SimulationPartProps> = ({ payload }) => {
  const canvasRef = useRef<CosmosGraphCanvasHandle>(null);
  const budgetHostRef = useRef<HTMLDivElement | null>(null);
  const histogramHostRef = useRef<HTMLDivElement | null>(null);
  const explainAbortRef = useRef<AbortController | null>(null);

  const [primitives, setPrimitives] = useState<SimulationPrimitive[]>(payload.primitives);
  const [relations, setRelations] = useState<SimulationRelation[]>(payload.relations);
  const [selectedId, setSelectedId] = useState<string | null>(payload.primitives[0]?.id ?? null);
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [mosaicError, setMosaicError] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    setPrimitives(payload.primitives);
    setRelations(payload.relations);
    setSelectedId(payload.primitives[0]?.id ?? null);
    setExplanation('');
    setExplanationError(null);
    setIsExplaining(false);
    setMosaicError(null);
    setCanvasReady(false);
    explainAbortRef.current?.abort();
    explainAbortRef.current = null;
  }, [payload]);

  useEffect(() => {
    return () => {
      explainAbortRef.current?.abort();
    };
  }, []);

  const primitiveMap = useMemo(() => {
    return new Map(primitives.map((primitive) => [primitive.id, primitive]));
  }, [primitives]);

  const selectedPrimitive = selectedId ? primitiveMap.get(selectedId) ?? null : null;

  const points = useMemo(() => {
    return primitives.map((primitive) => mapPrimitiveToPoint(primitive, relations));
  }, [primitives, relations]);

  const links = useMemo(() => {
    return relations
      .filter((relation) => primitiveMap.has(relation.from_id) && primitiveMap.has(relation.to_id))
      .map(mapRelationToLink);
  }, [primitiveMap, relations]);

  const metricRows = useMemo(() => {
    return buildMetricRows(primitives, payload.metadata_slots);
  }, [payload.metadata_slots, primitives]);
  const activeMetricSlot = useMemo(() => {
    if (metricRows.length > 0) return metricRows[0].key;
    return payload.metadata_slots[0] ?? null;
  }, [metricRows, payload.metadata_slots]);
  const activeMetricLimit = useMemo(() => {
    if (!activeMetricSlot) return null;
    const row = metricRows.find((entry) => entry.key === activeMetricSlot);
    return row?.limit ?? null;
  }, [activeMetricSlot, metricRows]);

  useEffect(() => {
    const adapter = canvasRef.current;
    if (!adapter) return;
    adapter.applyPrimitiveMetadata(
      primitives.map((primitive) => ({
        id: primitive.id,
        metadata: primitive.metadata,
        displayKeys: payload.metadata_slots,
      })),
    );
  }, [payload.metadata_slots, primitives]);

  useEffect(() => {
    const adapter = canvasRef.current;
    if (!adapter || !payload.construction) return;
    adapter.playConstructionSequence(payload.construction);
  }, [payload.construction, payload.scene_id]);

  useEffect(() => {
    if (payload.render_target !== 'mixed' && payload.render_target !== 'mosaic') {
      if (budgetHostRef.current) budgetHostRef.current.replaceChildren();
      if (histogramHostRef.current) histogramHostRef.current.replaceChildren();
      setMosaicError(null);
      return;
    }
    if (!activeMetricSlot) {
      setMosaicError('No numeric metadata slots available for charting.');
      return;
    }

    let disposed = false;
    let disposeBridge: (() => void) | null = null;

    const mountCharts = async () => {
      try {
        await initMosaicCoordinator();
        await ingestSimulationPrimitives(
          payload.scene_id,
          primitives,
          relations,
          payload.metadata_slots,
        );
        if (disposed) return;
        const budgetChart = await buildBudgetChart(
          payload.scene_id,
          activeMetricSlot,
          activeMetricLimit,
        );
        const histogram = await buildMetadataHistogram(
          payload.scene_id,
          activeMetricSlot,
        );
        if (disposed) return;
        if (budgetHostRef.current) budgetHostRef.current.replaceChildren(budgetChart);
        if (histogramHostRef.current) histogramHostRef.current.replaceChildren(histogram);
        setMosaicError(null);

        if (payload.render_target === 'mixed' && canvasReady) {
          const adapter = canvasRef.current;
          if (adapter) {
            disposeBridge = attachSelectionBridge(adapter, {
              mode: 'simulation',
              simulationSceneId: payload.scene_id,
              simulationSlot: activeMetricSlot,
            });
          }
        }
      } catch (error) {
        if (disposed) return;
        const message = error instanceof Error ? error.message : String(error);
        setMosaicError(message);
      }
    };

    void mountCharts();

    return () => {
      disposed = true;
      if (disposeBridge) disposeBridge();
      if (budgetHostRef.current) budgetHostRef.current.replaceChildren();
      if (histogramHostRef.current) histogramHostRef.current.replaceChildren();
    };
  }, [
    payload.render_target,
    payload.scene_id,
    payload.metadata_slots,
    primitives,
    relations,
    activeMetricSlot,
    activeMetricLimit,
    canvasReady,
  ]);

  const requestExplanation = (nodeId: string, interaction: ExplainNodeInteraction) => {
    explainAbortRef.current?.abort();
    const controller = new AbortController();
    explainAbortRef.current = controller;
    setExplanation('');
    setExplanationError(null);
    setIsExplaining(true);

    void explainNode(
      {
        sceneId: payload.scene_id,
        nodeId,
        interaction,
        priorExplanations: selectedId ? [selectedId] : [],
      },
      {
        onToken(token) {
          setExplanation((prev) => prev + token);
        },
        onDone() {
          setIsExplaining(false);
        },
        onError(error) {
          setIsExplaining(false);
          setExplanationError(error.message);
        },
      },
      { signal: controller.signal },
    );
  };

  const handleRemove = (pointId: string) => {
    const nextPrimitives = primitives.filter((primitive) => primitive.id !== pointId);
    const nextPrimitiveIds = new Set(nextPrimitives.map((primitive) => primitive.id));
    const nextRelations = relations.filter((relation) => (
      nextPrimitiveIds.has(relation.from_id) && nextPrimitiveIds.has(relation.to_id)
    ));
    canvasRef.current?.replaceScene(
      nextPrimitives.map((primitive) => mapPrimitiveToPoint(primitive, nextRelations)),
      nextRelations.map(mapRelationToLink),
    );
    setPrimitives(nextPrimitives);
    setRelations(nextRelations);
    setSelectedId((prev) => (prev === pointId ? null : prev));
    requestExplanation(pointId, 'remove');
  };

  const summary = summarizePrimitive(selectedPrimitive, payload.metadata_slots);
  const mosaicPanel = (
    <div
      style={{
        background: 'var(--color-theseus-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        padding: 12,
        boxShadow: 'var(--shadow-warm-sm)',
        display: 'grid',
        gap: 10,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-muted)',
        }}
      >
        Constraint charts
      </div>
      <div
        ref={budgetHostRef}
        style={{
          minHeight: 120,
        }}
      />
      <div
        ref={histogramHostRef}
        style={{
          minHeight: 120,
        }}
      />
      {mosaicError && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--paper-pencil)',
          }}
        >
          Chart unavailable: {mosaicError}
        </div>
      )}
    </div>
  );

  const rightPanel = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          background: 'var(--color-theseus-panel)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: 12,
          boxShadow: 'var(--shadow-warm-sm)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-muted)',
            marginBottom: 8,
          }}
        >
          Scene summary
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-ink)' }}>
          {payload.domain} simulation with {primitives.length} primitives
        </div>
        {metricRows.length > 0 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {metricRows.map((row) => {
              const max = row.limit ?? Math.max(row.total, 1);
              const width = Math.max(6, Math.min(100, (row.total / max) * 100));
              return (
                <div key={row.key}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--color-ink-muted)',
                      marginBottom: 4,
                    }}
                  >
                    <span>{row.key}</span>
                    <span>
                      {formatValue(row.total)}
                      {row.limit !== null ? ` / ${formatValue(row.limit)}` : ''}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: 'color-mix(in srgb, var(--color-border) 55%, transparent)',
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${width}%`,
                        height: '100%',
                        background: 'var(--color-link)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        style={{
          background: 'var(--color-theseus-panel)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: 12,
          boxShadow: 'var(--shadow-warm-sm)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-muted)',
            marginBottom: 8,
          }}
        >
          Primitive
        </div>
        <pre
          style={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            lineHeight: 1.55,
            color: 'var(--color-ink)',
          }}
        >
          {summary || 'Click a primitive to inspect it.'}
        </pre>
      </div>

      <div
        style={{
          background: 'var(--color-theseus-panel)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: 12,
          boxShadow: 'var(--shadow-warm-sm)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-muted)',
            marginBottom: 8,
          }}
        >
          Drilldown
        </div>
        {isExplaining && !explanation && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-ink-muted)',
            }}
          >
            Streaming explanation
          </div>
        )}
        {explanation && (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--color-ink)',
            }}
          >
            {explanation}
          </div>
        )}
        {!isExplaining && !explanation && !explanationError && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--color-ink-muted)',
            }}
          >
            Double click a primitive to stream a focused explanation.
          </div>
        )}
        {explanationError && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--paper-pencil)',
            }}
          >
            {explanationError}
          </div>
        )}
      </div>
    </div>
  );

  const graphSurface = (
    <div
      style={{
        position: 'relative',
        minHeight: 320,
        height: 320,
        background: 'var(--color-hero-ground)',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    >
      <CosmosGraphCanvas
        ref={canvasRef}
        points={points}
        links={links}
        onReady={() => setCanvasReady(true)}
        onPointClick={(pointId) => {
          setSelectedId(pointId);
          setExplanation('');
          setExplanationError(null);
        }}
        onPointDoubleClick={(pointId) => {
          setSelectedId(pointId);
          requestExplanation(pointId, 'double_click');
        }}
        onPointRemoveRequested={handleRemove}
      />
    </div>
  );

  if (payload.render_target === 'r3f') {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div
          style={{
            background: 'var(--color-theseus-panel)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            padding: 16,
            boxShadow: 'var(--shadow-warm-sm)',
            color: 'var(--color-ink)',
          }}
        >
          3D simulation rendering is not wired in this workspace yet.
        </div>
        {rightPanel}
      </div>
    );
  }

  if (payload.render_target === 'mosaic') {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {mosaicPanel}
        {rightPanel}
      </div>
    );
  }

  if (payload.render_target === 'mixed') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.85fr)',
          gap: 12,
        }}
      >
        {graphSurface}
        <div style={{ display: 'grid', gap: 12 }}>
          {mosaicPanel}
          {rightPanel}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {graphSurface}
      {rightPanel}
    </div>
  );
};

export default SimulationPart;
