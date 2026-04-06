/**
 * vizPlanner.ts
 *
 * Client-side visualization type predictor using Universal Sentence Encoder + KNN.
 * Classifies a user query into a visualization type BEFORE the backend responds,
 * enabling speculative renderer warmup during the thinking phase.
 *
 * All TF.js imports are dynamic to avoid SSR/build issues. If the model fails
 * to load, every function returns graceful fallbacks so the ask flow is unaffected.
 */

export type VizType =
  | 'graph-native'
  | 'truth-map'
  | 'portrait'
  | 'object-scene'
  | 'bar-chart'
  | 'line-chart'
  | 'heatmap'
  | 'timeline'
  | 'comparison'
  | 'geographic'
  | 'unknown';

export interface VizPrediction {
  type: VizType;
  confidence: number;
  shouldWarmVision: boolean;
  suggestedRenderer: 'particle-field' | 'd3' | 'vega-lite' | 'sigma-2d';
}

const UNKNOWN_PREDICTION: VizPrediction = {
  type: 'unknown',
  confidence: 0,
  shouldWarmVision: false,
  suggestedRenderer: 'particle-field',
};

const RENDERER_MAP: Record<VizType, VizPrediction['suggestedRenderer']> = {
  'graph-native': 'particle-field',
  'truth-map': 'd3',
  portrait: 'particle-field',
  'object-scene': 'particle-field',
  'bar-chart': 'vega-lite',
  'line-chart': 'vega-lite',
  heatmap: 'vega-lite',
  timeline: 'd3',
  comparison: 'vega-lite',
  geographic: 'particle-field',
  unknown: 'particle-field',
};

const VISION_TYPES: Set<VizType> = new Set(['portrait', 'object-scene']);

const LS_CACHE_KEY = 'theseus-viz-knn-cache-v1';
const LS_TRAINING_KEY = 'theseus-viz-knn-training-v1';
const EMBEDDING_DIM = 512;

type KNNClassifier = Awaited<ReturnType<typeof createClassifier>>;
type USEModel = { embed: (texts: string[]) => Promise<{ data: () => Promise<Float32Array>; dispose: () => void }> };

let useModel: USEModel | null = null;
let classifier: KNNClassifier | null = null;
let tf: typeof import('@tensorflow/tfjs') | null = null;
let initPromise: Promise<void> | null = null;
let seeded = false;

async function createClassifier() {
  const knnLib = await import('@tensorflow-models/knn-classifier');
  return knnLib.create();
}

async function loadUSE(): Promise<USEModel> {
  const useLib = await import('@tensorflow-models/universal-sentence-encoder');
  return useLib.load() as Promise<USEModel>;
}

async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (!useModel) throw new Error('USE model not loaded');
  const tensor = await useModel.embed(texts);
  const flat = await tensor.data();
  tensor.dispose();

  const results: Float32Array[] = [];
  for (let i = 0; i < texts.length; i++) {
    results.push(flat.slice(i * EMBEDDING_DIM, (i + 1) * EMBEDDING_DIM) as Float32Array);
  }
  return results;
}

function float32ToBase64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

interface CacheEntry {
  label: VizType;
  embedding: string;
}

function loadCache(): CacheEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CacheEntry[];
  } catch {
    return [];
  }
}

function saveCache(entries: CacheEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded or private mode: ignore silently
  }
}

function loadOnlineTraining(): CacheEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LS_TRAINING_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CacheEntry[];
  } catch {
    return [];
  }
}

function saveOnlineTraining(entries: CacheEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_TRAINING_KEY, JSON.stringify(entries.slice(-200)));
  } catch {
    // Ignore
  }
}

async function addExample(embedding: Float32Array, label: VizType): Promise<void> {
  if (!classifier || !tf) return;
  const tensor = tf.tensor(Array.from(embedding), [EMBEDDING_DIM]);
  classifier.addExample(tensor, label);
  tensor.dispose();
}

async function seedFromCache(entries: CacheEntry[]): Promise<void> {
  for (const entry of entries) {
    const embedding = base64ToFloat32(entry.embedding);
    await addExample(embedding, entry.label);
  }
}

async function seedFromTrainingData(): Promise<CacheEntry[]> {
  const trainingData = (await import('./vizTrainingData.json')).default as Record<string, string[]>;
  const allTexts: string[] = [];
  const allLabels: VizType[] = [];

  for (const [label, queries] of Object.entries(trainingData)) {
    for (const query of queries) {
      allTexts.push(query);
      allLabels.push(label as VizType);
    }
  }

  const embeddings = await embedTexts(allTexts);
  const entries: CacheEntry[] = [];

  for (let i = 0; i < allTexts.length; i++) {
    await addExample(embeddings[i], allLabels[i]);
    entries.push({ label: allLabels[i], embedding: float32ToBase64(embeddings[i]) });
  }

  return entries;
}

