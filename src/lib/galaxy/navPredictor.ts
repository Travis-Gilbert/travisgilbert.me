/**
 * navPredictor.ts
 *
 * Tiny TF.js MLP that predicts which navigation actions to surface based on
 * the current screen state. Persists weights to IndexedDB and learns
 * incrementally from click/ignore signals.
 *
 * Batch 1 of SPEC-ADAPTIVE-NAV. Pure intelligence wiring; no visual changes.
 *
 * Pipeline:
 *   ScreenState -> 10 normalized features -> MLP -> per-action probabilities
 *                                                -> threshold + top-4 cap
 *
 * Training:
 *   click  -> reward 1.0 for that action
 *   ignore -> reward 0.0 for that action
 *   Other actions in the same row receive a neutral target (0.5) so the loss
 *   does not push them toward zero on every update.
 */

type TFModule = typeof import('@tensorflow/tfjs');
type LayersModel = import('@tensorflow/tfjs').LayersModel;

/* ─────────────────────────────────────────────────
   Action catalog (extensible)
   ───────────────────────────────────────────────── */

export const NAV_ACTIONS = [
  { id: 'ask',         label: 'Ask',         route: '/theseus/ask',       icon: 'search' },
  { id: 'library',     label: 'Library',     route: '/theseus/library',   icon: 'stack' },
  { id: 'artifacts',   label: 'Artifacts',   route: '/theseus/artifacts', icon: 'grid' },
  { id: 'tensions',    label: 'Tensions',    action: 'openTensions',      icon: 'bolt' },
  { id: 'sources',     label: 'Sources',     action: 'openSources',       icon: 'link' },
  { id: 'followup',    label: 'Follow up',   action: 'focusInput',        icon: 'reply' },
  { id: 'investigate', label: 'Investigate', action: 'triggerInvestigation', icon: 'magnify' },
] as const;

export type NavActionId = typeof NAV_ACTIONS[number]['id'];

/* ─────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────── */

export interface ScreenState {
  routeIndex: number;          // 0..1
  engineState: number;         // 0 / 0.5 / 1 (idle / reasoning / constructing)
  visibleNodeCount: number;    // 0..1 normalized
  activeTensionCount: number;  // 0..1 normalized
  sessionDepth: number;        // 0..1
  timeSinceLastAction: number; // 0..1
  scrollDepth: number;         // 0..1
  hasActiveQuery: number;      // 0 / 1
  panelOpen: number;           // 0 / 0.5 / 1
  viewportWidthBucket: number; // 0 / 0.5 / 1
}

export interface NavPrediction {
  actions: Array<{
    id: NavActionId;
    label: string;
    probability: number;
    route?: string;
    action?: string;
  }>;
}

interface NavSignal {
  state: ScreenState;
  actionId: NavActionId;
  reward: number;
}

/* ─────────────────────────────────────────────────
   Module-level state
   ───────────────────────────────────────────────── */

const FEATURE_DIM = 10;
const OUTPUT_DIM = NAV_ACTIONS.length;
const MODEL_URL = 'indexeddb://theseus-nav-predictor-v1';
const PROBABILITY_THRESHOLD = 0.25;
const MAX_RESULTS = 4;
const NEUTRAL_TARGET = 0.5;

let tfModule: TFModule | null = null;
let model: LayersModel | null = null;
let hasTrained = false;
let initPromise: Promise<void> | null = null;
const signalBuffer: NavSignal[] = [];
let lastPredictionState: ScreenState | null = null;

/* ─────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────── */

async function loadTf(): Promise<TFModule> {
  if (!tfModule) {
    tfModule = await import('@tensorflow/tfjs');
  }
  return tfModule;
}

function buildModel(tf: TFModule): LayersModel {
  const seq = tf.sequential();
  seq.add(tf.layers.dense({
    inputShape: [FEATURE_DIM],
    units: 16,
    activation: 'relu',
  }));
  seq.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  seq.add(tf.layers.dense({ units: OUTPUT_DIM, activation: 'sigmoid' }));
  seq.compile({
    optimizer: tf.train.adam(),
    loss: 'binaryCrossentropy',
  });
  return seq;
}

function stateToFeatures(state: ScreenState): Float32Array {
  const out = new Float32Array(FEATURE_DIM);
  out[0] = state.routeIndex;
  out[1] = state.engineState;
  out[2] = state.visibleNodeCount;
  out[3] = state.activeTensionCount;
  out[4] = state.sessionDepth;
  out[5] = state.timeSinceLastAction;
  out[6] = state.scrollDepth;
  out[7] = state.hasActiveQuery;
  out[8] = state.panelOpen;
  out[9] = state.viewportWidthBucket;
  return out;
}

