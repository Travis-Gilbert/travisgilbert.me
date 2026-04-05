/**
 * Vega-Lite to Observable Plot translator.
 *
 * Converts a subset of Vega-Lite specs into PlotMarkDescriptor arrays
 * that PlotRenderer can resolve at render time. This module is pure
 * (no Observable Plot import) and fully testable in isolation.
 */

// ---- Output types ----

export interface PlotMarkDescriptor {
  markFn: string;
  data: unknown[];
  channels: Record<string, unknown>;
}

export interface PlotTranslation {
  supported: true;
  marks: PlotMarkDescriptor[];
  title?: string;
  width?: number;
  height?: number;
}

export interface TranslateUnsupported {
  supported: false;
  reason: string;
}

export type TranslateResult = PlotTranslation | TranslateUnsupported;

// ---- Internal helpers ----

/** Type guard: is this a record (plain object)? */
function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Extract inline data values from a Vega-Lite data field. */
function extractData(data: unknown): unknown[] | null {
  if (!isRecord(data)) return null;
  if (Array.isArray(data.values)) return data.values;
  // URL data sources are unsupported
  if (typeof data.url === 'string') return null;
  return null;
}

/** Check if an encoding channel indicates a quantitative or aggregate field. */
function isQuantitativeOrAggregate(enc: unknown): boolean {
  if (!isRecord(enc)) return false;
  const t = enc.type as string | undefined;
  if (t === 'quantitative') return true;
  if (typeof enc.aggregate === 'string') return true;
  return false;
}

/** Check if an encoding channel indicates a nominal or ordinal field. */
function isNominalOrOrdinal(enc: unknown): boolean {
  if (!isRecord(enc)) return false;
  const t = enc.type as string | undefined;
  return t === 'nominal' || t === 'ordinal';
}

/**
 * Detect whether a bar chart should be horizontal.
 * Horizontal when x is quantitative/aggregate and y is nominal/ordinal.
 */
function isHorizontalBar(encoding: Record<string, unknown>): boolean {
  return (
    isQuantitativeOrAggregate(encoding.x) &&
    isNominalOrOrdinal(encoding.y)
  );
}

/** Map a Vega-Lite mark type to an Observable Plot mark function name. */
function mapMark(markType: string, encoding: Record<string, unknown>): string | null {
  switch (markType) {
    case 'bar':
      return isHorizontalBar(encoding) ? 'barX' : 'barY';
    case 'line':
      return 'lineY';
    case 'point':
    case 'circle':
      return 'dot';
    case 'area':
      return 'areaY';
    case 'rect':
      return 'cell';
    case 'text':
      return 'text';
    case 'tick':
      return 'tickX';
    case 'rule':
      return 'ruleY';
    default:
      return null;
  }
}

/** Map Vega-Lite encoding channels to Observable Plot channel names. */
function mapChannels(encoding: Record<string, unknown>): Record<string, unknown> {
  const channels: Record<string, unknown> = {};
  const channelMap: Record<string, string> = {
    x: 'x',
    y: 'y',
    color: 'fill',
    size: 'r',
    text: 'text',
    opacity: 'opacity',
  };

  for (const [vlKey, plotKey] of Object.entries(channelMap)) {
    const enc = encoding[vlKey];
    if (!isRecord(enc)) continue;

    // Use field name as the channel value (Observable Plot convention)
    if (typeof enc.field === 'string') {
      channels[plotKey] = enc.field;
    } else if (typeof enc.aggregate === 'string' && typeof enc.field === 'undefined') {
      // Aggregate without field (e.g., count)
      channels[plotKey] = enc.aggregate;
    }
  }

  return channels;
}

/** Extract the mark type string from a Vega-Lite mark (string or object form). */
function resolveMarkType(mark: unknown): string | null {
  if (typeof mark === 'string') return mark;
  if (isRecord(mark) && typeof mark.type === 'string') return mark.type;
  return null;
}

/** Extract the title string from a Vega-Lite title (string or object form). */
function resolveTitle(title: unknown): string | undefined {
  if (typeof title === 'string') return title;
  if (isRecord(title) && typeof title.text === 'string') return title.text;
  return undefined;
}

/**
 * Translate a single view (has `mark` + `encoding`) into a PlotMarkDescriptor.
 * Returns null if the mark type is unsupported.
 */