async function init(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    tf = await import('@tensorflow/tfjs');
    [useModel, classifier] = await Promise.all([loadUSE(), createClassifier()]);

    const cached = loadCache();
    if (cached.length > 0) {
      await seedFromCache(cached);
    } else {
      const entries = await seedFromTrainingData();
      saveCache(entries);
    }

    const onlineEntries = loadOnlineTraining();
    if (onlineEntries.length > 0) {
      await seedFromCache(onlineEntries);
    }

    seeded = true;
  } catch (err) {
    console.warn('[VizPlanner] Failed to initialize:', err);
  }
}

/**
 * Warm up USE and seed the KNN classifier. Call once on app mount.
 * Non-blocking: fire and forget from component useEffect.
 */
export function warmUpModels(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!initPromise) {
    initPromise = init();
  }
  return initPromise;
}

/**
 * Predict the visualization type for a user query.
 * Fires alongside (not blocking) the ask API call.
 * Returns UNKNOWN_PREDICTION if the model is not ready or classification fails.
 */
export async function predictVizType(query: string): Promise<VizPrediction> {
  if (typeof window === 'undefined') return UNKNOWN_PREDICTION;
  if (!initPromise) warmUpModels();

  try {
    await initPromise;
    if (!useModel || !classifier || !tf || !seeded) return UNKNOWN_PREDICTION;

    const [embedding] = await embedTexts([query]);
    const tensor = tf.tensor(Array.from(embedding), [EMBEDDING_DIM]);

    let result;
    try {
      result = await classifier.predictClass(tensor);
    } finally {
      tensor.dispose();
    }

    const type = result.label as VizType;
    const confidence = result.confidences[type] ?? 0;

    return {
      type,
      confidence,
      shouldWarmVision: VISION_TYPES.has(type),
      suggestedRenderer: RENDERER_MAP[type] ?? 'particle-field',
    };
  } catch (err) {
    console.warn('[VizPlanner] Prediction failed:', err);
    return UNKNOWN_PREDICTION;
  }
}

/**
 * Add a feedback example to the KNN so it learns from backend results.
 * Call after the backend responds with the actual viz type.
 */
export async function trainFromFeedback(query: string, actualType: VizType): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!useModel || !classifier || !seeded) return;

  try {
    const [embedding] = await embedTexts([query]);
    await addExample(embedding, actualType);

    const entry: CacheEntry = { label: actualType, embedding: float32ToBase64(embedding) };
    // Defer the ~140KB JSON round-trip off the main thread
    setTimeout(() => {
      const existing = loadOnlineTraining();
      saveOnlineTraining([...existing, entry]);
    }, 0);
  } catch (err) {
    console.warn('[VizPlanner] trainFromFeedback failed:', err);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Rank follow-up suggestions by semantic similarity to the answer text.
 * Returns suggestions ordered from most to least relevant.
 * Falls back to original order if USE is not ready.
 */
export async function rankFollowUps(answerText: string, suggestions: string[]): Promise<string[]> {
  if (suggestions.length <= 1) return suggestions;
  if (!useModel || !seeded) return suggestions;

  try {
    const texts = [answerText, ...suggestions];
    const embeddings = await embedTexts(texts);

    const answerVec = Array.from(embeddings[0]);
    const scored = suggestions.map((text, i) => ({
      text,
      score: cosineSimilarity(answerVec, Array.from(embeddings[i + 1])),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.text);
  } catch (err) {
    console.warn('[VizPlanner] rankFollowUps failed:', err);
    return suggestions;
  }
}

/**
 * Infer VizType from a backend directive's render target.
 * Use to provide the "actual" label for trainFromFeedback.
 */
export function inferVizTypeFromRenderTarget(renderTarget: { primary: string; data_viz_type?: string }): VizType {
  switch (renderTarget.primary) {
    case 'force-graph-3d':
    case 'particle-field':
    case 'sigma-2d':
      return 'graph-native';
    case 'd3':
      // Both truth-map and timeline use d3. truth-map is the more common case;
      // without directive-level context (truth_map_topology) we can't distinguish them here.
      return 'truth-map';
    case 'vega-lite':
      switch (renderTarget.data_viz_type) {
        case 'line': return 'line-chart';
        case 'heatmap': return 'heatmap';
        default: return 'bar-chart';
      }
    default:
      return 'unknown';
  }
}