function actionIndex(id: NavActionId): number {
  for (let i = 0; i < NAV_ACTIONS.length; i++) {
    if (NAV_ACTIONS[i].id === id) return i;
  }
  return -1;
}

function uniformPriorPrediction(): NavPrediction {
  // Deterministic priors for the cold-start path. Route-navigation actions
  // get a slightly higher prior than contextual ones.
  const routeIds: ReadonlySet<NavActionId> = new Set(['ask', 'library', 'artifacts']);
  const scored = NAV_ACTIONS.map((a) => {
    const probability = routeIds.has(a.id) ? 0.5 : 0.3;
    return {
      id: a.id,
      label: a.label,
      probability,
      route: 'route' in a ? a.route : undefined,
      action: 'action' in a ? a.action : undefined,
    };
  });
  return finalizePrediction(scored);
}

function finalizePrediction(
  scored: Array<{
    id: NavActionId;
    label: string;
    probability: number;
    route?: string;
    action?: string;
  }>,
): NavPrediction {
  const filtered = scored.filter((a) => a.probability >= PROBABILITY_THRESHOLD);
  filtered.sort((a, b) => b.probability - a.probability);
  return { actions: filtered.slice(0, MAX_RESULTS) };
}

/* ─────────────────────────────────────────────────
   Public API
   ───────────────────────────────────────────────── */

export async function initNavModel(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const tf = await loadTf();
    try {
      model = await tf.loadLayersModel(MODEL_URL);
      // Recompile after load (loaded models are not compiled by default).
      model.compile({
        optimizer: tf.train.adam(),
        loss: 'binaryCrossentropy',
      });
      hasTrained = true;
    } catch {
      model = buildModel(tf);
      hasTrained = false;
    }
  })();
  return initPromise;
}

export async function saveNavModel(): Promise<void> {
  if (!model) return;
  await model.save(MODEL_URL);
}

export async function predictNav(state: ScreenState): Promise<NavPrediction> {
  lastPredictionState = state;

  if (!hasTrained) {
    // Skip TF.js entirely on the cold-start path so SSR/SSG never touches it.
    return uniformPriorPrediction();
  }

  if (!model) {
    await initNavModel();
  }
  if (!model) {
    return uniformPriorPrediction();
  }

  const tf = await loadTf();
  const features = stateToFeatures(state);

  const probs = tf.tidy(() => {
    const input = tf.tensor2d(features, [1, FEATURE_DIM]);
    const output = model!.predict(input) as import('@tensorflow/tfjs').Tensor;
    return output.dataSync() as Float32Array;
  });

  const scored = NAV_ACTIONS.map((a, i) => ({
    id: a.id,
    label: a.label,
    probability: probs[i],
    route: 'route' in a ? a.route : undefined,
    action: 'action' in a ? a.action : undefined,
  }));

  return finalizePrediction(scored);
}

export function recordNavSignal(actionId: NavActionId, signal: 'click' | 'ignore'): void {
  if (!lastPredictionState) return;
  signalBuffer.push({
    state: lastPredictionState,
    actionId,
    reward: signal === 'click' ? 1.0 : 0.0,
  });
}

export async function trainNavModel(): Promise<void> {
  if (signalBuffer.length === 0) return;
  if (!model) {
    await initNavModel();
  }
  if (!model) return;

  const tf = await loadTf();
  const batchSize = signalBuffer.length;
  const xData = new Float32Array(batchSize * FEATURE_DIM);
  const yData = new Float32Array(batchSize * OUTPUT_DIM);

  for (let i = 0; i < batchSize; i++) {
    const sig = signalBuffer[i];
    xData.set(stateToFeatures(sig.state), i * FEATURE_DIM);
    // Default everyone to neutral, then override the targeted action.
    for (let j = 0; j < OUTPUT_DIM; j++) {
      yData[i * OUTPUT_DIM + j] = NEUTRAL_TARGET;
    }
    const idx = actionIndex(sig.actionId);
    if (idx >= 0) {
      yData[i * OUTPUT_DIM + idx] = sig.reward;
    }
  }

  const xs = tf.tensor2d(xData, [batchSize, FEATURE_DIM]);
  const ys = tf.tensor2d(yData, [batchSize, OUTPUT_DIM]);

  try {
    await model.fit(xs, ys, { epochs: 1, batchSize });
    hasTrained = true;
    signalBuffer.length = 0;
    await saveNavModel();
  } finally {
    xs.dispose();
    ys.dispose();
  }
}
