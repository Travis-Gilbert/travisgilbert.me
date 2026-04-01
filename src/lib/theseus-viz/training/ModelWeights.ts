/* SPEC-VIE-3: IndexedDB weight persistence for viz model
 *
 * Total: 9,517 parameters = ~38KB as Float32
 * Stored under key 'theseus-viz-model-v1'
 */

import type { ModelWeightsBundle } from '../SceneSpec';

const DB_NAME = 'theseus-viz';
const STORE_NAME = 'model';
const WEIGHTS_KEY = 'theseus-viz-model-v1';

const ARRAY_FIELDS = [
  'encoder_w1', 'encoder_b1', 'encoder_w2', 'encoder_b2',
  'edge_w', 'head_w3', 'head_b3',
  'head_w_rt', 'head_b_rt', 'head_w_lt', 'head_b_lt',
  'head_w_dv', 'head_b_dv', 'head_w_cam', 'head_b_cam',
  'node_w', 'node_b',
] as const;

type ArrayFieldKey = typeof ARRAY_FIELDS[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains('feedback')) {
        db.createObjectStore('feedback', { autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function loadWeights(): Promise<ModelWeightsBundle | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(WEIGHTS_KEY);

    return new Promise((resolve) => {
      req.onsuccess = () => {
        const data = req.result;
        if (!data) { resolve(null); return; }
        resolve(deserializeBundle(data));
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveWeights(bundle: ModelWeightsBundle): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(serializeBundle(bundle), WEIGHTS_KEY);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB not available
  }
}

function toArrayBuffer(arr: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(arr.byteLength);
  new Float32Array(buf).set(arr);
  return buf;
}

function serializeBundle(b: ModelWeightsBundle): Record<string, unknown> {
  const out: Record<string, unknown> = {
    version: b.version,
    trained_on_samples: b.trained_on_samples,
  };
  for (const key of ARRAY_FIELDS) {
    out[key] = toArrayBuffer(b[key]);
  }
  return out;
}

function deserializeBundle(s: Record<string, unknown>): ModelWeightsBundle {
  const out: Record<string, unknown> = {
    version: s.version as number,
    trained_on_samples: s.trained_on_samples as number,
  };
  for (const key of ARRAY_FIELDS) {
    out[key] = new Float32Array(s[key] as ArrayBuffer);
  }
  return out as unknown as ModelWeightsBundle;
}