function translateView(
  view: Record<string, unknown>,
  parentData: unknown[] | null,
): PlotMarkDescriptor | null {
  const markType = resolveMarkType(view.mark);
  if (!markType) return null;

  const encoding = isRecord(view.encoding) ? view.encoding : {};
  const plotMarkFn = mapMark(markType, encoding);
  if (!plotMarkFn) return null;

  const viewData = view.data ? extractData(view.data) : parentData;
  const channels = mapChannels(encoding);

  return {
    markFn: plotMarkFn,
    data: viewData ?? [],
    channels,
  };
}

// ---- Unsupported feature detection ----

const UNSUPPORTED_KEYS = [
  'selection',
  'params',
  'concat',
  'hconcat',
  'vconcat',
  'repeat',
  'projection',
  'facet',
] as const;

function detectUnsupported(spec: Record<string, unknown>): string | null {
  for (const key of UNSUPPORTED_KEYS) {
    if (spec[key] !== undefined) {
      return `Unsupported feature: ${key}`;
    }
  }

  // Check transform count
  if (Array.isArray(spec.transform) && spec.transform.length > 2) {
    return `Too many transforms (${spec.transform.length}; max 2)`;
  }

  // Check for URL data source at top level
  if (isRecord(spec.data) && typeof spec.data.url === 'string') {
    return 'URL data sources are not supported';
  }

  return null;
}

// ---- Main translator ----

/**
 * Translate a Vega-Lite spec into an Observable Plot configuration.
 *
 * Returns `{ supported: false, reason }` for specs that use features
 * outside the supported subset (facets, selections, params, compositions,
 * projections, >2 transforms, URL data).
 */
export function vegaLiteToPlot(spec: unknown): TranslateResult {
  if (!isRecord(spec)) {
    return { supported: false, reason: 'Spec is not a valid object' };
  }

  const unsupported = detectUnsupported(spec);
  if (unsupported) {
    return { supported: false, reason: unsupported };
  }

  const title = resolveTitle(spec.title);
  const width = typeof spec.width === 'number' ? spec.width : undefined;
  const height = typeof spec.height === 'number' ? spec.height : undefined;
  const parentData = spec.data ? extractData(spec.data) : null;

  // Layered spec
  if (Array.isArray(spec.layer)) {
    const marks: PlotMarkDescriptor[] = [];

    for (const layerItem of spec.layer) {
      if (!isRecord(layerItem)) continue;

      // Check layer-level unsupported features
      const layerUnsupported = detectUnsupported(layerItem);
      if (layerUnsupported) {
        return { supported: false, reason: layerUnsupported };
      }

      // Layer items can have their own data
      const layerData = layerItem.data
        ? extractData(layerItem.data)
        : parentData;

      const descriptor = translateView(layerItem, layerData);
      if (descriptor) {
        marks.push(descriptor);
      }
    }

    if (marks.length === 0) {
      return { supported: false, reason: 'No translatable marks in layer' };
    }

    return { supported: true, marks, title, width, height };
  }

  // Single view spec
  if (spec.mark !== undefined) {
    const descriptor = translateView(spec, parentData);
    if (!descriptor) {
      const markType = resolveMarkType(spec.mark);
      return {
        supported: false,
        reason: `Unsupported mark type: ${markType ?? 'unknown'}`,
      };
    }

    return { supported: true, marks: [descriptor], title, width, height };
  }

  return { supported: false, reason: 'Spec has neither mark nor layer' };
}

// ---- Progressive data slicing ----

/**
 * Slice each mark's data array to reveal only the first `progress` fraction.
 * Useful for animated reveal of chart data.
 *
 * Progress is clamped to [0.05, 1.0] and always returns at least 1 data point.
 */
export function sliceTranslationData(
  translation: PlotTranslation,
  progress: number,
): PlotTranslation {
  const clamped = Math.min(1.0, Math.max(0.05, progress));

  const marks = translation.marks.map((mark) => {
    const total = mark.data.length;
    if (total === 0) return mark;

    const count = Math.max(1, Math.round(total * clamped));
    return {
      ...mark,
      data: mark.data.slice(0, count),
    };
  });

  return { ...translation, marks };
}
